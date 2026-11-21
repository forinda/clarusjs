// @vitest-environment happy-dom
// Review of #301: each finding reproduced first.
import { beforeAll, expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { ClarusError } from '../../src/compiler/errors.ts'
import { island } from '../../src/runtime/server.ts'
import { h, registerViews } from '../../src/server/views.ts'
import { importCode } from '../helpers.ts'

beforeAll(() => registerViews({
  '/src/components/pill.tscl': async () => importCode(compile('@input text: string\n<span>{{ text }}</span>', { file: 'src/components/pill.tscl', target: 'server' }).code, 'r301-pill'),
  '/src/components/card.tscl': async () => importCode(compile('<section><slot /><slot name="foot" /></section>', { file: 'src/components/card.tscl', target: 'server' }).code, 'r301-card'),
}))
const err = (src: string) => { try { compile(src, { file: 'x.tscl', target: 'client' }) } catch (e) { return (e as ClarusError).message } return 'no error' }
async function mount(source: string) {
  const s = await importCode(compile(source, { file: 'x.tscl', target: 'server', clientUrl: '/x' }).code, 'r301-s', {}, true)
  const c = await importCode(compile(source, { file: 'x.tscl', target: 'client' }).code, 'r301-c')
  const html = s.render({}) as string
  document.body.innerHTML = html
  const island = document.querySelector('cl-island')!
  c.attach(island, {})
  return { html, $: <E = HTMLInputElement>(sel: string) => island.querySelector(sel) as unknown as E }
}

test('1: h() refuses cl-* tags (a cl-island would load a script from its src)', async () => {
  await expect(h('cl-island', { c: 'x', src: '//evil.example/x.js', p: '{}' })).rejects.toThrow(/h\(\): <cl-island>/)
  await expect(h('cl-head')).rejects.toThrow(/h\(\): <cl-head>/)
})

test('2: h() output can\'t be sent to the browser: a clear error naming h()', async () => {
  const out = await h('b', {}, ['x'])
  expect(() => island('x', '/x.js', { block: out }, '')).toThrow(/cannot send block to the browser: it is h\(\) output/)
})

test('3: a number field bound to an object field keeps what the user typed ("1.0" stays "1.0")', async () => {
  const { $ } = await mount('<script>\n  let form = state({ qty: 1.5 })\n</script>\n<div><input type="number" [(value)]="form.qty"></div>')
  const input = $('input')
  input.value = '1.0'
  input.dispatchEvent(new Event('input', { bubbles: true }))
  expect(input.value).toBe('1.0')
})

test('4: a checkbox group bound to a missing array renders and starts one', async () => {
  const { $, html } = await mount('<script>\n  let f = state({})\n</script>\n<div><input type="checkbox" value="a" [(value)]="f.tags"><p class="o">{{ (f.tags ?? []).join(",") }}</p></div>')
  expect(html).not.toContain(' checked')
  $('input').click()
  expect($('p.o').textContent).toBe('a')
})

test('5: selects render their selected options on the server (single and multiple), matching numbers as text; [multiple] works', async () => {
  const { html, $ } = await mount(`<script>
  let one = state(2); let many = state([1, 3]); let multi = state(true)
</script>
<div><select class="one" [(value)]="one"><option value="1">1</option><option value="2">2</option></select>
<select class="many" multiple [(value)]="many">@for (n of [1, 2, 3]; track n) { <option [value]="n">{{ n }}</option> }</select>
<select class="dyn" [multiple]="multi" [(value)]="many"><option value="1">1</option><option value="3">3</option></select></div>`)
  expect(html).toMatch(/<option value="2"[^>]* selected/)
  expect(html).not.toMatch(/<option value="1"[^>]* selected>1<\/option><option value="2"/)
  expect([...$<HTMLSelectElement>('select.many').options].map((o) => o.selected)).toEqual([true, false, true])
  const dyn = $<HTMLSelectElement>('select.dyn')
  dyn.options[0]!.selected = false
  dyn.dispatchEvent(new Event('change', { bubbles: true }))
  expect([...$<HTMLSelectElement>('select.many').options].map((o) => o.selected)).toEqual([false, false, true]) // wrote an array
})

test('6: implicit row names are matched as names (not $lastName), and a script can\'t declare one', () => {
  const code = compile('<script>\n  let user = state({ $lastName: "x" })\n</script>\n<ul>@for (u of [user]; track u) { <li>{{ u.$lastName }}</li> }</ul>', { file: 'x.tscl', target: 'client' }).code
  expect(code).not.toContain('__cl_derived')
  expect(err('<script>\n  let $count = state(0)\n</script>\n<p>x</p>')).toMatch(/^x\.tscl:2:7 "\$count" is a @for row name/)
})

test('7: h() throws on children it can\'t use: a void element\'s, and named slots on an element', async () => {
  await expect(h('img', { alt: '' }, ['x'])).rejects.toThrow(/h\(\): <img> can't have children/)
  await expect(h('div', {}, { default: 'x' } as never)).rejects.toThrow(/h\(\): named slots are for views/)
})

test('9: [(value)] with a bound [type] binds as text (a field component switching text and email); radio, checkbox and number need a static type', () => {
  const code = compile('<script>\n  let t = state("email"); let v = state("")\n</script>\n<input [type]="t" [(value)]="v">', { file: 'x.tscl', target: 'client' }).code
  expect(code).toContain('isComposing') // the text binding
})

test('CR-A: a track key can\'t use $count and the derived names (its key function has the item and $index only)', () => {
  expect(err('<script>\n  let xs = state([1])\n</script>\n<ul>@for (x of xs; track x + $count) { <li></li> }</ul>')).toMatch(/^x\.tscl:4:\d+ track can use the item and \$index/)
})

test('CR-B: a row name used only in an event handler is wired', async () => {
  const { $ } = await mount('<script>\n  let xs = state(["a", "b"]); let got = state("")\n</script>\n<div><ul>@for (x of xs; track x) { <li><button (click)="got = x + ($last ? \'!\' : \'\') + $count">{{ x }}</button></li> }</ul><p class="o">{{ got }}</p></div>')
  ;(document.querySelectorAll('button')[1] as HTMLElement).click()
  expect($('p.o').textContent).toBe('b!2')
})

test('CR-C: input types are case-insensitive (NUMBER is a number field; Radio a radio)', async () => {
  const { $ } = await mount('<script>\n  let n = state(1); let p = state("a")\n</script>\n<div><input class="n" type="NUMBER" [(value)]="n"><input class="r" type="Radio" value="b" [(value)]="p"><p class="o">{{ typeof n }} {{ p }}</p></div>')
  const n = $('input.n'); n.value = '5'; n.dispatchEvent(new Event('input', { bubbles: true }))
  $('input.r').click()
  expect($('p.o').textContent).toBe('number b')
})

test('CR-D: removing an earlier row doesn\'t flip $last off and on (an @if ($last) branch stays, with its state)', async () => {
  const { $ } = await mount('<script>\n  let xs = state(["a", "b"])\n</script>\n<div><ul>@for (x of xs; track x) { <li>@if ($last) { <input class="last"> }</li> }</ul><button class="rm" (click)="xs = [\'b\']">rm</button></div>')
  const input = $('input.last')
  input.value = 'typed'
  ;($('button.rm') as unknown as HTMLElement).click()
  expect($('input.last')).toBe(input) // the same element, not recreated
  expect($('input.last').value).toBe('typed')
})

test('CR-E: <input type="email" multiple> bound to an array doesn\'t crash (only selects have options)', async () => {
  const { $ } = await mount('<script>\n  let to = state(["a@x.io", "b@x.io"])\n</script>\n<div><input type="email" multiple [value]="to"></div>')
  expect($('input').value).toBe('a@x.io,b@x.io')
})

test('CR-F: options added later by @for are selected when the bound array has them', async () => {
  const { $ } = await mount('<script>\n  let opts = state(["a"]); let picked = state(["b"])\n</script>\n<div><select multiple [(value)]="picked">@for (o of opts; track o) { <option [value]="o">{{ o }}</option> }</select><button (click)="opts = [\'a\', \'b\']">add</button></div>')
  ;($('button') as unknown as HTMLElement).click()
  expect([...$<HTMLSelectElement>('select').options].map((o) => o.selected)).toEqual([false, true])
})

test('CR-G: h() with two failing named slots rejects once, leaving no unhandled rejection', async () => {
  const unhandled: unknown[] = []
  const onUnhandled = (e: unknown) => unhandled.push(e)
  process.on('unhandledRejection', onUnhandled)
  await expect(h('components/card', {}, { default: Promise.reject(new Error('a')), foot: Promise.reject(new Error('b')) } as never)).rejects.toThrow()
  await new Promise((r) => setTimeout(r, 20))
  process.off('unhandledRejection', onUnhandled)
  expect(unhandled).toEqual([])
})
