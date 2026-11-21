// Server-side helpers used by compiled render() functions. Runs at build time or per request, never in the browser.
import { attrHtml, escape } from './html.ts'
import { stringify } from './serialize.ts'

export { escape, json, blockHtml, forHtml, regionHtml } from './html.ts'

/**
 * Wrap a stateful component's HTML in its island boundary: name, client chunk URL, props (`p`) and, when the
 * component has state, the state values it rendered with (`s`), so the browser starts from the same values.
 */
export function island(name: string, src: string, props: Record<string, unknown>, html: string, state?: Record<string, unknown>, attach?: string, path?: unknown): string {
  const s = state === undefined ? '' : ` s="${escape(stringify(state))}"`
  const a = attach && attach !== 'load' ? ` a="${escape(attach)}"` : '' // when to attach: see runtime/loader.ts
  // A component bound two ways carries its path for the forms engine (clarusjs/forms), given by its parent.
  const d = path === undefined ? '' : ` data-cl-path="${escape(String(path))}"`
  return `<cl-island c="${escape(name)}" src="${escape(src)}" p="${escape(stringify(props))}"${s}${a}${d}>${html}</cl-island>`
}

/** ` name="value"`, ` name` (true) or '' (false/null/undefined), escaped and URL-checked. */
export const attr = attrHtml
