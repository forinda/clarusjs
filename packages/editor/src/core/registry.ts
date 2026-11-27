// Which editor runs on which element, and the parts waiting for one: a part names its field by id (for="id", like
// <label for>) and is wired when that field's editor exists, now or later, and unwired when it goes. No ProseMirror
// here: a part that imports this loads none of the editor's code.
import type { Editor } from './editor.ts'

type Wire = (editor: Editor, el: Element) => (() => void) | void
type Waiting = { wire: Wire; undo?: (() => void) | void }

const instances = new WeakMap<Element, Editor>()
const waiting = new Map<string, Set<Waiting>>()

/** Records the editor on `el` and wires the parts waiting for its id; returns how to unrecord it (unwiring them). */
export function register(el: Element, editor: Editor): () => void {
  instances.set(el, editor)
  for (const w of waiting.get(el.id) ?? []) w.undo = w.wire(editor, el)
  return () => {
    instances.delete(el)
    for (const w of waiting.get(el.id) ?? []) { w.undo?.(); w.undo = undefined }
  }
}

/**
 * The editor running on `el`, if any.
 * @see https://clarusjs.com/guide/editor-composer#behaviours
 */
export function editorOf(el: Element): Editor | undefined {
  return instances.get(el)
}

/**
 * Wires `wire` to the editor of the field with this id: now if it exists, else when it does. What `wire` returns is
 * called when that editor goes (and `wire` runs again if one comes back). Returns how to stop.
 * @example
 * onEditor('msg', (editor) => effect(() => (count = editor.length.get())))
 * @see https://clarusjs.com/guide/editor-composer#parts
 */
export function onEditor(id: string, wire: Wire): () => void {
  const w: Waiting = { wire }
  let set = waiting.get(id)
  if (!set) waiting.set(id, (set = new Set()))
  set.add(w)
  const el = typeof document !== 'undefined' ? document.getElementById(id) : null
  const editor = el && instances.get(el)
  if (el && editor) w.undo = wire(editor, el)
  return () => {
    set.delete(w)
    if (!set.size) waiting.delete(id)
    w.undo?.()
    w.undo = undefined
  }
}
