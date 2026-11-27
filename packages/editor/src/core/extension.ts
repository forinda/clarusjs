// An extension: plain data (nodes, marks, commands, keys, input rules, plugins), not a class. Several make an editor's
// schema and behaviour; the same list renders and validates on the server.
import type { InputRule } from 'prosemirror-inputrules'
import type { DOMOutputSpec, MarkSpec as PMMarkSpec, Mark, Node, NodeSpec as PMNodeSpec, Schema } from 'prosemirror-model'
import type { Command, Plugin } from 'prosemirror-state'

/**
 * A node type: ProseMirror's NodeSpec, with `render` (a DOM-free description of its HTML, used in the browser and to
 * render on the server) in place of `toDOM`. Text nodes have none: they are their text.
 * @see https://clarusjs.com/guide/editor-composer#extensions
 */
export type NodeSpec = PMNodeSpec & { render?: (node: Node) => DOMOutputSpec }
/**
 * A mark type: ProseMirror's MarkSpec, with `render` in place of `toDOM`.
 * @see https://clarusjs.com/guide/editor-composer#extensions
 */
export type MarkSpec = PMMarkSpec & { render: (mark: Mark, inline: boolean) => DOMOutputSpec }

/**
 * An editor extension: the nodes and marks it adds to the schema, its commands (by name), keys, input rules and
 * ProseMirror plugins, and the extensions it needs or can't be used with.
 * @example
 * const highlight = defineExtension({ name: 'highlight', marks: { highlight: { render: () => ['mark', 0] } } })
 * @see https://clarusjs.com/guide/editor-composer#extensions
 */
export type Extension = {
  name: string
  nodes?: Record<string, NodeSpec>
  marks?: Record<string, MarkSpec>
  /** Commands by name: each takes arguments and returns a ProseMirror command, built for the editor's schema. */
  commands?: (schema: Schema) => Record<string, (...args: any[]) => Command>
  keys?: (schema: Schema) => Record<string, Command>
  inputRules?: (schema: Schema) => InputRule[]
  plugins?: (schema: Schema) => Plugin[]
  requires?: string[]
  conflicts?: string[]
}

/**
 * An extension, typed. Plain data in, the same object out.
 * @example
 * const bold = defineExtension({ name: 'bold', marks: { strong: { render: () => ['strong', 0] } } })
 * @see https://clarusjs.com/guide/editor-composer#extensions
 */
export function defineExtension(extension: Extension): Extension {
  return extension
}
