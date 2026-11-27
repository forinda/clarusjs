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
