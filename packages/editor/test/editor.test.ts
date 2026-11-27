// @vitest-environment happy-dom
// createEditor and the editor behaviour: the value as a signal in the chosen format, Enter to send (never mid-
// composition), the empty and over-limit guards, undo, and clean-up.
import { afterEach, expect, test, vi } from 'vitest'
import { composerExtensions } from '../src/extensions/composer.ts'
import { createEditor, type Editor } from '../src/core/editor.ts'
import { editor as editorBehaviour, editorOf } from '../src/behaviours/editor.ts'

afterEach(() => { document.body.innerHTML = '' })
const mount = () => { const el = document.createElement('div'); document.body.append(el); return el }
const type = (ed: Editor, text: string) => ed.view.dispatch(ed.view.state.tr.insertText(text))
const key = (ed: Editor, key: string, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  ed.view.dom.dispatchEvent(event)
  return event
}
const mod = /Mac|iP(hone|[oa]d)/.test(navigator.platform) ? { metaKey: true } : { ctrlKey: true }

test('the value follows the document, in the chosen format', () => {
  const json = createEditor({ element: mount(), extensions: composerExtensions(), format: 'json' })
  type(json, 'hi')
  expect(json.value.get()).toEqual({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }] })
  const html = createEditor({ element: mount(), extensions: composerExtensions(), format: 'html', value: '<p>a <strong>b</strong></p>' })
  expect(html.value.get()).toBe('<p>a <strong>b</strong></p>')
  html.view.dispatch(html.view.state.tr.insertText('!', html.view.state.doc.content.size - 1)) // at the end
  expect(html.value.get()).toBe('<p>a <strong>b!</strong></p>')
  // set from outside (a parent's [(value)]): the document follows
  html.value.set('<p>new</p>')
  expect(html.view.state.doc.textContent).toBe('new')
})

test('Enter sends the value and clears; Shift+Enter is a new line', () => {
  const onSend = vi.fn()
  const ed = createEditor({ element: mount(), extensions: composerExtensions(), format: 'html', onSend })
  type(ed, 'one')
  expect(key(ed, 'Enter', { shiftKey: true }).defaultPrevented).toBe(true)
  type(ed, 'two')
  expect(onSend).not.toHaveBeenCalled()
  key(ed, 'Enter')
  expect(onSend).toHaveBeenCalledWith('<p>one<br>two</p>')
  expect(ed.view.state.doc.textContent).toBe('')
})

test('Enter while an input method is composing does not send', () => {
  const onSend = vi.fn()
  const ed = createEditor({ element: mount(), extensions: composerExtensions(), format: 'json', onSend })
  type(ed, 'にほん')
  expect(key(ed, 'Enter', { isComposing: true }).defaultPrevented).toBe(false)
  expect(key(ed, 'Enter', { keyCode: 229 } as KeyboardEventInit).defaultPrevented).toBe(false)
  expect(onSend).not.toHaveBeenCalled()
  expect(ed.view.state.doc.childCount).toBe(1) // and no new paragraph either
})

test('an empty or whitespace-only composer, or one over its limit, does not send', () => {
  const onSend = vi.fn()
  const ed = createEditor({ element: mount(), extensions: composerExtensions(), format: 'json', onSend, maxLength: 3 })
  key(ed, 'Enter')
  type(ed, '   ')
  expect(ed.send()).toBe(false)
  ed.clear()
  type(ed, 'abcd')
  expect(ed.length.get()).toBe(4)
  expect(key(ed, 'Enter').defaultPrevented).toBe(true) // swallowed: no new line either
  expect(ed.view.state.doc.textContent).toBe('abcd')
  expect(onSend).not.toHaveBeenCalled()
  ed.view.dispatch(ed.view.state.tr.delete(4, 5))
  expect(ed.send()).toBe(true)
  expect(onSend).toHaveBeenCalledTimes(1)
})

