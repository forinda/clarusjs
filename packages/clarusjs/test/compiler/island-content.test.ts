// @vitest-environment happy-dom
// #465: an island passes content, with its own markers, to another island. Each wires only its own: the content
// sits in the inner island's slot range, and owner() gives it to the outer island.
import { afterEach, expect, test, vi } from 'vitest'
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
  protoProv: "@input v: string = 'x'\n<script>\n  provide('__proto__', { v })\n</script>\n<div class=\"prov\"><slot /></div>\n",
  protoShell: "@context __proto__: { v: string }\n@input n: number = 0\n<p class=\"shell\">{{ __proto__.v }}:{{ n }}</p>\n",
  cnt: "<script>\n  let c = state(0)\n</script>\n<button class=\"cnt\" (click)=\"c++\">{{ c }}</button>\n",
  clickable: "<button class=\"clk\" type=\"button\"><slot /></button>\n",
  wrapper: "<div class=\"wrap\"><slot /></div>\n",
  onlyEmitter: "@import emitter from './emitter.tscl'\n<emitter />\n",
  xbtn: "@extends button\n<script>\n  let c = state(0)\n</script>\n<button class=\"xb\" type=\"button\" [data-c]=\"c\" (click)=\"c++\">{{ c }}</button>\n",
  emitter: "@event click: string\n<script>\n  function go(event) { emit('click', 'from-child', { event }) }\n</script>\n<button class=\"em\" (click)=\"go($event)\">e</button>\n",
}
let n = 0
type Loader = (modules: Record<string, unknown>) => (src: string) => Promise<any>
async function mount(outer: string, opts: object = {}, loader: Loader = (modules) => async (src) => modules[src]) {
  const names = Object.keys(parts)
  const serverOf = (name: string) => compile(parts[name]!, { file: `${name}.tscl`, target: 'server', clientUrl: `/${name}.js` }).code
  const imports = names.map((x) => `@import ${x} from './${x}.tscl'`).join('\n') + '\n'
  const source = imports + outer
  const deps = Object.fromEntries(names.map((x) => [`./${x}.tscl`, serverOf(x)]))
  const renderDeps = { ...deps, ...Object.fromEntries(names.map((x) => [`./${x}.tscl?render`, serverOf(x)])) } // plain ones too: a component may render another
  const s = await importCode(compile(source, { file: 'page.tscl', target: 'server', clientUrl: '/page.js' }).code, `ic-s-${n}`, deps)
  const modules: Record<string, unknown> = { '/page.js': await importCode(compile(source, { file: 'page.tscl', target: 'client' }).code, `ic-c-${n}`, renderDeps) }
  for (const x of names) modules[`/${x}.js`] = await importCode(compile(parts[x]!, { file: `${x}.tscl`, target: 'client' }).code, `ic-${x}-${n}`, {})
  n++
  document.body.innerHTML = await s.render({}, undefined, opts)
  await attachAll(document, loader(modules))
  return modules
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

test('an outer island doesn\'t wait for a nested island that holds none of its content (#465 review)', async () => {
  const outer = compile("@import cnt from './cnt.tscl'\n<script>\n  let n = state(0)\n</script>\n<button class=\"inc\" (click)=\"n++\">{{ n }}</button>\n<cnt />\n", { file: 'o.tscl', target: 'client' }).code
  const o = await importCode(outer, 'ic-wait-o', { './cnt.tscl?render': compile(parts.cnt!, { file: 'cnt.tscl', target: 'server', clientUrl: '/cnt.js' }).code })
  document.body.innerHTML = '<cl-island c="o" src="/o.js" s="{&quot;n&quot;:0}"><button class="inc" data-cl-e="0"><!--[0-->0<!--]--></button><!--[c0--><cl-island c="cnt" src="/cnt.js"><button class="cnt" data-cl-e="0"><!--[0-->0<!--]--></button></cl-island><!--]--></cl-island>'
  void attachAll(document, (src) => (src === '/o.js' ? Promise.resolve(o) : new Promise(() => {}))) // cnt never loads
  for (let i = 0; i < 10; i++) await tick()
  expect(document.querySelector('cl-island[c="o"]')!.hasAttribute('data-cl-ready')).toBe(true)
})

test('#465 review: a provided key named __proto__ reaches content the outer island re-renders', async () => {
  await mount("<script>\n  let n = state(0)\n</script>\n<button class=\"inc\" (click)=\"n++\">+</button>\n<protoProv v=\"p\"><protoShell [n]=\"n\" /></protoProv>\n")
  click('.inc')
  expect($('.shell').textContent).toBe('p:1')
})

test('#465 review: a provider that failed to load doesn\'t disable the island whose content reads it; both attach on retry', async () => {
  let fail = true
  const modules = await mount("<script>\n  let n = state(0)\n</script>\n<button class=\"inc\" (click)=\"n++\">+</button>\n<prov v=\"q\"><shell [n]=\"n\" /></prov>\n", {}, (m) => async (src) => {
    if (src === '/prov.js' && fail) throw new Error('offline')
    return m[src]
  })
  const page = document.querySelector('cl-island[c="page"]')!
  expect(page.hasAttribute('data-cl-error')).toBe(false)
  fail = false
  await attachAll(document, async (src) => modules[src] as any)
  expect(page.hasAttribute('data-cl-ready')).toBe(true)
  click('.inc')
  expect($('.shell').textContent).toContain('q:1')
})

test('#fallthrough: (click) on a component without @event click listens on what it renders; $event is the DOM event', async () => {
  await mount("<script>\n  let got = state('')\n</script>\n<clickable (click)=\"got = $event.type\"><b>x</b></clickable><p class=\"got\">{{ got }}</p>\n")
  click('.clk')
  expect($('.got').textContent).toBe('click')
})

test('#fallthrough: a child island that declares @event click: the handler gets the emitted value, once', async () => {
  await mount("<script>\n  let calls = state([])\n</script>\n<emitter (click)=\"calls = [...calls, String($event)]\" /><p class=\"calls\">{{ calls.join(',') }}</p>\n")
  click('.em')
  expect($('.calls').textContent).toBe('from-child')
})

test('#fallthrough: a child in an @if that comes back keeps exactly one listener', async () => {
  await mount("<script>\n  let n = state(0)\n  let show = state(true)\n</script>\n<button class=\"tog\" (click)=\"show = !show\">t</button>\n@if (show) { <clickable (click)=\"n++\">c</clickable> }\n<p class=\"n\">{{ n }}</p>\n")
  click('.tog')
  click('.tog')
  await attachAll(document)
  click('.clk')
  expect($('.n').textContent).toBe('1')
})

test('#review: a click before the child island attaches is not taken as a DOM click; the replay sends it once', async () => {
  let release = () => {}
  const held = new Promise<void>((r) => { release = r })
  const mounting = mount("<script>\n  let calls = state([])\n</script>\n<emitter (click)=\"calls = [...calls, String($event)]\" /><p class=\"calls\">{{ calls.join(',') }}</p>\n", {}, (modules) => async (src) => {
    if (src === '/emitter.js') await held
    return modules[src]
  })
  await vi.waitFor(() => { if (!document.querySelector('cl-island[c="page"][data-cl-ready]')) throw new Error('not yet') }, { timeout: 4000 })
  click('.em') // the page is ready, the emitter isn't: its module is still loading
  expect($('.calls').textContent).toBe('')
  release()
  await mounting
  for (let i = 0; i < 5; i++) await tick()
  expect($('.calls').textContent).toBe('from-child')
})

test('#review: (click) bound on a wrapper that declares nothing is its DOM click, once; an island in its content keeps its own events', async () => {
  await mount("<script>\n  let calls = state([])\n</script>\n<wrapper (click)=\"calls = [...calls, typeof $event === 'string' ? $event : $event.type]\"><emitter /></wrapper><p class=\"calls\">{{ calls.join(',') }}</p>\n")
  click('.em')
  expect($('.calls').textContent).toBe('click')
})

test('#review: a stateless wrapper that renders only an island: the bound wrapper declares nothing, so the DOM click', async () => {
  await mount("<script>\n  let calls = state([])\n</script>\n<onlyEmitter (click)=\"calls = [...calls, typeof $event === 'string' ? $event : $event.type]\" /><p class=\"calls\">{{ calls.join(',') }}</p>\n")
  click('.em')
  expect($('.calls').textContent).toBe('click')
})

test('<fragment> in an island: an @if branch of several elements switches, @for rows of several grow', async () => {
  await mount("<script>\n  let on = state(true)\n  let items = state([1])\n</script>\n<div class=\"box\"><button class=\"t\" (click)=\"on = !on\">t</button><button class=\"a\" (click)=\"items = [...items, items.length + 1]\">a</button>\n@if (on) { <fragment><i>x</i><i>y</i></fragment> } @else { <fragment><b>z</b></fragment> }\n<dl>@for (n of items; track n) { <fragment><dt>{{ n }}</dt><dd>v{{ n }}</dd></fragment> }</dl></div>\n")
  expect($('.box').querySelectorAll('i').length).toBe(2)
  click('.t')
  expect($('.box').querySelectorAll('i').length).toBe(0)
  expect($('.box').querySelectorAll('b').length).toBe(1)
  click('.t')
  expect($('.box').querySelectorAll('i').length).toBe(2)
  click('.a')
  click('.a')
  expect([...$('dl').children].map((e) => e.textContent).join(',')).toBe('1,v1,2,v2,3,v3')
  expect($('.box').querySelector('fragment')).toBeNull()
})

test('#review: an @extends island kept in place takes the new passed attributes; its own state-driven ones stay', async () => {
  await mount("<script>\n  let locked = state(false)\n</script>\n<div><button class=\"lock\" (click)=\"locked = !locked\">l</button><xbtn [disabled]=\"locked\" [title]=\"locked ? 'off' : 'on'\" /></div>\n")
  click('.xb')
  expect($('.xb').getAttribute('data-c')).toBe('1')
  expect($('.xb').hasAttribute('disabled')).toBe(false)
  click('.lock')
  await tick()
  expect($('.xb').hasAttribute('disabled')).toBe(true)
  expect($('.xb').getAttribute('title')).toBe('off')
  expect($('.xb').getAttribute('data-c')).toBe('1') // state kept, its attribute too
  expect($('.xb').textContent).toBe('1')
  click('.lock')
  await tick()
  expect($('.xb').hasAttribute('disabled')).toBe(false)
  expect($('.xb').getAttribute('title')).toBe('on')
})
