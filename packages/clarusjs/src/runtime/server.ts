// Server-side helpers used by compiled render() functions. Runs at build time or per request, never in the browser.
import { attrHtml, escape, HTML } from './html.ts'
import { stringify } from './serialize.ts'

export { escape, json, blockHtml, forHtml, regionHtml, spreadHtml } from './html.ts'
export { classValue, styleValue } from './attrs.ts'

/**
 * Wrap a stateful component's HTML in its island boundary: name, client chunk URL, props (`p`) and, when the
 * component has state, the state values it rendered with (`s`), so the browser starts from the same values.
 * @internal Compiled components call this; apps don't.
 */
export function island(name: string, src: string, props: Record<string, unknown>, html: string, state?: Record<string, unknown>, attach?: string, paths?: Record<string, unknown>): string {
  const s = state === undefined ? '' : ` s="${escape(toBrowser(state))}"`
  const a = attach && attach !== 'load' ? ` a="${escape(attach)}"` : '' // when to attach: see runtime/loader.ts
  // A component bound two ways carries each binding's path for the forms engine (clarusjs/forms), given by its parent.
  const d = Object.entries(paths ?? {}).map(([model, path]) => ` data-cl-path-${escape(model)}="${escape(String(path))}"`).join('')
  return `<cl-island c="${escape(name)}" src="${escape(src)}" p="${escape(toBrowser(props))}"${s}${a}${d}>${html}</cl-island>`
}

/**
 * The parts of a template level that calls components or places slots (#430): joined into a string, or into a
 * promise of one when a part is a promise (a component that awaits in its <script server>). @internal
 */
export function join(parts: unknown[]): string | Promise<string> {
  return parts.some((p) => p instanceof Promise) ? Promise.all(parts).then((all) => all.join('')) : parts.join('')
}

/**
 * An @await outside islands (#430): the server waits for the promise and renders @then with the value or @catch
 * with the error; without @catch, a rejection fails the render. @internal
 */
export async function awaitHtml(promise: unknown, then: ((v: unknown) => string | Promise<string>) | null, caught: ((e: unknown) => string | Promise<string>) | null): Promise<string> {
  let value: unknown
  try {
    value = await promise
  } catch (err) {
    if (!caught) throw err
    return caught(err)
  }
  return then ? then(value) : ''
}

/** A child component's HTML inside an island: a promise (it awaits) is an error naming both. @internal */
export function sync(html: string | Promise<string>, child: string, island: string): string {
  if (typeof html === 'string') return html
  html.catch(() => {}) // its own rejection isn't the error to report
  throw new Error(`[clarusjs] <${child}> awaits in its <script server>, so it can't be inside the island <${island}>: an island re-renders its children in the browser, where it can't wait. Render <${child}> outside the island, or load its data in a parent and pass it in as props`)
}

/** ` name="value"`, ` name` (true) or '' (false/null/undefined), escaped and URL-checked. @internal */
export const attr = attrHtml

/**
 * Serialize data for the browser (an island's props and state, a client route's data), refusing h() output first: it's
 * HTML for server-rendered pages, and serialized it would only be a confusing "it is a function" error.
 * @internal clarusjs's own server code calls this; apps don't.
 */
export function toBrowser(value: unknown, path = '', seen = new Set<object>()): string {
  if (value && typeof value === 'object' && !seen.has(value)) {
    if ((value as { [HTML]?: unknown })[HTML] === true) throw new TypeError(`[clarusjs] cannot send ${path || 'the value'} to the browser: it is h() output (HTML for server-rendered pages); an island's props and a client route's data can only be data`)
    seen.add(value)
    for (const [key, item] of Object.entries(value)) toBrowser(item, path ? `${path}.${key}` : key, seen)
  }
  return path ? '' : stringify(value)
}

/**
 * The data a component's loader returned for the page being rendered (#97), or nothing outside such a render. Read by
 * compiled components that have a loader. @internal
 */
export function loaded(key: string): object {
  // The server handler keeps each render's data in an AsyncLocalStorage (#430: a render may pause at an await);
  // this module stays free of Node APIs (it also runs in the docs playground), so it only reads it.
  const scope = globalThis as { __clLoaded?: Map<string, object>; __clLoadedStore?: { getStore(): Map<string, object> | undefined } }
  return (scope.__clLoadedStore?.getStore() ?? scope.__clLoaded)?.get(key) ?? {}
}

/**
 * Render with component loaders' results available to `loaded()`. Rendering is synchronous, so one render's data never
 * reaches another's; the previous data is restored afterwards, even when the render throws. @internal
 */
export function withLoaded<T>(data: Map<string, object>, render: () => T): T {
  const scope = globalThis as { __clLoaded?: Map<string, object> }
  const outer = scope.__clLoaded
  scope.__clLoaded = data
  try {
    return render()
  } finally {
    scope.__clLoaded = outer
  }
}