test('in a code block Enter is a new line, and Mod-Enter sends', () => {
  const onSend = vi.fn()
  const ed = createEditor({ element: mount(), extensions: composerExtensions(), format: 'json', onSend })
  ed.run('codeBlock')
  type(ed, 'let a')
  key(ed, 'Enter')
  type(ed, 'let b')
  expect(ed.view.state.doc.textContent).toBe('let a\nlet b')
  expect(onSend).not.toHaveBeenCalled()
  key(ed, 'Enter', mod)
  expect(onSend).toHaveBeenCalledTimes(1)
})

test('commands by name, can() and active(); Mod-z undoes', () => {
  const ed = createEditor({ element: mount(), extensions: composerExtensions(), format: 'json' })
  type(ed, 'hello')
  expect(ed.can('link', 'https://x.dev')).toBe(false) // nothing selected
  ed.view.dispatch(ed.view.state.tr.setSelection((ed.view.state.selection.constructor as any).create(ed.view.state.doc, 1, 6)))
  expect(ed.run('bold')).toBe(true)
  expect(ed.active('bold')).toBe(true)
  expect(ed.active('strong')).toBe(true)
  expect(ed.run('nope')).toBe(false)
  key(ed, 'z', mod)
  key(ed, 'z', mod)
  expect(ed.view.state.doc.textContent).toBe('')
})

test('the editable is a labelled, multi-line textbox; read-only says so', () => {
  const ed = createEditor({ element: mount(), extensions: composerExtensions({ placeholder: 'Reply…' }), format: 'json', label: 'Message' })
  const dom = ed.view.dom
  expect([dom.getAttribute('role'), dom.getAttribute('aria-multiline'), dom.getAttribute('aria-label'), dom.getAttribute('aria-placeholder')]).toEqual(['textbox', 'true', 'Message', 'Reply…'])
  expect(dom.hasAttribute('data-empty')).toBe(true)
  type(ed, 'x')
  expect(dom.hasAttribute('data-empty')).toBe(false)
  const ro = createEditor({ element: mount(), extensions: composerExtensions(), format: 'json', editable: false })
  expect(ro.view.dom.getAttribute('aria-readonly')).toBe('true')
  expect(ro.view.dom.getAttribute('contenteditable')).toBe('false')
})

test('the behaviour: editorOf finds the instance; the dispose removes the view and forgets it', () => {
  const el = mount()
  const dispose = editorBehaviour(el, { extensions: composerExtensions(), format: 'json' })
  expect(editorOf(el)!.view.dom.parentElement).toBe(el)
  dispose()
  expect(el.querySelector('[contenteditable]')).toBeNull()
  expect(editorOf(el)).toBeUndefined()
})

test("the server's renderHTML matches the browser's HTML for the same document", async () => {
  const { renderHTML } = await import('../src/server.ts')
  const exts = composerExtensions()
  const p = (...content: object[]) => ({ type: 'paragraph', content })
  const json = { type: 'doc', content: [
    p({ type: 'text', text: 'a <b> & ' }, { type: 'text', text: 'bold', marks: [{ type: 'strong' }, { type: 'em' }] }, { type: 'hard_break' }, { type: 'text', text: 'link', marks: [{ type: 'link', attrs: { href: '/x?a=1&b="2"' } }] }, { type: 'mention', attrs: { id: 'u"1', label: 'Mara' } }),
    { type: 'code_block', content: [{ type: 'text', text: 'if (a < b) {\n}' }] },
    p({ type: 'text', text: 'inline', marks: [{ type: 'code' }] }),
  ] }
  const ed = createEditor({ element: mount(), extensions: exts, format: 'html', value: renderHTML(json, exts) })
  expect(ed.value.get()).toBe(renderHTML(json, exts))
  const fromJson = createEditor({ element: mount(), extensions: exts, format: 'html' })
  fromJson.value.set(renderHTML(json, exts))
  expect(fromJson.view.state.doc.toJSON()).toEqual(json)
})

