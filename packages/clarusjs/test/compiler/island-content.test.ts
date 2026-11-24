// @vitest-environment happy-dom
// #465: an island passes content, with its own markers, to another island. Each wires only its own: the content
// sits in the inner island's slot range, and owner() gives it to the outer island.
import { afterEach, expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { attachAll } from '../../src/runtime/loader.ts'
import { importCode } from '../helpers.ts'

afterEach(() => { document.body.innerHTML = '' })
const $ = (s: string) => document.querySelector(s) as HTMLElement
const click = (s: string) => $(s).click()
const tick = () => new Promise((r) => setTimeout(r, 0))

const parts: Record<string, string> = {
  box: "<script>\n  let open = state(true)\n</script>\n<div class=\"box\">\n  <button class=\"own\" (click)=\"open = !open\">t</button>\n  @if (open) { <i class=\"own-if\">on</i> }\n  <div class=\"slot\"><slot /></div>\n</div>\n",
  pick: "@model value: string = 'a'\n@event change: string\n<script>\n  function go(event) { if (emit('change', 'b', { reason: 'select', event })) value = 'b' }\n</script>\n<div><button class=\"pick\" (click)=\"go($event)\">p</button><slot /></div>\n",
  prov: "@input v: string = 'x'\n<script>\n  provide('pv', { v })\n</script>\n<div class=\"prov\"><slot /></div>\n",
  reader: "@context pv: { v: string }\n<b class=\"reader\">{{ pv.v }}</b>\n",
  shell: "@context pv: { v: string }\n@input n: number = 0\n<p class=\"shell\">{{ pv.v }}:{{ n }} <slot /></p>\n",
  cnt: "<script>\n  let c = state(0)\n</script>\n<button class=\"cnt\" (click)=\"c++\">{{ c }}</button>\n",
}
let n = 0
async function mount(outer: string, opts: object = {}) {
  const names = Object.keys(parts)
  const serverOf = (name: string) => compile(parts[name]!, { file: `${name}.tscl`, target: 'server', clientUrl: `/${name}.js` }).code
  const imports = names.map((x) => `@import ${x} from './${x}.tscl'`).join('\n') + '\n'
  const source = imports + outer
  const deps = Object.fromEntries(names.map((x) => [`./${x}.tscl`, serverOf(x)]))
  const renderDeps = Object.fromEntries(names.map((x) => [`./${x}.tscl?render`, serverOf(x)]))
  const s = await importCode(compile(source, { file: 'page.tscl', target: 'server', clientUrl: '/page.js' }).code, `ic-s-${n}`, deps)
  const modules: Record<string, unknown> = { '/page.js': await importCode(compile(source, { file: 'page.tscl', target: 'client' }).code, `ic-c-${n}`, renderDeps) }
  for (const x of names) modules[`/${x}.js`] = await importCode(compile(parts[x]!, { file: `${x}.tscl`, target: 'client' }).code, `ic-${x}-${n}`, {})
  n++
  document.body.innerHTML = await s.render({}, undefined, opts)
  await attachAll(document, async (src) => modules[src] as any)
}

test('the outer island\'s holes and handlers work inside the inner island; the inner island\'s own still do', async () => {
  await mount('<script>\n  let n = state(0)\n</script>\n<box><b class="n">{{ n }}</b><button class="inc" (click)="n++">+</button></box>\n')
  click('.inc')
  expect($('.n').textContent).toBe('1')
  click('.own')
  expect(document.querySelector('.own-if')).toBe(null)
  click('.own')
  expect($('.own-if').textContent).toBe('on')
  click('.inc')
  expect($('.n').textContent).toBe('2')
})

test('an inner island in the outer island\'s @if: its content is wired again when the branch comes back', async () => {
  await mount('<script>\n  let n = state(0)\n  let show = state(true)\n</script>\n<button class="tog" (click)="show = !show">s</button>\n@if (show) { <box><b class="n">{{ n }}</b><button class="inc" (click)="n++">+</button></box> }\n')
  click('.tog')
  expect(document.querySelector('.box')).toBe(null)
  click('.tog')
  await attachAll(document)
  click('.inc')
  expect($('.n').textContent).toBe('1')
})

test('inner islands in the outer island\'s @for rows: every row\'s content follows the outer state', async () => {
  await mount('<script>\n  let n = state(0)\n  let items = state([1, 2])\n</script>\n<button class="add" (click)="items = [...items, 3]">a</button><button class="inc" (click)="n++">+</button>\n@for (i of items; track i) { <box><b class="row">{{ i }}-{{ n }}</b></box> }\n')
  click('.add')
  await attachAll(document)
  click('.inc')
  expect([...document.querySelectorAll('.row')].map((e) => e.textContent)).toEqual(['1-1', '2-1', '3-1'])
})

test('[(value)] and a cancellable (change) across islands that hold content', async () => {
  await mount("<script>\n  let v = state('a')\n  let locked = state(false)\n</script>\n<button class=\"lock\" (click)=\"locked = true\">l</button>\n<pick [(value)]=\"v\" (change)=\"if (locked) $info.cancel()\"><span class=\"v\">{{ v }}</span></pick>\n")
  click('.lock')
  click('.pick')
  expect($('.v').textContent).toBe('a')
  document.body.innerHTML = ''
  await mount("<script>\n  let v = state('a')\n</script>\n<pick [(value)]=\"v\"><span class=\"v\">{{ v }}</span></pick>\n")
  click('.pick')
  expect($('.v').textContent).toBe('b')
})

test('Review Focus 1: an island written in the content attaches and works on its own', async () => {
  await mount('<script>\n  let n = state(0)\n</script>\n<box><cnt /><b class="n">{{ n }}</b></box>\n')
  click('.cnt')
  click('.cnt')
  expect($('.cnt').textContent).toBe('2')
  expect($('.n').textContent).toBe('0')
})

test('Review Focus 2: two inner islands with content from the same outer island', async () => {
  await mount('<script>\n  let n = state(0)\n</script>\n<box><b class="n1">{{ n }}</b></box><box><b class="n2">{{ n * 2 }}</b><button class="inc" (click)="n++">+</button></box>\n')
  click('.inc')
  expect($('.n1').textContent).toBe('1')
  expect($('.n2').textContent).toBe('2')
})

test('Review Focus 3: an @if in the content switches branches inside the inner island', async () => {
  await mount('<script>\n  let n = state(0)\n</script>\n<box>@if (n > 0) { <b class="pos">pos</b> } @else { <b class="zero">zero</b> }<button class="inc" (click)="n++">+</button></box>\n')
  click('.inc')
  expect($('.pos').textContent).toBe('pos')
  expect(document.querySelector('.zero')).toBe(null)
})

test('Review Focus 4: the inner island re-renders its own block without taking the outer island\'s markers', async () => {
  await mount('<script>\n  let n = state(0)\n</script>\n<box><b class="n">{{ n }}</b><button class="inc" (click)="n++">+</button></box>\n')
  click('.own')
  click('.own')
  click('.inc')
  expect($('.n').textContent).toBe('1')
  expect($('.own-if').textContent).toBe('on')
})

test('Review Focus 5: [use] on the outer island\'s element inside the inner island is called once, by the outer one', async () => {
  const log: string[] = []
  ;(globalThis as { __icLog?: string[] }).__icLog = log
  await mount('<script>\n  const tag = (el) => { globalThis.__icLog.push(el.tagName) }\n</script>\n<box><p [use]="tag">x</p></box>\n')
  expect(log).toEqual(['P'])
})

test('a click on the outer island\'s content before it attaches (attach="interaction") is replayed once', async () => {
  await mount('<script>\n  let n = state(0)\n</script>\n<box><b class="n">{{ n }}</b><button class="inc" (click)="n++">+</button></box>\n', { attach: 'interaction' })
  click('.inc')
  for (let i = 0; i < 5; i++) await tick()
  expect($('.n').textContent).toBe('1')
})


test('context from an island that holds content written by another island reaches that content, in the browser too', async () => {
  await mount("<script>\n  let v = state('a')\n</script>\n<button class=\"set\" (click)=\"v = 'b'\">s</button>\n<prov [v]=\"v\"><reader /></prov>\n")
  expect($('.reader').textContent).toBe('a')
  expect(document.querySelector('cl-island[c="page"]')!.hasAttribute('data-cl-error')).toBe(false)
})

test('a component in the content that the outer island re-renders gets the context of the island holding it', async () => {
  await mount("<script>\n  let v = state('a')\n  let n = state(0)\n</script>\n<button class=\"inc\" (click)=\"n++\">+</button>\n<prov [v]=\"v\"><shell [n]=\"n\"><i>x</i></shell></prov>\n")
  expect(document.querySelector('cl-island[c="page"]')!.hasAttribute('data-cl-error')).toBe(false)
  click('.inc')
  expect($('.shell').textContent).toContain('a:1')
})
