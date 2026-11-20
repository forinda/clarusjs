// HTML-string helpers used by compiled code on the server (render) and in the browser (branch HTML for @if).
import { attrValue } from './attrs.ts'

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/** Escape a value for HTML text or a double-quoted attribute. null/undefined render as ''. */
export function escape(value: unknown): string {
  if (value == null) return ''
  return String(value).replace(/[&<>"']/g, (ch) => ENTITIES[ch]!)
}

/** ` name="value"`, ` name` (true) or '' (false/null/undefined), escaped and URL-checked. */
export function attrHtml(name: string, value: unknown): string {
  const v = attrValue(name, value)
  return v === null ? '' : v === true ? ` ${name}` : ` ${name}="${escape(v)}"`
}

/** An @if block inside an island: markers record which branch (k, or -1 for none) was rendered. */
export function blockHtml(index: number, k: number, branches: (() => string)[]): string {
  return `<!--[b${index}:${k}-->${k >= 0 ? branches[k]!() : ''}<!--]-->`
}

/** A @for list inside an island: one marker pair around the list, one per row, one around @empty content. */
export function forHtml(index: number, list: unknown, row: (item: any, i: number) => string, empty: (() => string) | null): string {
  const items = [...((list ?? []) as Iterable<unknown>)]
  const body = items.length
    ? items.map((item, i) => `<!--[r-->${row(item, i)}<!--]-->`).join('')
    : empty ? `<!--[e-->${empty()}<!--]-->` : ''
  return `<!--[f${index}-->${body}<!--]-->`
}