test('starting from a textarea\'s text: blank lines make paragraphs, a line break a hard break, the caret kept', async () => {
  const ed = createEditor({ element: mount(), extensions: composerExtensions(), format: 'json', text: { value: 'a\n\nb', caret: 3 } })
  expect(ed.view.state.doc.toJSON()).toEqual({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'b' }] }] })
  expect(ed.view.state.selection.from).toBe(4) // just before "b"
  const lines = createEditor({ element: mount(), extensions: composerExtensions(), format: 'json', text: { value: '  x\ny' } })
  expect(lines.view.state.doc.firstChild!.toJSON().content).toEqual([{ type: 'text', text: '  x' }, { type: 'hard_break' }, { type: 'text', text: 'y' }])
  expect(lines.view.state.selection.from).toBe(lines.view.state.doc.content.size - 1) // no caret given: the end
  expect(lines.value.get()).toEqual(lines.view.state.doc.toJSON())
})

test('plainText: what a textarea shows for a value, from JSON or HTML, on the server too', async () => {
  const { plainText } = await import('../src/core/plain-text.ts')
  const json = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi ' }, { type: 'mention', attrs: { id: 'u', label: 'Mara' } }, { type: 'hard_break' }, { type: 'text', text: 'x' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'y' }] }] }
  expect(plainText(json, 'json')).toBe('Hi @Mara\nx\n\ny')
  expect(plainText(JSON.stringify(json), 'json')).toBe('Hi @Mara\nx\n\ny')
  expect(plainText('<p>a &amp; <b>b</b><br>c</p><p>&lt;d&gt;</p>', 'html')).toBe('a & b\nc\n\n<d>')
  expect(plainText('', 'json')).toBe('')
})

test('files pasted or dropped go to onFiles, not into the document; the state signal follows every change', async () => {
  const { Slice } = await import('prosemirror-model')
  const onFiles = vi.fn()
  const ed = createEditor({ element: mount(), extensions: composerExtensions(), format: 'json', onFiles })
  const file = new File(['x'], 'a.png', { type: 'image/png' })
  expect(ed.view.someProp('handlePaste', (f) => f(ed.view, { clipboardData: { files: [file] } } as any, Slice.empty))).toBe(true)
  expect(ed.view.someProp('handleDrop', (f) => f(ed.view, { dataTransfer: { files: [file] }, preventDefault() {} } as any, Slice.empty, false))).toBe(true)
  expect(onFiles.mock.calls).toEqual([[[file]], [[file]]])
  expect(ed.view.someProp('handlePaste', (f) => f(ed.view, { clipboardData: { files: [] } } as any, Slice.empty)) ?? false).toBe(false)
  const seen: number[] = []
  const { effect } = await import('clarusjs/runtime')
  const stop = effect(() => { seen.push(ed.state.get().selection.from) })
  type(ed, 'ab')
  ed.view.dispatch(ed.view.state.tr.setSelection((ed.view.state.selection.constructor as any).create(ed.view.state.doc, 2)))
  stop()
  expect(seen).toEqual([1, 3, 2]) // "ab" in one transaction, then the caret moved
})

test('onSend returning false keeps the text (a send the app refused)', () => {
  const ed = createEditor({ element: mount(), extensions: composerExtensions(), format: 'json', onSend: () => false })
  type(ed, 'keep me')
  expect(ed.send()).toBe(false)
  expect(ed.view.state.doc.textContent).toBe('keep me')
})

test('plainText never throws on bad input: an out-of-range character reference, a surrogate, broken JSON', async () => {
  const { plainText } = await import('../src/core/plain-text.ts')
  expect(plainText('<p>a&#99999999;b&#xD800;c&#x;</p>', 'html')).toBe('a�b�c&#x;')
  expect(plainText('{not json', 'json')).toBe('')
  expect(plainText({ content: 'nope' }, 'json')).toBe('')
})

test('review: an Enter just after compositionend sends outside Safari (Android sends its Enter that way)', () => {
  const onSend = vi.fn()
  const ed = createEditor({ element: mount(), extensions: composerExtensions(), format: 'json', onSend })
  type(ed, 'hello')
  ed.view.dom.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
  key(ed, 'Enter')
  expect(onSend).toHaveBeenCalledTimes(1)
})
