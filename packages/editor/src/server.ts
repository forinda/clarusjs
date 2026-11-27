// @clarusjs/editor/server: validate a submitted value against the extensions' schema, and render a value to HTML,
// with no DOM view (an 'html' value is parsed by ProseMirror's own parser over linkedom). This is the safety boundary:
// whatever a browser sends, check it here before storing or rendering it.
import { parseHTML } from 'linkedom'
import { DOMParser, Node, type DOMOutputSpec, type Schema } from 'prosemirror-model'
import { attrValue, UNSAFE_URL } from 'clarusjs/runtime'
import type { Extension } from './core/extension.ts'
import { docLength } from './core/length.ts'
import { buildSchema } from './core/schema.ts'
import { base } from './extensions/base.ts'

/**
 * How a value is stored: ProseMirror JSON (an object, or its string) or HTML.
 * @see https://clarusjs.com/guide/editor-composer#format
 */
export type Format = 'json' | 'html'

const BASE = [base]
const schemas = new WeakMap<Extension[], Schema>()
const schemaOf = (extensions: Extension[]) => {
  let s = schemas.get(extensions)
  if (!s) schemas.set(extensions, (s = buildSchema(extensions)))
  return s
}

/** The document for `value`, parsed as `format`: throws when it isn't one the schema allows. */
function parse(value: string | object, schema: Schema, format: Format): Node {
  if (format === 'html') {
    const { document } = parseHTML(`<!doctype html><html><body>${String(value)}</body></html>`)
    return DOMParser.fromSchema(schema).parse(document.body as unknown as globalThis.Node)
  }
  const json = typeof value === 'string' ? JSON.parse(value) : value
  const doc = Node.fromJSON(schema, json)
  doc.check()
  return doc
}

/** The first URL attribute (href, src) that isn't safe, on a node or a mark, or undefined. */
function unsafeUrl(doc: Node): string | undefined {
  let found: string | undefined
  const check = (attrs: Record<string, unknown>, tag: string) => {
    for (const name of ['href', 'src']) {
      if (found || typeof attrs[name] !== 'string') continue
      if (attrValue(name, attrs[name], tag) === UNSAFE_URL) found = attrs[name] as string
    }
  }
  doc.descendants((node) => {
    check(node.attrs, node.type.name)
    for (const mark of node.marks) check(mark.attrs, 'a')
    return !found
  })
  return found
}

/**
 * Checks a submitted value against the extensions' schema: its nodes and marks, their nesting, every URL, and the
 * length when `maxLength` is set (in graphemes, as the browser counts). On success, `doc` is the checked document as
 * ProseMirror JSON: store that, or render it.
 * @example
 * const result = validate(form.get('message'), composerExtensions(), { maxLength: 2000 })
 * if (!result.ok) return new Response(result.error, { status: 422 })
 * @see https://clarusjs.com/guide/editor-composer#on-the-server
 */
export function validate(value: string | object, extensions: Extension[], options: { format?: Format; maxLength?: number } = {}): { ok: true; doc: object } | { ok: false; error: string } {
  let doc: Node
  try {
    doc = parse(value, schemaOf(extensions), options.format ?? 'json')
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
  const url = unsafeUrl(doc)
  if (url !== undefined) return { ok: false, error: `unsafe URL: ${url}` }
  if (options.maxLength !== undefined) {
    const n = docLength(doc)
    if (n > options.maxLength) return { ok: false, error: `too long: ${n} of ${options.maxLength}` }
  }
  return { ok: true, doc: doc.toJSON() }
}

/**
 * A document's length in graphemes, a mention counting as its label: the count a `maxLength` limits.
 * @example
 * length(json) // 3 for "👨‍👩‍👧ab"
 * @see https://clarusjs.com/guide/editor-composer#limits
 */
export function length(value: object, extensions: Extension[] = BASE): number {
  return docLength(Node.fromJSON(schemaOf(extensions), value))
}

const VOID = new Set(['br', 'hr', 'img', 'input', 'wbr'])
const escapeText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeAttr = (s: string) => escapeText(s).replace(/"/g, '&quot;')

/** HTML for one render spec, with `inner` at its hole (0). */
function specHTML(spec: DOMOutputSpec, inner: () => string): string {
  if (!Array.isArray(spec)) return ''
  const [tag, ...rest] = spec as [string, ...unknown[]]
  let attrs = ''
  let i = 0
  if (rest[0] && typeof rest[0] === 'object' && !Array.isArray(rest[0])) {
    for (const [name, value] of Object.entries(rest[0] as Record<string, unknown>)) {
      const v = attrValue(name, value, tag)
      if (v === null) continue
      attrs += v === true ? ` ${name}` : ` ${name}="${escapeAttr(v)}"`
    }
    i = 1
  }
  if (VOID.has(tag)) return `<${tag}${attrs}>`
  let body = ''
  for (const child of rest.slice(i)) body += child === 0 ? inner() : specHTML(child as DOMOutputSpec, inner)
  return `<${tag}${attrs}>${body}</${tag}>`
}

function nodeHTML(node: Node): string {
  if (node.isText) {
    // ponytail: marks wrap each text node on its own (no merging across neighbours); equal HTML for a reader.
    return node.marks.reduceRight((html, mark) => specHTML(mark.type.spec.toDOM!(mark, true), () => html), escapeText(node.text!))
  }
  const toDOM = node.type.spec.toDOM
  const inner = () => { let s = ''; node.forEach((child) => { s += nodeHTML(child) }); return s }
  return toDOM ? specHTML(toDOM(node), inner) : inner()
}

/**
 * The HTML of a value, rendered with the extensions' `render` specs: text and attributes escaped, URLs checked. Use it
 * to show stored content on a page that ships no editor at all.
 * @example
 * const html = renderHTML(message.body, composerExtensions())
 * @see https://clarusjs.com/guide/editor-composer#on-the-server
 */
export function renderHTML(value: string | object, extensions: Extension[], options: { format?: Format } = {}): string {
  const doc = parse(value, schemaOf(extensions), options.format ?? 'json')
  let html = ''
  doc.forEach((child) => { html += nodeHTML(child) })
  return html
}
