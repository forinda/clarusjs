// HTML-string helpers used by compiled code on the server (render) and in the browser (branch HTML for @if).
import { attrValue } from './attrs.ts'

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/** Escape a value for HTML text or a double-quoted attribute. null/undefined render as ''. @internal */
export function escape(value: unknown): string {
  if (value == null) return ''
  return String(value).replace(/[&<>"']/g, (ch) => ENTITIES[ch]!)
}

/** A value as JSON for a <script> (JSON-LD): <, >, & and line separators escaped, so it can't end the script. @internal */
export function json(value: unknown): string {
  return (JSON.stringify(value) ?? 'null').replace(/[<>&\u2028\u2029]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`)
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
