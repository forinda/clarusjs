// @vitest-environment happy-dom
// #465: an island takes content at a <slot /> outside its @if/@for/@await blocks. The server renders the content in
// the parent's scope; the browser never re-renders it, so the island wires its own parts around it.
import { afterEach, expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { ClarusError } from '../../src/compiler/errors.ts'
import { attachAll } from '../../src/runtime/loader.ts'
import { importCode } from '../helpers.ts'

afterEach(() => { document.body.innerHTML = '' })

const server = (source: string, file: string) => compile(source, { file, target: 'server', clientUrl: `/${file}.js` }).code
const client = (source: string, file: string) => compile(source, { file, target: 'client' }).code
const compileError = (source: string) => {
  try { compile(source, { file: 'x.tscl', target: 'server', clientUrl: '/c.js' }) } catch (e) { return (e as ClarusError).message }
  throw new Error('expected compile to throw')
}

const tabs = `<script>
  let n = state(0)
</script>
<div class="tabs">
  <button class="more" (click)="n++">{{ n }}</button>
  <div class="head"><slot name="head" /></div>
  <slot />
  <p class="after">{{ n * 2 }}</p>
</div>
`

test('an island renders its content at <slot /> and wires its own parts around it', async () => {
  const page = server(`@import tabs from './tabs.tscl'\n@input who: string\n<tabs>@slot('head') { <b>{{ who }}</b> }<p class="body">hi {{ who }}</p></tabs>`, 'page.tscl')
  const p = await importCode(page, 'islslot-page', { './tabs.tscl': server(tabs, 'tabs.tscl') })
  const c = await importCode(client(tabs, 'tabs.tscl'), 'islslot-c')
  document.body.innerHTML = await p.render({ who: '<x>' })
  expect(document.querySelector('.head')!.innerHTML.trim()).toBe('<b>&lt;x&gt;</b>')
  expect(document.querySelector('.body')!.textContent).toBe('hi <x>')
  await attachAll(document, async () => c)
  ;(document.querySelector('.more') as HTMLElement).click()
  expect(document.querySelector('.more')!.textContent).toBe('1')
  expect(document.querySelector('.after')!.textContent).toBe('2')
  expect(document.querySelector('.body')!.textContent).toBe('hi <x>')
})

test('content for a slot the island lacks fails when rendering, naming it', async () => {
  const page = server(`@import tabs from './tabs.tscl'\n<tabs>@slot('foot') { x }</tabs>`, 'page.tscl')
  const p = await importCode(page, 'islslot-unknown', { './tabs.tscl': server(tabs, 'tabs.tscl') })
  await expect(Promise.resolve().then(() => p.render({}))).rejects.toThrow(/<tabs> has no slot "foot"/)
})

test('an island can\'t take content from inside another island yet: a render error, naming it', async () => {
  const outer = `@import tabs from './tabs.tscl'\n<script>\n  let on = state(true)\n</script>\n<tabs><p>{{ on }}</p></tabs>\n`
  const p = await importCode(server(outer, 'outer.tscl'), 'islslot-nested', { './tabs.tscl': server(tabs, 'tabs.tscl') })
  await expect(Promise.resolve().then(() => p.render({}))).rejects.toThrow(/<tabs> can't take content from inside another island yet/)
})

test('in an island, <slot /> inside a block or component content is a located build error', () => {
  const s = (body: string) => `<script>\n  let on = state(true)\n</script>\n${body}\n`
  expect(compileError(s('@if (on) { <slot /> }'))).toMatch(/^x\.tscl:4:12 .*outside @if, @for and @await/)
  expect(compileError(s('@for (i of [1]; track i) { <slot /> }'))).toMatch(/^x\.tscl:4:28 .*outside @if, @for and @await/)
  expect(compileError(`@import card from './card.tscl'\n${s('<card><slot /></card>')}`)).toMatch(/^x\.tscl:5:7 .*outside @if, @for and @await/)
})

test('in an island, a slot passes no data and has no fallback content', () => {
  const s = (body: string) => `<script>\n  let on = state(true)\n</script>\n${body}\n`
  expect(compileError(s('<slot [on]="on" />'))).toMatch(/^x\.tscl:4:1 .*in an island, a slot passes no data/)
  expect(compileError(s('<slot>none</slot>'))).toMatch(/^x\.tscl:4:1 .*in an island, a slot has no fallback content/)
})
