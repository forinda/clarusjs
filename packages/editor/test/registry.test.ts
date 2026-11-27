// @vitest-environment happy-dom
// The registry: parts find a field's editor by id (for="id", like <label for>), whether they attach before the
// field's editor exists or after; when the editor goes, their wiring is undone, and redone if it comes back.
import { afterEach, expect, test, vi } from 'vitest'
import { onEditor } from '../src/core/registry.ts'
import { editor } from '../src/behaviours/editor.ts'
import { composerExtensions } from '../src/extensions/composer.ts'

afterEach(() => { document.body.innerHTML = '' })
const field = () => { document.body.innerHTML = '<div id="msg"></div>'; return document.getElementById('msg')! }

test('a part waiting for a field gets its editor when it comes, and lets go when it goes', () => {
  const el = field()
  const undo = vi.fn()
  const wire = vi.fn((_editor: unknown, _el: Element) => undo)
  const stop = onEditor('msg', wire)
  expect(wire).not.toHaveBeenCalled()
  const dispose = editor(el, { extensions: composerExtensions(), format: 'json' })
  expect(wire).toHaveBeenCalledTimes(1)
  expect(wire.mock.calls[0]![1]).toBe(el)
  dispose()
  expect(undo).toHaveBeenCalledTimes(1)
  const again = editor(el, { extensions: composerExtensions(), format: 'json' })
  expect(wire).toHaveBeenCalledTimes(2)
  stop()
  expect(undo).toHaveBeenCalledTimes(2)
  again()
  expect(undo).toHaveBeenCalledTimes(2) // stopped: not wired, nothing to undo
})

test('a part arriving after the field is wired at once; another id is not its business', () => {
  const el = field()
  const dispose = editor(el, { extensions: composerExtensions(), format: 'json' })
  const wire = vi.fn()
  onEditor('msg', wire)
  onEditor('other', wire)
  expect(wire).toHaveBeenCalledTimes(1)
  dispose()
})

test('review I1: two fields with one id: the part follows the newest, unwired from the old first; the old one going leaves it wired', () => {
  document.body.innerHTML = '<div id="msg"></div><div id="msg2"></div>'
  const [a, b] = [document.getElementById('msg')!, document.getElementById('msg2')!]
  const undo = vi.fn()
  const wire = vi.fn((_editor: unknown, _el: Element) => undo)
  onEditor('msg', wire)
  const disposeA = editor(a, { extensions: composerExtensions(), format: 'json' })
  b.id = 'msg' // a second field with the same id
  const disposeB = editor(b, { extensions: composerExtensions(), format: 'json' })
  expect(wire.mock.calls.map((c) => c[1])).toEqual([a, b])
  expect(undo).toHaveBeenCalledTimes(1) // a's wiring undone before b's
  disposeA()
  expect(undo).toHaveBeenCalledTimes(1) // b's stays
  disposeB()
  expect(undo).toHaveBeenCalledTimes(2)
})

test('review I3: a field whose id changes unwires the parts of the id it was registered with', () => {
  const el = field()
  const undo = vi.fn()
  onEditor('msg', () => undo)
  const dispose = editor(el, { extensions: composerExtensions(), format: 'json' })
  el.id = 'renamed'
  dispose()
  expect(undo).toHaveBeenCalledTimes(1)
})

test('review M1: stopping a part twice leaves the other parts waiting on that id alone', () => {
  const el = field()
  const stop = onEditor('msg', vi.fn())
  stop()
  const later = vi.fn()
  onEditor('msg', later)
  stop()
  const dispose = editor(el, { extensions: composerExtensions(), format: 'json' })
  expect(later).toHaveBeenCalledTimes(1)
  dispose()
})
