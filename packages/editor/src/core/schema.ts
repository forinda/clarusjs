// The schema from a list of extensions: every node and mark they add, with their requirements and conflicts checked.
import { attrValue } from 'clarusjs/runtime'
import { Schema, type DOMOutputSpec, type MarkSpec as PMMarkSpec, type NodeSpec as PMNodeSpec } from 'prosemirror-model'
import type { Extension } from './extension.ts'

export { defineExtension, type Extension, type MarkSpec, type NodeSpec } from './extension.ts'

const fail = (message: string): never => { throw new Error(`@clarusjs/editor: ${message}`) }

// Tags that run or load something, and attributes that run script: never in a render spec, whatever an extension
// asks for. Server and browser render through this.
const UNSAFE_TAGS = new Set(['script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'link', 'meta', 'base', 'template', 'noscript'])
const UNSAFE_ATTR = /^(on|srcdoc$|formaction$)/i
// What a tag or attribute name may be (optionally after a namespace URI and a space, as ProseMirror specs allow):
// anything else is data written into a name, which could close the tag and add a handler.
// The namespace must be a URI (it has a scheme): "data-x onmouseover" is a name with a handler, not a namespace.
export const TAG_NAME = /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:\S+ )?[a-zA-Z][a-zA-Z0-9-]*$/
export const ATTR_NAME = /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:\S+ )?[a-zA-Z_:][a-zA-Z0-9_:.-]*$/
/** A tag or attribute name without its namespace URI (what HTML writes). */
export const localName = (name: string) => name.slice(name.lastIndexOf(' ') + 1)
const hasHole = (s: unknown): boolean => s === 0 || (Array.isArray(s) && s.some(hasHole))

/** Every object or array inside a node's or mark's attributes (what a document sets), at any depth. */
function attrObjects(attrs: Record<string, unknown> | undefined): Map<object, string> {
  const found = new Map<object, string>()
  const walk = (v: unknown, key: string) => {
    if (!v || typeof v !== 'object' || found.has(v)) return
    found.set(v, key)
    for (const x of Object.values(v)) walk(x, key)
  }
  for (const [key, v] of Object.entries(attrs ?? {})) walk(v, key)
  return found
}

/**
 * The attribute whose value (or something inside it) a render spec uses as part of the spec itself: a document could
 * then write elements and attributes of its choosing. Undefined when none does.
 */
export function attrInSpec(spec: unknown, attrs: Record<string, unknown> | undefined): string | undefined {
  const from = attrObjects(attrs)
  if (!from.size) return undefined
  const walk = (s: unknown): string | undefined => {
    if (!s || typeof s !== 'object') return undefined
    if (from.has(s)) return from.get(s)
    return Array.isArray(s) ? s.reduce<string | undefined>((hit, c) => hit ?? walk(c), undefined) : undefined
  }
  return walk(spec)
}

/**
 * A render spec made safe: a part that came from the node's own attributes renders nothing, unsafe tags render
 * nothing, attributes that run script are dropped, and every attribute goes through clarusjs's attribute check
 * (URLs refused as templates refuse them), in the browser as on the server.
 */
export function safeSpec(spec: DOMOutputSpec, attrs?: Record<string, unknown>): DOMOutputSpec {
  const from = attrObjects(attrs)
  const clean = (s: unknown): unknown => {
    if (typeof s === 'string') return s
    if (s && typeof s === 'object' && from.has(s)) return ''
    // a refused element: an empty span (with the content slot it had, which ProseMirror's serializer needs)
    const refused = () => (hasHole(s) ? ['span', 0] : ['span'])
    if (!Array.isArray(s)) return s // a DOM node an extension built itself: its own responsibility
    const [tag, ...rest] = s as [unknown, ...unknown[]]
    if (typeof tag !== 'string' || !TAG_NAME.test(tag) || UNSAFE_TAGS.has(localName(tag).toLowerCase())) return refused()
    const out: unknown[] = [tag]
    rest.forEach((child, i) => {
      if (i === 0 && child && typeof child === 'object' && !Array.isArray(child) && !from.has(child)) {
        const kept: Record<string, string> = {}
        for (const [name, value] of Object.entries(child as Record<string, unknown>)) {
          if (!ATTR_NAME.test(name) || UNSAFE_ATTR.test(localName(name)) || (value && typeof value === 'object')) continue
          // checked by its local name, at its local tag: a namespaced xlink:href or <animate> is still a URL to check
          const v = attrValue(localName(name), value, localName(tag))
          if (v !== null) kept[name] = v === true ? '' : v
        }
        out.push(kept)
      } else if (i === 0 && child && typeof child === 'object' && !Array.isArray(child)) out.push({}) // attributes from attrs
      else out.push(child === 0 ? 0 : clean(child))
    })
    return out
  }
  return clean(spec) as DOMOutputSpec
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
      nodes[name] = render ? { ...rest, render, toDOM: (node) => safeSpec(render(node), node.attrs) } : rest
    }
    for (const [name, spec] of Object.entries(e.marks ?? {})) {
      if (markOwner.has(name)) fail(`"${e.name}" and "${markOwner.get(name)}" both define the mark "${name}"`)
      markOwner.set(name, e.name)
      const { render, ...rest } = spec
      marks[name] = { ...rest, render, toDOM: (mark, inline) => safeSpec(render(mark, inline), mark.attrs) }
    }
  }
  // "doc" first: ProseMirror's top node is the first one.
  const ordered = Object.fromEntries(Object.entries(nodes).sort(([a], [b]) => (a === 'doc' ? -1 : b === 'doc' ? 1 : 0)))
  return new Schema({ nodes: ordered, marks, topNode: nodes.doc ? 'doc' : Object.keys(nodes)[0] })
}
