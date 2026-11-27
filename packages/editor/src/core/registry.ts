// Which editor runs on which element, and the parts waiting for one: a part names its field by id (for="id", like
// <label for>) and is wired when that field's editor exists, now or later, and unwired when it goes. No ProseMirror
// here: a part that imports this loads none of the editor's code.
import type { Editor } from './editor.ts'

type Wire = (editor: Editor, el: Element) => (() => void) | void
// el: the field it's wired to now, if any (with two fields on one id, the newest)
type Waiting = { wire: Wire; el?: Element; undo?: (() => void) | void }

const instances = new WeakMap<Element, Editor>()
const waiting = new Map<string, Set<Waiting>>()

const unwire = (w: Waiting) => {
  w.undo?.()
  w.undo = undefined
  w.el = undefined
}

/** Records the editor on `el` and wires the parts waiting for its id; returns how to unrecord it (unwiring them). */
export function register(el: Element, editor: Editor): () => void {
  const id = el.id // the id it registers with: a later rename doesn't move its wiring
  instances.set(el, editor)
  for (const w of waiting.get(id) ?? []) {
    unwire(w) // wired to another field with this id: the newest wins, the old wiring is undone first
    w.el = el
    w.undo = w.wire(editor, el)
  }
  return () => {
    instances.delete(el)
    for (const w of waiting.get(id) ?? []) if (w.el === el) unwire(w)
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
  if (el && editor) {
    w.el = el
    w.undo = wire(editor, el)
  }
  return () => {
    if (set.delete(w) && !set.size && waiting.get(id) === set) waiting.delete(id)
    unwire(w)
  }
}
