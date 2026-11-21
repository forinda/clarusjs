// @vitest-environment happy-dom
// Review of #301: each finding reproduced first.
import { beforeAll, expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { ClarusError } from '../../src/compiler/errors.ts'
import { island } from '../../src/runtime/server.ts'
import { h, registerViews } from '../../src/server/views.ts'
import { importCode } from '../helpers.ts'

beforeAll(() => registerViews({ '/src/components/pill.tscl': async () => importCode(compile('@input text: string\n<span>{{ text }}</span>', { file: 'src/components/pill.tscl', target: 'server' }).code, 'r301-pill') }))
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
