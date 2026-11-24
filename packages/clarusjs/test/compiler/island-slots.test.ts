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
  expect(document.querySelector('.head')!.innerHTML.replace(/<!--[^>]*-->/g, '').trim()).toBe('<b>&lt;x&gt;</b>')
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

test('an island takes content from inside another island (#465): it renders, inside the inner island\'s slot range', async () => {
  const outer = `@import tabs from './tabs.tscl'\n<script>\n  let on = state(true)\n</script>\n<tabs><p>{{ on }}</p></tabs>\n`
  const p = await importCode(server(outer, 'outer.tscl'), 'islslot-nested', { './tabs.tscl': server(tabs, 'tabs.tscl') })
  const html = await p.render({})
  expect(html).toMatch(/<!--\[s--><p[^>]*><!--\[\d+-->true<!--\]--><\/p><!--\]s-->/)
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

test('content that awaits (#430) renders inside an island: the island waits for it', async () => {
  const slow = server('<script server>\n  const v = await Promise.resolve(\'late\')\n</script>\n<b>{{ v }}</b>\n', 'slow.tscl')
  const page = server(`@import tabs from './tabs.tscl'\n@import slow from './slow.tscl'\n<tabs><slow /></tabs>`, 'page.tscl')
  const p = await importCode(page, 'islslot-await', { './tabs.tscl': server(tabs, 'tabs.tscl'), './slow.tscl': slow })
  const html = await p.render({})
  expect(html).toMatch(/<b[^>]*>late<\/b>/)
  expect(html).toMatch(/^<cl-island c="tabs"/)
})

test('content from an island passed on through a component without a script renders inside the inner island\'s slot range', async () => {
  const { mkdirSync, writeFileSync } = await import('node:fs')
  const modules: Record<string, string> = {
    'tabs': server(tabs, 'tabs.tscl'),
    'w': server("@import tabs from './tabs.tscl'\n<div><tabs><slot /></tabs></div>\n", 'w.tscl'),
    'outer': server("@import w from './w.tscl'\n<script>\n  let on = state(true)\n</script>\n<w><p>{{ on }}</p></w>\n", 'outer.tscl'),
  }
  const dir = `${import.meta.dirname}/../.tmp/`
  const prefix = `islvia-${process.pid}-`
  mkdirSync(dir, { recursive: true })
  for (const [name, code] of Object.entries(modules)) writeFileSync(`${dir}${prefix}${name}.mjs`, code.replace(/from '\.\/(\w+)\.tscl'/g, (_, f) => `from './${prefix}${f}.mjs'`))
  const { render } = await import(/* @vite-ignore */ `${dir}${prefix}outer.mjs`)
  expect(await render({})).toMatch(/<!--\[s--><p[^>]*><!--\[\d+-->true<!--\]--><\/p><!--\]s-->/)
})

test('an island wraps each slot\'s content in <!--[s-->…<!--]s-->; a component without a script adds nothing', async () => {
  const page = server(`@import tabs from './tabs.tscl'\n<tabs>@slot('head') { <b>h</b> }<p>body</p></tabs>`, 'page.tscl')
  const p = await importCode(page, 'islslot-ranges', { './tabs.tscl': server(tabs, 'tabs.tscl') })
  const html: string = await p.render({})
  expect(html.match(/<!--\[s-->/g)).toHaveLength(2)
  expect(html).toMatch(/<!--\[s-->\s*<b[^>]*>h<\/b>\s*<!--\]s-->/)
  expect(html).toMatch(/<!--\[s--><p[^>]*>body<\/p><!--\]s-->/)
  const card = server('<div class="card"><slot /></div>', 'card.tscl')
  const q = await importCode(server(`@import card from './card.tscl'\n<card><p>x</p></card>`, 'page.tscl'), 'islslot-static', { './card.tscl': card })
  expect(await q.render({})).not.toContain('[s')
})
