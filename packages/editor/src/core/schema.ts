// The schema from a list of extensions: every node and mark they add, with their requirements and conflicts checked.
import { Schema, type DOMOutputSpec, type MarkSpec as PMMarkSpec, type NodeSpec as PMNodeSpec } from 'prosemirror-model'
import type { Extension } from './extension.ts'

export { defineExtension, type Extension, type MarkSpec, type NodeSpec } from './extension.ts'

const fail = (message: string): never => { throw new Error(`@clarusjs/editor: ${message}`) }

// Tags that run or load something, and attributes that run script: never in a render spec, whatever an extension
// (or a value it puts in its spec: an attribute a document sets) asks for. Server and browser render through this.
const UNSAFE_TAGS = new Set(['script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'link', 'meta', 'base', 'template', 'noscript'])
const UNSAFE_ATTR = /^(on|srcdoc$|formaction$)/i

/** A render spec with what could run script taken out: unsafe tags render nothing, unsafe attributes are dropped. */
export function safeSpec(spec: DOMOutputSpec): DOMOutputSpec {
  if (typeof spec === 'string') return spec
  if (!Array.isArray(spec)) return spec // a DOM node an extension built itself: its own responsibility
  const [tag, ...rest] = spec as unknown as [unknown, ...unknown[]]
  if (typeof tag !== 'string' || UNSAFE_TAGS.has(tag.toLowerCase().replace(/^.*\s/, ''))) return '' as unknown as DOMOutputSpec
  const out: unknown[] = [tag]
  rest.forEach((child, i) => {
    if (i === 0 && child && typeof child === 'object' && !Array.isArray(child)) {
      // (a value that isn't plain is kept: validate() refuses it, renderHTML() writes it as text)
      out.push(Object.fromEntries(Object.entries(child as Record<string, unknown>).filter(([name]) => !UNSAFE_ATTR.test(name))))
    } else out.push(child === 0 ? 0 : safeSpec(child as DOMOutputSpec))
  })
  return out as unknown as DOMOutputSpec
}

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
      nodes[name] = render ? { ...rest, toDOM: (node) => safeSpec(render(node)) } : rest
    }
    for (const [name, spec] of Object.entries(e.marks ?? {})) {
      if (markOwner.has(name)) fail(`"${e.name}" and "${markOwner.get(name)}" both define the mark "${name}"`)
      markOwner.set(name, e.name)
      const { render, ...rest } = spec
      marks[name] = { ...rest, toDOM: (mark, inline) => safeSpec(render(mark, inline)) }
    }
  }
  // "doc" first: ProseMirror's top node is the first one.
  const ordered = Object.fromEntries(Object.entries(nodes).sort(([a], [b]) => (a === 'doc' ? -1 : b === 'doc' ? 1 : 0)))
  return new Schema({ nodes: ordered, marks, topNode: nodes.doc ? 'doc' : Object.keys(nodes)[0] })
}
