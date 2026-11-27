// The schema from a list of extensions: every node and mark they add, with their requirements and conflicts checked.
import { Schema, type MarkSpec as PMMarkSpec, type NodeSpec as PMNodeSpec } from 'prosemirror-model'
import type { Extension } from './extension.ts'

export { defineExtension, type Extension, type MarkSpec, type NodeSpec } from './extension.ts'

const fail = (message: string): never => { throw new Error(`@clarusjs/editor: ${message}`) }

/**
 * The ProseMirror schema for `extensions`: their nodes (in order; the first is the top node unless one is `doc`) and
 * marks, each `render` used as `toDOM`. A missing `requires`, a `conflicts` pair, or a node or mark two extensions
 * both define is an error naming them.
 * @example
 * const schema = buildSchema(composerExtensions())
 * @see https://clarusjs.com/guide/editor-composer#extensions
 */
export function buildSchema(extensions: Extension[]): Schema {
  const names = new Set(extensions.map((e) => e.name))
  for (const e of extensions) {
    for (const r of e.requires ?? []) if (!names.has(r)) fail(`"${e.name}" requires "${r}"`)
    for (const c of e.conflicts ?? []) if (names.has(c)) fail(`"${e.name}" conflicts with "${c}"`)
  }
  const nodes: Record<string, PMNodeSpec> = {}
  const marks: Record<string, PMMarkSpec> = {}
  const nodeOwner = new Map<string, string>()
  const markOwner = new Map<string, string>()
  for (const e of extensions) {
    for (const [name, spec] of Object.entries(e.nodes ?? {})) {
      if (nodeOwner.has(name)) fail(`"${e.name}" and "${nodeOwner.get(name)}" both define the node "${name}"`)
      nodeOwner.set(name, e.name)
      const { render, ...rest } = spec
      nodes[name] = render ? { ...rest, toDOM: render } : rest
    }
    for (const [name, spec] of Object.entries(e.marks ?? {})) {
      if (markOwner.has(name)) fail(`"${e.name}" and "${markOwner.get(name)}" both define the mark "${name}"`)
      markOwner.set(name, e.name)
      const { render, ...rest } = spec
      marks[name] = { ...rest, toDOM: render }
    }
  }
  // "doc" first: ProseMirror's top node is the first one.
  const ordered = Object.fromEntries(Object.entries(nodes).sort(([a], [b]) => (a === 'doc' ? -1 : b === 'doc' ? 1 : 0)))
  return new Schema({ nodes: ordered, marks })
}
