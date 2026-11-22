// @vitest-environment happy-dom
// #405: [...]="attrs" spreads an object of attributes onto an element. Written attributes win (case-insensitively);
// class and style merge; each value is escaped and URL-checked like [attr]; event handlers, srcdoc, invalid names,
// JSX names and object values are dropped (warned on the server); refused on elements that load things.
import { afterEach, expect, test, vi } from 'vitest'
import { compile, ClarusError } from '../../src/compiler/index.ts'
import { parse as parseProps } from '../../src/runtime/serialize.ts'
import { importCode } from '../helpers.ts'

afterEach(() => vi.restoreAllMocks())
const html = async (src: string, props: object = {}) => {
  const { code } = compile(src, { file: 'c.tscl', target: 'server', scope: 's', clientUrl: '/c.js' })
  return ((await importCode(code, 'spr', {}, true)) as { render: (p: object) => string }).render(props).replace(/ ?cl-c-s/g, '').replace(/ class=""/g, '')
}
const error = (src: string): string => {
  try { compile(src, { file: 'c.tscl', target: 'server' }) } catch (e) { if (e instanceof ClarusError) return e.message.replace(/^c\.tscl:/, ''); throw e }
  return 'no error'
}

test('every key becomes an attribute, escaped, with the [attr] rules for booleans, null and URLs', async () => {
  const out = await html('@input a: Record<string, unknown>\n<div><input [...]="a" /></div>', { a: { type: 'text', 'aria-label': 'Name "x"', required: true, disabled: false, title: null, maxlength: 10, 'data-id': 'q' } })
  expect(out).toBe('<div><input type="text" aria-label="Name &quot;x&quot;" required maxlength="10" data-id="q" /></div>'.replace(' />', '>'))
  expect(await html('@input a: Record<string, unknown>\n<div><a [...]="a">x</a></div>', { a: { href: 'javascript:alert(1)' } })).toBe('<div><a href="about:invalid#unsafe">x</a></div>')
})

test('attributes written on the element win, in any order and case; class and style merge, the spread\'s first', async () => {
  const out = await html('@input a: Record<string, unknown>\n<div><a [...]="a" title="written" class="btn" style="margin: 0">x</a></div>', { a: { TITLE: 'data', Href: '/go', class: { primary: true }, style: { color: 'red' } } })
  expect(out).toBe('<div><a Href="/go" title="written" style="color: red; margin: 0;" class="primary btn">x</a></div>')
})

test('event handlers, srcdoc, invalid names, className/htmlFor and object values are dropped, with a warning', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const out = await html('@input a: Record<string, unknown>\n<div><p [...]="a">x</p></div>', { a: { onclick: 'steal()', ONLOAD: 'x', srcdoc: '<b>', 'a b': 1, '"x': 1, className: 'c', htmlFor: 'f', aria: { label: 'x' }, fn: () => 1, id: 'kept' } })
  expect(out).toBe('<div><p id="kept">x</p></div>')
  const said = warn.mock.calls.map((c) => String(c[0])).join('\n')
  for (const key of ['onclick', 'ONLOAD', 'srcdoc', 'a b', 'className', 'htmlFor', 'aria', 'fn']) expect(said).toContain(`'${key}'`)
  expect(said).toContain('c.tscl:2:9')
})

test('an empty class or style from a spread adds no attribute', async () => {
  expect(await html('@input a: Record<string, unknown>\n<div><p [...]="a">x</p></div>', { a: { id: 'i' } })).toBe('<div><p id="i">x</p></div>')
})

test('in an island, a spread follows state: new and changed keys set, vanished keys removed, written ones kept', async () => {
  const src = "<script>\n  let on = state(false)\n</script>\n<button type=\"button\" title=\"written\" [...]=\"on ? { 'aria-pressed': 'true', title: 'x', 'data-on': '' } : { 'data-off': '1' }\" (click)=\"on = !on\">x</button>\n"
  const s = await importCode(compile(src, { file: 'i.tscl', target: 'server', scope: 'i', clientUrl: '/i.js' }).code, 'spr-is', {}, true)
  const c = await importCode(compile(src, { file: 'i.tscl', target: 'client', scope: 'i' }).code, 'spr-ic')
  document.body.innerHTML = s.render({})
  const root = document.querySelector('cl-island')!
  const button = root.querySelector('button')!
  expect(button.getAttribute('data-off')).toBe('1')
  c.attach(root, parseProps(root.getAttribute('p')!))
  button.click()
  expect([button.getAttribute('aria-pressed'), button.getAttribute('data-on'), button.hasAttribute('data-off'), button.getAttribute('title')]).toEqual(['true', '', false, 'written'])
  button.click()
  expect([button.hasAttribute('aria-pressed'), button.hasAttribute('data-on'), button.getAttribute('data-off')]).toEqual([false, false, '1'])
})

test('refused where a spread could load something, twice on one element, and the forms that look like it', () => {
  const VOID = ['embed', 'base', 'link', 'meta']
  for (const tag of ['iframe', 'frame', 'embed', 'object', 'base', 'link', 'meta']) {
    const src = VOID.includes(tag) ? `<${tag} [...]="a">` : `<${tag} [...]="a"></${tag}>`
    expect(error(`@input a: object\n${src}`), tag).toMatch(new RegExp(`^2:${tag.length + 3} \\[\\.\\.\\.\\] can't spread onto <${tag}>`))
  }
  // An inline script (a plain <script> is the component's own) already takes static attributes only.
  expect(error('@input a: object\n<script inline [...]="a"></script>')).toMatch(/^2:16 an inline script takes static attributes only/)
  expect(error('@input a: object\n<p [...]="a" [...]="a">x</p>')).toMatch(/^2:14 one \[\.\.\.\] per element/)
  expect(error('@input a: object\n<p {...a}>x</p>')).toMatch(/^2:4 \{\.\.\.a\} isn't a binding: spread with \[\.\.\.\]="a"/)
  expect(error('@input a: string\n<p [aria.label]="a">x</p>')).toMatch(/^2:4 \[aria\.label\]: only class\. and style\. take a \. \(\[class\.name\], \[style\.prop\]\)/)
})
