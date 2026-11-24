// #463: attributes passed to a component land on its root element (Vue's attribute fallthrough). Attribute-like names
// only (id, role, tabindex, hidden, lang, dir, style, data-*, aria-*), and only when the child doesn't declare them as
// inputs; the root's own attributes win, except style and ARIA id lists, which merge.
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { importCode, unscoped } from '../helpers.ts'

const serve = (src: string, file: string) => compile(src, { file, target: 'server', scope: file.slice(0, 1), clientUrl: `/${file}.js` }).code
async function render(child: string, page: string) {
  const { render } = await importCode(serve(page, 'page.tscl'), 'ft', { './child.tscl': serve(child, 'child.tscl') })
  return unscoped(await render({}))
}
const tag = (html: string, name: string) => html.match(new RegExp(`<${name}[^>]*>`))![0]

test('static and bound attributes on a component land on its root element', async () => {
  const html = await render('@input label: string\n<button type="button">{{ label }}</button>\n',
    "@import child from './child.tscl'\n<child [label]=\"'Save'\" id=\"save\" data-test=\"save-btn\" [aria-controls]=\"'panel-' + 1\" hidden />\n")
  expect(tag(html, 'button')).toBe('<button type="button" id="save" data-test="save-btn" aria-controls="panel-1" hidden>')
  expect(html).toContain('>Save</button>')
})

test('the root\'s own attribute wins; style and ARIA id lists merge; a declared input is never an attribute', async () => {
  const child = '@input id: string = \'own-input\'\n<div role="region" aria-describedby="hint" style="color: red" [title]="id"><slot /></div>\n'
  const html = await render(child, "@import child from './child.tscl'\n<child id=\"mine\" role=\"note\" aria-describedby=\"extra\" style=\"margin: 0\">x</child>\n")
  const div = tag(html, 'div')
  expect(div).toContain('role="region"') // own wins
  expect(div).not.toContain('role="note"')
  expect(div).toContain('aria-describedby="hint extra"') // joined
  expect(div).toMatch(/style="color: red;? ?margin: 0;?"|style="margin: 0;? ?color: red;?"/)
  expect(div).toContain('title="mine"') // id is the child's input
  expect(div).not.toContain('id=')
})

test('other names are not attributes: a page\'s data or a layout\'s path never land on the root', async () => {
  const { render: r } = await importCode(serve('<main>page</main>\n', 'page.tscl'), 'ft2')
  expect(unscoped(await r({ user: 'ada', path: '/x', title: 'T', 'data-x': '1' }))).toBe('<main data-x="1">page</main>')
})

test('several top-level elements: nothing falls through (no root to choose)', async () => {
  const html = await render('<p>a</p>\n<p>b</p>\n', "@import child from './child.tscl'\n<child id=\"x\" />\n")
  expect(html).toBe('<p>a</p><p>b</p>')
})

test('a root that is itself a component passes them on', async () => {
  const outer = serve("@import inner from './inner.tscl'\n<inner />\n", 'outer.tscl')
  // inner, as a stub showing what it was given
  const inner = 'export function render(props) { return "<span>" + JSON.stringify(props) + "</span>" }'
  const { render: r } = await importCode(outer, 'ft3', { './inner.tscl': inner })
  expect(await r({ 'data-k': 'v', user: 'ada' })).toBe('<span>{"data-k":"v"}</span>')
})
