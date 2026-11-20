// @vitest-environment happy-dom
// #15: components inside islands.
import { readFileSync } from 'node:fs'
import { beforeEach, expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { attachAll } from '../../src/runtime/loader.ts'
import { importCode } from '../helpers.ts'

const fixture = (name: string) => readFileSync(`${import.meta.dirname}/../fixtures/${name}`, 'utf8')
const badgeSrc = '@input label: string\n<span class="badge">{{ label }}</span>'
const boxSrc = '<div class="box"><slot /></div>'
const counterSrc = fixture('counter.tscl')

/** Compile the island and its children, wire the child imports, render on the "server", attach every island. */
async function mount(source: string) {
  const childServer = {
    './badge.tscl': compile(badgeSrc, { file: 'badge.tscl', target: 'server' }).code,
    './box.tscl': compile(boxSrc, { file: 'box.tscl', target: 'server' }).code,
    './counter.tscl': compile(counterSrc, { file: 'counter.tscl', target: 'server', clientUrl: '/counter.js' }).code,
  }
  const childRender = Object.fromEntries(Object.entries(childServer).map(([k, v]) => [`${k}?render`, v]))
  const s = await importCode(compile(source, { file: 'x.tscl', target: 'server', clientUrl: '/x.js' }).code, 'nest-s', childServer)
  const c = await importCode(compile(source, { file: 'x.tscl', target: 'client' }).code, 'nest-c', childRender)
  const counter = await importCode(compile(counterSrc, { file: 'counter.tscl', target: 'client' }).code, 'nest-counter')
  document.body.innerHTML = s.render({})
  const modules: Record<string, unknown> = { '/x.js': c, '/counter.js': counter }
  await attachAll(document, async (src) => modules[src] as any)
  return document.querySelector('cl-island[c="x"]')!
}
const click = (el: Element | null) => (el as HTMLElement).click()
const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => { document.body.innerHTML = '' })

test('a stateless child with fixed props is plain HTML inside the island', async () => {
  const src = `@import badge from './badge.tscl'\n<script>let n = state(0)</script>\n<badge [label]="'hi'" /><b (click)="n++">{{ n }}</b>`
  const html = compile(src, { file: 'x.tscl', target: 'server', clientUrl: '/x.js' }).code
  expect(html).not.toContain('<!--[c')
  const island = await mount(src)
  expect(island.querySelector('.badge')!.textContent).toBe('hi')
})

test('a stateless child whose props read state re-renders when it changes', async () => {
  const island = await mount(`@import badge from './badge.tscl'\n<script>let n = state(1)</script>\n<badge [label]="'n=' + n" /><b class="inc" (click)="n++">+</b>`)
  expect(island.querySelector('.badge')!.textContent).toBe('n=1')
  click(island.querySelector('.inc'))
  expect(island.querySelector('.badge')!.textContent).toBe('n=2')
})

test('slot content inside a child keeps its holes and events, without double-firing after re-renders', async () => {
  const island = await mount(`@import box from './box.tscl'
<script>let n = state(0)</script>
<box><b class="inc" (click)="n++">{{ n }}</b></box>`)
  click(island.querySelector('.inc'))
  click(island.querySelector('.inc'))
  expect(island.querySelector('.box .inc')!.textContent).toBe('2')
})

test('a stateful child is its own island: both attach once and update independently', async () => {
  const island = await mount(`@import counter from './counter.tscl'
<script>let n = state(0)</script>
<p class="outer" (click)="n++">{{ n }}</p><counter [start]="5" />`)
  const inner = island.querySelector('cl-island[c="counter"]')!
  expect(inner.hasAttribute('data-cl-ready')).toBe(true)
  click(inner.querySelector('button'))
  expect(inner.querySelector('button')!.textContent).toBe('Clicked 6 times (double: 12)')
  expect(island.querySelector('.outer')!.textContent).toBe('0')
  click(island.querySelector('.outer'))
  expect(island.querySelector('.outer')!.textContent).toBe('1')
  expect(inner.querySelector('button')!.textContent).toBe('Clicked 6 times (double: 12)')
})

test('a stateful child inserted by an @if branch is attached', async () => {
  const island = await mount(`@import counter from './counter.tscl'
<script>let open = state(false)</script>
<b class="t" (click)="open = !open">t</b>@if (open) {<counter [start]="1" />}`)
  click(island.querySelector('.t'))
  await flush()
  const inner = island.querySelector('cl-island[c="counter"]')!
  expect(inner.hasAttribute('data-cl-ready')).toBe(true)
  click(inner.querySelector('button'))
  expect(inner.querySelector('button')!.textContent).toBe('Clicked 2 times (double: 4)')
})

test('children in @for rows render per item', async () => {
  const island = await mount(`@import badge from './badge.tscl'
<script>let xs = state(['a'])</script>
<b class="add" (click)="xs = [...xs, 'b']">+</b>@for (x of xs) {<badge [label]="x" />}`)
  click(island.querySelector('.add'))
  expect([...island.querySelectorAll('.badge')].map((e) => e.textContent)).toEqual(['a', 'b'])
})
