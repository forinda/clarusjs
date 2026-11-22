// HTML-string helpers used by compiled code on the server (render) and in the browser (branch HTML for @if).
import { attrValue, spreadAttrs } from './attrs.ts'

/** The mark of h()'s output (clarusjs/views). Symbol.for: two copies of the module agree. @internal */
export const HTML = Symbol.for('clarusjs.html')

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/** Escape a value for HTML text or a double-quoted attribute. null/undefined render as ''. @internal */
export function escape(value: unknown): string {
  if (value == null) return ''
  // h()'s output (clarusjs/views): HTML built from escaped parts, marked with a symbol data can't carry (JSON can't).
  if (typeof value === 'object' && (value as { [HTML]?: unknown })[HTML] === true) return (value as { html: string }).html
  return String(value).replace(/[&<>"']/g, (ch) => ENTITIES[ch]!)
}

/** A value as JSON for a <script> (JSON-LD): <, >, & and line separators escaped, so it can't end the script. @internal */
export function json(value: unknown): string {
  return (JSON.stringify(value) ?? 'null').replace(/[<>&\u2028\u2029]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`)
}

const warned = new Set<string>()

/**
 * A spread's attributes as HTML (#405); `where` (file:line:col, server code only) names the place in a warning for
 * each key it drops, once.
 * @internal
 */
export function spreadHtml(obj: unknown, skip: readonly string[], tag?: string, where?: string): string {
  const { set, dropped } = spreadAttrs(obj, skip, tag)
  // Once per place and reason, not per key: keys come from data, so a set of them could grow without end on a server.
  if (where) for (const [key, why] of dropped) {
    if (warned.has(`${where} ${why}`)) continue
    warned.add(`${where} ${why}`)
    console.warn(`[clarusjs] ${where}: [...] dropped ${JSON.stringify(key)} (${why})`)
  }
  return set.map(([name, v]) => (v === null ? '' : v === true ? ` ${name}` : ` ${name}="${escape(v)}"`)).join('')
}

/** ` name="value"`, ` name` (true) or '' (false/null/undefined), escaped and URL-checked. @internal */
export function attrHtml(name: string, value: unknown, tag?: string): string {
  const v = attrValue(name, value, tag)
  return v === null ? '' : v === true ? ` ${name}` : ` ${name}="${escape(v)}"`
}

/** An @if block inside an island: markers record which branch (k, or -1 for none) was rendered. @internal */
export function blockHtml(index: number, k: number, branches: (() => string)[]): string {
  return `<!--[b${index}:${k}-->${k >= 0 ? branches[k]!() : ''}<!--]-->`
}

/** A @for list inside an island: one marker pair around the list, one per row, one around @empty content. @internal */
export function forHtml(index: number, list: unknown, row: (item: any, i: number, list: unknown[]) => string, empty: (() => string) | null): string {
  const items = [...((list ?? []) as Iterable<unknown>)]
  const body = items.length
    ? items.map((item, i) => `<!--[r-->${row(item, i, items)}<!--]-->`).join('')
    : empty ? `<!--[e-->${empty()}<!--]-->` : ''
  return `<!--[f${index}-->${body}<!--]-->`
}

/** A child component inside an island that the browser may re-render: markers around its HTML. @internal */
export function regionHtml(index: number, html: () => string): string {
  return `<!--[c${index}-->${html()}<!--]-->`
}
