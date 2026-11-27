// @vitest-environment happy-dom
// PR #647 review (CodeRabbit): each case a finding, failing before its fix.
import { EditorState, Plugin, AllSelection, TextSelection } from 'prosemirror-state'
import { effect } from 'clarusjs/runtime'
import { afterEach, expect, test, vi } from 'vitest'
import { createEditor } from '../src/core/editor.ts'
import { defineExtension } from '../src/core/extension.ts'
import { buildSchema } from '../src/core/schema.ts'
import { fromText } from '../src/core/from-text.ts'
import { onEditor, register } from '../src/core/registry.ts'
import { content } from '../src/behaviours/content.ts'
import { base } from '../src/extensions/base.ts'
import { composerExtensions } from '../src/extensions/composer.ts'
import { renderHTML, validate } from '../src/server.ts'

afterEach(() => { document.body.innerHTML = '' })
const mount = () => { const el = document.createElement('div'); document.body.append(el); return el }

test('a render spec never carries an event handler or a script-like tag, whatever an attribute holds (server and browser)', () => {
  const card = defineExtension({ name: 'card', nodes: { card: { attrs: { label: {} }, inline: true, group: 'inline', render: (n) => ['span', n.attrs.label] } } })
  const exts = [base, card]
  const evil = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'card', attrs: { label: ['img', { src: '/a.png', onerror: 'alert(1)' }] } }, { type: 'card', attrs: { label: ['script', 'alert(2)'] } }] }] }
  const html = renderHTML(evil, exts)
  expect(html).not.toMatch(/onerror|<script/i)
  const el = mount()
  content(el, { value: evil, format: 'json', extensions: exts })
  expect(el.innerHTML).not.toMatch(/onerror|<script/i)
  expect(el.querySelector('img')?.getAttribute('src')).toBe('/a.png') // the safe part stays
})

test('renderHTML applies marks to inline nodes too (a bold mention), as the browser does', () => {
  const json = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'mention', attrs: { id: 'u', label: 'Mara' }, marks: [{ type: 'strong' }] }] }] }
  expect(renderHTML(json, composerExtensions())).toBe('<p><strong><span data-mention="u">@Mara</span></strong></p>')
})

test('a schema with no doc node takes its first node as the top', () => {
  const tiny = defineExtension({ name: 'tiny', nodes: { root: { content: 'text*', render: () => ['div', 0] }, text: {} } })
  expect(buildSchema([tiny]).topNodeType.name).toBe('root')
})

test('plain text with CRLF line endings (a native form post) makes the same paragraphs as LF, the caret mapped', () => {
  const schema = buildSchema(composerExtensions())
  const lf = fromText(schema, 'a\n\nb', 3)
  const crlf = fromText(schema, 'a\r\n\r\nb', 5)
  expect(crlf.doc.toJSON()).toEqual(lf.doc.toJSON())
  expect(crlf.pos).toBe(lf.pos)
  expect(validate('a\r\nb', composerExtensions(), { format: 'text' })).toEqual(validate('a\nb', composerExtensions(), { format: 'text' }))
})

test('content() renders nothing for a value whose root is not a document', () => {
  const el = mount()
  content(el, { value: { type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] }, format: 'json', extensions: composerExtensions() })
  expect(el.innerHTML).toBe('')
})

test('the value follows a change a plugin appends to a selection-only transaction; value is set before state', async () => {
  const stamp = defineExtension({ name: 'stamp', plugins: () => [new Plugin({ appendTransaction: (trs, _o, s) => (trs.some((t) => t.getMeta('stamp')) ? s.tr.insertText('!', 1) : null) })] })
  const ed = createEditor({ element: mount(), extensions: [...composerExtensions(), stamp], format: 'json' })
  const seen: unknown[] = []
  const stop = effect(() => { ed.state.get(); seen.push(ed.value.get()) })
  ed.view.dispatch(ed.view.state.tr.setMeta('stamp', true))
  await new Promise((r) => setTimeout(r, 0)) // effects run after
  stop()
  expect(ed.view.state.doc.textContent).toBe('!')
  expect(ed.length.get()).toBe(1)
  expect(JSON.stringify(seen.at(-1))).toContain('!') // state's subscribers see the new value
})

test('a field renamed after registering is not wired under its new id', () => {
  const el = mount()
  el.id = 'a'
  const fake = {} as any
  const undo = register(el, fake)
  el.id = 'b'
  const wire = vi.fn()
  onEditor('b', wire)
  expect(wire).not.toHaveBeenCalled()
  undo()
})

test('select all, then code block: no RangeError; every line goes into one block', () => {
  const ed = createEditor({ element: mount(), extensions: composerExtensions(), format: 'json', value: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'b' }] }] } })
  ed.view.dispatch(ed.view.state.tr.setSelection(new AllSelection(ed.view.state.doc)))
  expect(() => ed.can('codeBlock')).not.toThrow()
  expect(ed.run('codeBlock')).toBe(true)
  expect(ed.view.state.doc.firstChild!.textContent).toBe('a\nb')
})

test('Markdown shortcuts leave inline code literal and never swallow a mention or a line break', async () => {
  const { inputRules } = await import('prosemirror-inputrules')
  const exts = composerExtensions()
  const schema = buildSchema(exts)
  const plugin = inputRules({ rules: exts.flatMap((e) => e.inputRules?.(schema) ?? []) })
  const typeInto = (state: EditorState, text: string) => {
    const view = { get state() { return state }, dispatch(tr: any) { state = state.apply(tr) }, composing: false }
    for (const ch of text) {
      const { from, to } = state.selection
      if (!plugin.props.handleTextInput!.call(plugin, view as any, from, to, ch, () => state.tr)) view.dispatch(state.tr.insertText(ch, from, to))
    }
    return state
  }
  // inside inline code
  const code = schema.marks.code!.create()
  let s = EditorState.create({ schema, doc: schema.node('doc', null, [schema.node('paragraph', null, [schema.text('x', [code])])]) })
  s = s.apply(s.tr.setSelection(TextSelection.create(s.doc, 2)).addStoredMark(code))
  s = typeInto(s, '**b**')
  expect(s.doc.textContent).toBe('x**b**')
  // around a mention
  const mention = schema.nodes.mention!.create({ id: 'u', label: 'Mara' })
  let m = EditorState.create({ schema, doc: schema.node('doc', null, [schema.node('paragraph', null, [schema.text('**hi '), mention, schema.text(' there*')])]) })
  m = m.apply(m.tr.setSelection(TextSelection.create(m.doc, m.doc.content.size - 1)))
  m = typeInto(m, '*')
  expect(m.doc.firstChild!.childCount).toBe(3) // the mention is still there
})
