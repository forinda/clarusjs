// @vitest-environment happy-dom
// PR #648 review (CodeRabbit on the editor): each case a finding, failing before its fix.
import { EditorState, TextSelection } from 'prosemirror-state'
import { afterEach, expect, test, vi } from 'vitest'
import { createEditor } from '../src/core/editor.ts'
import { defineExtension } from '../src/core/extension.ts'
import { buildSchema } from '../src/core/schema.ts'
import { plainText } from '../src/core/plain-text.ts'
import { onEditor, register } from '../src/core/registry.ts'
import { content } from '../src/behaviours/content.ts'
import { base } from '../src/extensions/base.ts'
import { composerExtensions } from '../src/extensions/composer.ts'
import { renderHTML, validate } from '../src/server.ts'

afterEach(() => { document.body.innerHTML = '' })
const mount = () => { const el = document.createElement('div'); document.body.append(el); return el }
const docWith = (...inline: object[]) => ({ type: 'doc', content: [{ type: 'paragraph', content: inline }] })

test('security: a malformed tag name built from data is refused, and renders as nothing', () => {
  const heading = defineExtension({ name: 'hd', nodes: { hd: { attrs: { level: { default: '1' } }, content: 'text*', group: 'block', render: (n) => ['h' + n.attrs.level, 0] } } })
  const hd = (level: string) => ({ type: 'doc', content: [{ type: 'hd', attrs: { level }, content: [{ type: 'text', text: 'Title' }] }] })
  const bad = hd('1 onmouseover=alert(1)')
  expect(validate(bad, [base, heading])).toEqual({ ok: false, error: 'invalid tag: h1 onmouseover=alert(1)' })
  expect(renderHTML(bad, [base, heading])).not.toMatch(/onmouseover/)
  const el = mount()
  content(el, { value: bad, format: 'json', extensions: [base, heading] })
  expect(el.innerHTML).not.toMatch(/onmouseover/)
  expect(el.textContent).toBe('Title') // refused as a tag, its text stays
  expect(validate(hd('2'), [base, heading]).ok).toBe(true)
  expect(renderHTML(hd('2'), [base, heading])).toBe('<h2>Title</h2>')
})

test('security: a malformed attribute name built from data is refused, and never written', () => {
  const data = defineExtension({ name: 'dt', nodes: { dt: { attrs: { key: {}, value: {} }, inline: true, group: 'inline', render: (n) => ['span', { ['data-' + n.attrs.key]: n.attrs.value }, 'x'] } } })
  const bad = docWith({ type: 'dt', attrs: { key: 'x onmouseover', value: 'alert(1)' } })
  expect(validate(bad, [base, data])).toEqual({ ok: false, error: 'invalid attribute: data-x onmouseover' })
  expect(renderHTML(bad, [base, data])).toBe('<p><span>x</span></p>')
  expect(renderHTML(docWith({ type: 'dt', attrs: { key: 'x', value: 'y' } }), [base, data])).toBe('<p><span data-x="y">x</span></p>')
})

test('validate: only a document root passes; a label that breaks its render is an error result, not a throw', () => {
  expect(validate({ type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] }, composerExtensions())).toEqual({ ok: false, error: 'not a document: paragraph' })
  const weird = docWith({ type: 'mention', attrs: { id: 'u', label: { toString: null } } })
  expect(validate(weird, composerExtensions()).ok).toBe(false)
})

test('plainText from HTML keeps every line break in the content', () => {
  expect(plainText('<p>a<br><br>b</p>', 'html')).toBe('a\n\nb')
  expect(plainText('<p>a<br></p><p>b</p>', 'html')).toBe('a\n\n\nb')
  expect(plainText('<p>a</p>\n<p>b</p>', 'html')).toBe('a\n\nb') // whitespace between blocks is the source's, not content
})

