// <fragment>: groups children without rendering an element, anywhere in a template.
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { ClarusError } from '../../src/compiler/errors.ts'
import { importCode } from '../helpers.ts'

const server = (src: string, file = 'x.tscl') => compile(src, { file, target: 'server', clientUrl: '/x.js' }).code
const render = async (src: string, props = {}) => (await importCode(server(src), 'frag')).render(props)
const error = (src: string) => { try { server(src); return '' } catch (e) { return e instanceof ClarusError ? e.message : String(e) } }

test('a fragment renders its children and nothing else', async () => {
  expect(await render('<fragment><a>1</a><b>2</b></fragment>\n')).toBe('<a>1</a><b>2</b>')
  expect(await render('<ul><fragment><li>a</li><li>b</li></fragment></ul>\n')).toBe('<ul><li>a</li><li>b</li></ul>')
})

test('inside @if branches and @for rows', async () => {
  expect((await render("@input on: boolean = true\n@if (on) { <fragment><i>x</i><i>y</i></fragment> }\n")).trim()).toBe('<i>x</i><i>y</i>')
  expect((await render("@for (n of [1, 2]; track n) { <fragment><dt>{{ n }}</dt><dd>v</dd></fragment> }\n")).replace(/\s+/g, '')).toBe('<dt>1</dt><dd>v</dd><dt>2</dt><dd>v</dd>')
})

test("a fragment takes no attributes; a component can't be named fragment", () => {
  expect(error('<fragment class="x"><a>1</a></fragment>\n')).toMatch(/x\.tscl:1:1 .*<fragment> renders no element/)
  expect(error("@import fragment from './f.tscl'\n<fragment />\n")).toMatch(/x\.tscl:1:1 .*fragment is reserved/)
})

test('in an island, a fragment in an @if branch and @for rows switches and grows', async () => {
  const src = "<script>\n  let on = state(true)\n  let items = state([1])\n</script>\n<button (click)=\"on = !on\">t</button><button (click)=\"items = [...items, items.length + 1]\">a</button>\n@if (on) { <fragment><i>x</i><i>y</i></fragment> } @else { <fragment><b>z</b></fragment> }\n@for (n of items; track n) { <fragment><dt>{{ n }}</dt><dd>v</dd></fragment> }\n"
  expect(compile(src, { file: 'i.tscl', target: 'client' }).code).toContain('export function attach')
})

test('a component whose root is a fragment takes no attributes, even with one element inside', async () => {
  const mod = await importCode(server('<fragment><div>x</div></fragment>\n'), 'frag-root')
  expect(mod.render({ id: 'a', 'data-x': '1' }).trim()).toBe('<div>x</div>')
})

test('#review: <cl-head> beside a fragment root: still a fragment root (nothing falls through)', async () => {
  const mod = await importCode(server('<cl-head><title>t</title></cl-head>\n<fragment><div>x</div></fragment>\n'), 'frag-head')
  expect(mod.render({ id: 'a' })).not.toContain('id="a"')
})

test('a root <fragment> renders like the same nodes at the top level: no whitespace between them', async () => {
  const top = await render('<a href="/1">1</a>\n<a href="/2">2</a>\n')
  expect(await render('<fragment>\n<a href="/1">1</a>\n<a href="/2">2</a>\n</fragment>\n')).toBe(top)
})
