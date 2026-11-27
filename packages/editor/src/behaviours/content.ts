// The content behaviour, for [use]: a value shown as the editor shows it (a sent message, a stored comment), rendered
// in the browser through the extensions' schema: only what the schema allows, URLs checked by their render specs.
// An HTML value is parsed in an inert document. No editor and no view code: ProseMirror's model only.
import { DOMParser, DOMSerializer, Node, type Schema } from 'prosemirror-model'
import type { Extension } from '../core/extension.ts'
import { buildSchema } from '../core/schema.ts'

const schemas = new WeakMap<Extension[], Schema>()

/**
 * Renders `value` into `el`; returns the dispose (which empties it). A value that isn't a document renders nothing.
 * @example
 * <div [use]="(el) => content(el, { value: message.body, format: 'json', extensions: composerExtensions() })"></div>
 * @see https://clarusjs.com/guide/editor-composer#behaviours
 */
export function content(el: HTMLElement, options: { value: string | object; format: 'json' | 'html'; extensions: Extension[] }): () => void {
  let schema = schemas.get(options.extensions)
  if (!schema) schemas.set(options.extensions, (schema = buildSchema(options.extensions)))
  let doc: Node | undefined
  try {
    if (options.format === 'html') {
      const body = document.implementation.createHTMLDocument('').body
      body.innerHTML = String(options.value)
      doc = DOMParser.fromSchema(schema).parse(body)
    } else {
      doc = Node.fromJSON(schema, typeof options.value === 'string' ? JSON.parse(options.value) : options.value)
      doc.check()
    }
  } catch {
    doc = undefined
  }
  el.replaceChildren(doc ? DOMSerializer.fromSchema(schema).serializeFragment(doc.content) : '')
  return () => el.replaceChildren()
}