test('run and can on a name no extension defines are false, even an Object.prototype one; addPlugin publishes state', async () => {
  const ed = createEditor({ element: mount(), extensions: composerExtensions(), format: 'json' })
  expect(ed.run('toString')).toBe(false)
  expect(ed.can('hasOwnProperty')).toBe(false)
  const before = ed.state.get()
  const remove = ed.addPlugin({})
  expect(ed.state.get()).not.toBe(before)
  const added = ed.state.get()
  remove()
  expect(ed.state.get()).not.toBe(added)
})

test('unlink with just the caret inside a link removes that whole link', () => {
  const ed = createEditor({ element: mount(), extensions: composerExtensions(), format: 'json', value: docWith({ type: 'text', text: 'go ' }, { type: 'text', text: 'here', marks: [{ type: 'link', attrs: { href: '/x' } }] }, { type: 'text', text: ' now' }) })
  ed.view.dispatch(ed.view.state.tr.setSelection(TextSelection.create(ed.view.state.doc, 6)))
  expect(ed.active('link')).toBe(true)
  expect(ed.run('unlink')).toBe(true)
  expect(JSON.stringify(ed.view.state.doc.toJSON())).not.toContain('link')
})

test('a Markdown shortcut keeps the marks already inside it (**a _b_ c**)', async () => {
  const { inputRules } = await import('prosemirror-inputrules')
  const exts = composerExtensions()
  const schema = buildSchema(exts)
  const plugin = inputRules({ rules: exts.flatMap((e) => e.inputRules?.(schema) ?? []) })
  let state = EditorState.create({ schema, doc: schema.node('doc', null, [schema.node('paragraph')]) })
  const view = { get state() { return state }, dispatch(tr: any) { state = state.apply(tr) }, composing: false }
  for (const ch of '**a _b_ c**') {
    const { from, to } = state.selection
    if (!plugin.props.handleTextInput!.call(plugin, view as any, from, to, ch, () => state.tr)) view.dispatch(state.tr.insertText(ch, from, to))
  }
  expect(state.doc.textContent).toBe('a b c')
  const b = state.doc.firstChild!.child(1)
  expect([b.text, b.marks.map((m) => m.type.name).sort()]).toEqual(['b', ['em', 'strong']])
})

test('a part attaching late finds the newest field registered under its id, and one renamed since', () => {
  document.body.innerHTML = '<div id="msg"></div><div id="msg"></div>'
  const [a, b] = [...document.querySelectorAll('div')]
  const edA = { name: 'a' } as any, edB = { name: 'b' } as any
  const offA = register(a!, edA)
  const offB = register(b!, edB)
  const wire = vi.fn()
  onEditor('msg', wire)
  expect(wire.mock.calls[0]![0]).toBe(edB)
  offB(); offA()
  const c = mount()
  c.id = 'first'
  const offC = register(c, edA)
  c.id = 'renamed'
  const late = vi.fn()
  onEditor('first', late)
  expect(late).toHaveBeenCalledTimes(1)
  offC()
})

test('security: a namespaced URL attribute or SVG animation tag gets the same URL check as a plain one', () => {
  const XLINK = 'http://www.w3.org/1999/xlink'
  const SVG = 'http://www.w3.org/2000/svg'
  const icon = defineExtension({ name: 'ic', nodes: { ic: { attrs: { url: {} }, inline: true, group: 'inline', render: (n) => [`${SVG} svg`, [`${SVG} a`, { [`${XLINK} xlink:href`]: n.attrs.url, [`${XLINK} href`]: n.attrs.url }, [`${SVG} animate`, { attributeName: 'href', values: n.attrs.url }]]] } } })
  const bad = docWith({ type: 'ic', attrs: { url: 'javascript:alert(1)' } })
  expect(validate(bad, [base, icon]).ok).toBe(false)
  const el = mount()
  content(el, { value: bad, format: 'json', extensions: [base, icon] })
  expect(el.innerHTML).not.toContain('javascript')
  expect(renderHTML(bad, [base, icon])).not.toContain('javascript')
  expect(validate(docWith({ type: 'ic', attrs: { url: '/icons.svg#x' } }), [base, icon]).ok).toBe(true)
})
