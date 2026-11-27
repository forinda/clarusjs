// The composer's extensions, without a view: marks and their commands, Markdown input rules, links (URL-checked),
// mentions round-tripping through the server, and what survives a paste from Word or Google Docs.
import { readFileSync } from 'node:fs'
import { EditorState, TextSelection, type Command, type Plugin } from 'prosemirror-state'
import { inputRules } from 'prosemirror-inputrules'
import { expect, test } from 'vitest'
import { buildSchema } from '../src/core/schema.ts'
import { bold, code, italic } from '../src/extensions/marks.ts'
import { link } from '../src/extensions/link.ts'
import { mention } from '../src/extensions/mention.ts'
import { markdownShortcuts } from '../src/extensions/markdown-shortcuts.ts'
import { composerExtensions } from '../src/extensions/composer.ts'
import { renderHTML, validate } from '../src/server.ts'

const exts = composerExtensions()
const schema = buildSchema(exts)
const commands = Object.assign({}, ...exts.map((e) => e.commands?.(schema) ?? {}))

/** A state holding one paragraph of `text`, with the whole text selected (or the caret at the end). */
function stateWith(text: string, select = true) {
  const doc = schema.node('doc', null, [schema.node('paragraph', null, text ? [schema.text(text)] : [])])
  const state = EditorState.create({ doc, schema })
  return state.apply(state.tr.setSelection(TextSelection.create(state.doc, select ? 1 : 1 + text.length, 1 + text.length)))
}
const run = (state: EditorState, command: Command) => { let next = state; command(state, (tr) => { next = state.apply(tr) }); return next }
const marksAt = (state: EditorState, pos = 1) => state.doc.resolve(pos + 1).marks().map((m) => m.type.name)

test('bold, italic and code toggle on and off', () => {
  for (const [name, mark] of [['bold', 'strong'], ['italic', 'em'], ['code', 'code']]) {
    const on = run(stateWith('hi'), commands[name]())
    expect(marksAt(on)).toEqual([mark])
    expect(marksAt(run(on, commands[name]()))).toEqual([])
  }
})

/** Types `text` one character at a time through the input rules, as a view would. */
function type(state: EditorState, text: string) {
  const plugin = inputRules({ rules: exts.flatMap((e) => e.inputRules?.(schema) ?? []) }) as Plugin
  const view = { get state() { return state }, dispatch(tr: any) { state = state.apply(tr) }, composing: false }
  for (const ch of text) {
    const { from, to } = state.selection
    const handled = plugin.props.handleTextInput!.call(plugin, view as any, from, to, ch, () => state.tr)
    if (!handled) view.dispatch(state.tr.insertText(ch, from, to))
  }
  return state
}

test('Markdown shortcuts: **x** is bold, *x* italic, `x` code, three backticks a code block', () => {
  const b = type(stateWith('', false), '**hey**')
  expect(b.doc.textContent).toBe('hey')
  expect(marksAt(b)).toEqual(['strong'])
  expect(marksAt(type(stateWith('', false), '*hey*'))).toEqual(['em'])
  const c = type(stateWith('', false), 'a `x`')
  expect(c.doc.textContent).toBe('a x')
  expect(marksAt(c, 3)).toEqual(['code'])
  expect(type(stateWith('', false), '```').doc.firstChild!.type.name).toBe('code_block')
})

test('a javascript: link is refused, by command and from pasted HTML; a safe one is kept', () => {
  const state = stateWith('go')
  expect(commands.link('javascript:alert(1)')(state)).toBe(false)
  expect(run(state, commands.link('https://example.com')).doc.firstChild!.firstChild!.marks[0]!.attrs.href).toBe('https://example.com')
  const pasted = validate('<p><a href="javascript:alert(1)">x</a> <a href=" JaVaScRiPt:alert(1)">y</a></p>', exts, { format: 'html' })
  expect(pasted).toEqual({ ok: true, doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x y' }] }] } })
  // a stored value carrying one still renders safely
  const json = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'z', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] }
  expect(renderHTML(json, exts)).not.toContain('javascript')
  expect(schema.marks.link.spec.toDOM!(schema.marks.link.create({ href: 'javascript:alert(1)' }), true)).toEqual(['a', expect.objectContaining({ href: 'about:invalid#unsafe' }), 0])
})

test('a mention round-trips: JSON and HTML in, the same HTML out', () => {
  const json = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi ' }, { type: 'mention', attrs: { id: 'u1', label: 'Mara <O>' } }] }] }
  const html = renderHTML(json, exts)
  expect(html).toBe('<p>Hi <span data-mention="u1">@Mara &lt;O&gt;</span></p>')
  expect(validate(json, exts)).toEqual({ ok: true, doc: json })
  expect(validate(html, exts, { format: 'html' })).toEqual({ ok: true, doc: json })
})

test('a paste from Word or Google Docs keeps paragraphs, bold, italic and links, and drops classes and styles', () => {
  const result = validate(readFileSync(new URL('./fixtures/word.html', import.meta.url), 'utf8'), exts, { format: 'html' })
  expect(result.ok).toBe(true)
  const html = renderHTML((result as { doc: object }).doc, exts)
  expect(html).toBe('<p><strong>Bold</strong> and <em>italic</em> and <a href="https://example.com/a" rel="noopener noreferrer nofollow">a link</a></p><p>Second <strong>styled bold</strong></p><p>From Docs</p>')
})

test('composerExtensions: code blocks and mentions can be left out; the same options give the same list', () => {
  expect(buildSchema(composerExtensions({ codeBlocks: false })).nodes.code_block).toBeUndefined()
  expect(buildSchema(composerExtensions({ mentions: false })).nodes.mention).toBeUndefined()
  expect(composerExtensions({ codeBlocks: false })).toBe(composerExtensions({ codeBlocks: false }))
  expect(markdownShortcuts.requires ?? []).toEqual([])
  expect([bold, italic, code, link, mention].every((e) => e.name)).toBe(true)
})

const docOf = (...blocks: any[]) => schema.node('doc', null, blocks)
const p = (...content: any[]) => schema.node('paragraph', null, content)
const t = (s: string) => schema.text(s)
const br = () => schema.nodes.hard_break!.create()
const selectAll = (doc: any) => { const s = EditorState.create({ doc, schema }); return s.apply(s.tr.setSelection(TextSelection.create(s.doc, 1, s.doc.content.size - 1))) }

test('user: toggling a code block over lines keeps every line, and toggling back gives them back', () => {
  // three paragraphs, the second with a Shift+Enter break, all selected
  const code = run(selectAll(docOf(p(t('one')), p(t('two'), br(), t('three')), p(t('four')))), commands.codeBlock())
  expect(code.doc.childCount).toBe(1)
  expect(code.doc.firstChild!.type.name).toBe('code_block')
  expect(code.doc.firstChild!.textContent).toBe('one\ntwo\nthree\nfour')
  const back = run(code, commands.codeBlock())
  expect(back.doc.firstChild!.type.name).toBe('paragraph')
  expect(back.doc.firstChild!.toJSON().content).toEqual([
    { type: 'text', text: 'one' }, { type: 'hard_break' }, { type: 'text', text: 'two' }, { type: 'hard_break' },
    { type: 'text', text: 'three' }, { type: 'hard_break' }, { type: 'text', text: 'four' },
  ])
  // a caret alone in a paragraph: that paragraph becomes the code block
  const one = EditorState.create({ doc: docOf(p(t('x')), p(t('y'))), schema })
  expect(run(one, commands.codeBlock()).doc.toJSON().content.map((b: any) => b.type)).toEqual(['code_block', 'paragraph'])
})
