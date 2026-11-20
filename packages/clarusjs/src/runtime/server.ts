// Server-side helpers used by compiled render() functions. Runs at build time or per request, never in the browser.
import { attrValue } from './attrs.ts'

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/** Escape a value for HTML text or a double-quoted attribute. null/undefined render as ''. */
export function escape(value: unknown): string {
  if (value == null) return ''
  return String(value).replace(/[&<>"']/g, (ch) => ENTITIES[ch]!)
}

function assertSerializable(value: unknown, path: string): void {
  const t = typeof value
  if (t === 'function' || t === 'symbol' || t === 'bigint') {
    throw new TypeError(`[clarusjs] island prop "${path}" is a ${t}; island props must be JSON-serializable`)
  }
  if (t === 'number' && !Number.isFinite(value)) {
    throw new TypeError(`[clarusjs] island prop "${path}" is ${value}; island props must be JSON-serializable`)
  }
  if (value && t === 'object') {
    for (const [k, v] of Object.entries(value)) assertSerializable(v, path ? `${path}.${k}` : k)
  }
}

/** Wrap a stateful component's HTML in its island boundary: name, client chunk URL, serialized props. */
export function island(name: string, src: string, props: Record<string, unknown>, html: string): string {
  assertSerializable(props, '')
  return `<cl-island c="${escape(name)}" src="${escape(src)}" p="${escape(JSON.stringify(props))}">${html}</cl-island>`
}

/** ` name="value"`, ` name` (true) or '' (false/null/undefined), escaped and URL-checked. */
export function attr(name: string, value: unknown, tag?: string): string {
  const v = attrValue(name, value, tag)
  return v === null ? '' : v === true ? ` ${name}` : ` ${name}="${escape(v)}"`
}
