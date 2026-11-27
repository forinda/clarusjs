// The editor behaviour, for [use]: an editor inside the element, found again by the other behaviours (suggestion,
// toolbar) with editorOf().
import { createEditor, type Editor, type EditorOptions } from '../core/editor.ts'

const instances = new WeakMap<Element, Editor>()

/**
 * An editor inside `el`, for `[use]`; returns the dispose.
 * @example
 * <div [use]="editor" [options]="{ extensions: composerExtensions(), format: 'json' }"></div>
 * @see https://clarusjs.com/guide/editor-composer#behaviours
 */
export function editor(el: HTMLElement, options: EditorOptions): () => void {
  const instance = createEditor({ ...options, element: el })
  instances.set(el, instance)
  return () => { instances.delete(el); instance.destroy() }
}

/**
 * The editor the `editor` behaviour made on `el`, if any.
 * @see https://clarusjs.com/guide/editor-composer#behaviours
 */
export function editorOf(el: Element): Editor | undefined {
  return instances.get(el)
}
