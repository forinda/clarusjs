// The editor behaviour, for [use]: an editor inside the element, recorded so the parts that name the element's id
// (for="id"), and the other behaviours, find it.
import { createEditor, type EditorOptions } from '../core/editor.ts'
import { register } from '../core/registry.ts'

export { editorOf } from '../core/registry.ts'

/**
 * An editor inside `el`, for `[use]`; returns the dispose.
 * @example
 * <div id="note" [use]="(el) => editor(el, { extensions: composerExtensions(), format: 'json' })"></div>
 * @see https://clarusjs.com/guide/editor-composer#behaviours
 */
export function editor(el: HTMLElement, options: EditorOptions): () => void {
  const instance = createEditor({ ...options, element: el })
  const unregister = register(el, instance)
  return () => { unregister(); instance.destroy() }
}
