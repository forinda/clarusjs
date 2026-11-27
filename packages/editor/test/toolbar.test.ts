// @vitest-environment happy-dom
// The toolbar behaviour: buttons named by data-command run that command on the editor; aria-pressed follows what's
// active at the selection and disabled what can't run there; one tab stop, arrows between buttons.
import { afterEach, expect, test, vi } from 'vitest'
import { TextSelection } from 'prosemirror-state'
import { composerExtensions } from '../src/extensions/composer.ts'
import { editor, editorOf } from '../src/behaviours/editor.ts'
import { toolbar } from '../src/behaviours/toolbar.ts'

let stops: (() => void)[] = []
afterEach(() => { stops.forEach((s) => s()); stops = []; document.body.innerHTML = ''; vi.unstubAllGlobals() })

function setup() {
  document.body.innerHTML = '<div id="ed"></div><div id="bar" aria-label="Formatting">'
    + '<button type="button" data-command="bold">B</button><button type="button" data-command="italic">I</button>'
    + '<button type="button" data-command="codeBlock">{}</button><button type="button" data-command="link">L</button></div>'
  const el = document.getElementById('ed')!
  stops.push(editor(el, { extensions: composerExtensions(), format: 'json' }))
  const bar = document.getElementById('bar')!
  stops.push(toolbar(bar, { editor: el }))
  const ed = editorOf(el)!
  ed.view.dispatch(ed.view.state.tr.insertText('hello'))
  ed.view.dispatch(ed.view.state.tr.setSelection(TextSelection.create(ed.view.state.doc, 1, 6)))
  const button = (c: string) => bar.querySelector<HTMLButtonElement>(`[data-command="${c}"]`)!
  return { ed, bar, button }
}

test('a toolbar with one tab stop; a click runs its command, aria-pressed follows, focus goes back', () => {
  const { ed, bar, button } = setup()
  expect(bar.getAttribute('role')).toBe('toolbar')
  expect([...bar.querySelectorAll('button')].map((b) => b.tabIndex)).toEqual([0, -1, -1, -1])
  expect(button('bold').getAttribute('aria-pressed')).toBe('false')
  button('bold').click()
  expect(ed.active('bold')).toBe(true)
  expect(button('bold').getAttribute('aria-pressed')).toBe('true')
  expect(document.activeElement).toBe(ed.view.dom)
})

test('in a code block, marks are disabled and the code block button is pressed', () => {
  const { button } = setup()
  button('codeBlock').click()
  expect(button('codeBlock').getAttribute('aria-pressed')).toBe('true')
  expect(button('bold').disabled).toBe(true)
  button('codeBlock').click()
  expect(button('bold').disabled).toBe(false)
})

test('link asks for the address, refuses an unsafe one, and unlinks when pressed', () => {
  const { ed, button } = setup()
  vi.stubGlobal('prompt', () => 'javascript:alert(1)')
  button('link').click()
  expect(ed.active('link')).toBe(false)
  vi.stubGlobal('prompt', () => 'https://clarusjs.com')
  button('link').click()
  expect(button('link').getAttribute('aria-pressed')).toBe('true')
  button('link').click()
  expect(ed.active('link')).toBe(false)
})

test('review: tools that start disabled (as <editor-tool> renders them) get a Tab stop once the toolbar enables them', () => {
  document.body.innerHTML = '<div id="ed"></div><div id="bar"><button type="button" data-command="bold" disabled>B</button><button type="button" data-command="italic" disabled>I</button></div>'
  const el = document.getElementById('ed')!
  stops.push(editor(el, { extensions: composerExtensions(), format: 'json' }))
  stops.push(toolbar(document.getElementById('bar')!, { editor: el }))
  expect([...document.querySelectorAll('#bar button')].map((b) => (b as HTMLButtonElement).tabIndex)).toEqual([0, -1])
})
