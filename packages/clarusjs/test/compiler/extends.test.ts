// @extends <tag>: a component stands for a native element and takes all of its attributes, onto its root.
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { ClarusError } from '../../src/compiler/errors.ts'
import { importCode } from '../helpers.ts'

const server = (src: string) => compile(src, { file: 'btn.tscl', target: 'server', clientUrl: '/btn.js' }).code
const render = async (src: string, props: Record<string, unknown>) => (await importCode(server(src), 'ext')).render(props) as string
const error = (src: string) => { try { server(src); return '' } catch (e) { return e instanceof ClarusError ? e.message : String(e) } }
const passed = { disabled: true, form: 'f', name: 'go', value: '1', id: 'x', href: '/nope' }

test("the element's attributes land on its root; without @extends only the usual ones do", async () => {
  const src = '<button type="button"><slot /></button>\n'
  const html = await render(`@extends button\n${src}`, passed)
  for (const a of [' disabled', ' form="f"', ' name="go"', ' value="1"', ' id="x"', ' type="button"']) expect(html).toContain(a)
  expect(html).not.toContain('href') // not a button attribute
  const plain = await render(src, passed)
  expect(plain).toContain(' id="x"')
  expect(plain).not.toContain('form=')
})

test("the root's own attributes win; a declared input isn't an attribute", async () => {
  const html = await render('@extends input\n@input value: string = ""\n<input type="text" [value]="value.toUpperCase()" />\n', { type: 'email', value: 'a', placeholder: 'p', required: true })
  expect(html).toContain('type="text"')
  expect(html).toContain('value="A"')
  expect(html).toContain('placeholder="p"')
  expect(html).toContain(' required')
})

test('an @if … @else root of that element, in a stateless component', async () => {
  const html = await render('@extends a\n@input on: boolean = true\n@if (on) { <a href="/1">x</a> } @else { <a href="/2">y</a> }\n', { target: '_blank', download: 'f' })
  expect(html).toContain('target="_blank"')
  expect(html).toContain('download="f"')
})

test('errors: unknown tag, wrong root, fragment root, an island without a plain element root', () => {
  expect(error('@extends blink\n<button>x</button>\n')).toMatch(/btn\.tscl:1:\d+ .*@extends blink.*button, input/)
  expect(error('@extends button\n<a href="/">x</a>\n')).toMatch(/btn\.tscl:2:1 .*@extends button: the root must be a <button>/)
  expect(error('@extends button\n<fragment><button>x</button></fragment>\n')).toMatch(/btn\.tscl:2:1 .*@extends button: the root must be a <button>/)
  expect(error('@extends button\n<script>\n  let n = state(0)\n</script>\n@if (n) { <button>a</button> } @else { <button>b</button> }\n')).toMatch(/btn\.tscl:5:1 .*an island's root must be one <button>/)
  expect(error('@extends button\n@extends input\n<button>x</button>\n')).toMatch(/btn\.tscl:2:1 .*one @extends/)
})

test('an island with one <button> root takes the attributes too', async () => {
  const html = await render('@extends button\n<script>\n  let n = state(0)\n</script>\n<button type="button" (click)="n++">{{ n }}</button>\n', { disabled: true, name: 'n' })
  expect(html).toContain(' disabled')
  expect(html).toContain('name="n"')
})

test('#review: an attribute the root writes itself is written once, its own', async () => {
  const html = await render('@extends button\n<button type="button" disabled>b</button>\n', { type: 'submit', disabled: false, title: 't' })
  expect(html.match(/ type=/g)).toHaveLength(1)
  expect(html).toContain('type="button"')
  expect(html.match(/ disabled/g)).toHaveLength(1)
  expect(html).toContain('title="t"')
})

test('#review: a root with its own [...] spread is an error with @extends (the passed attributes would be dropped)', () => {
  expect(error('@extends a\n@input rest: Record<string, string> = {}\n<a [...]="rest">x</a>\n')).toMatch(/btn\.tscl:3:1 .*\[\.\.\.\]/)
})
