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
