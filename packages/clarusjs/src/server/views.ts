// render(name, props): any view under src/ rendered to HTML from server code (a loader, an endpoint, a script that
// imports the built server). The server entry registers the views; `clarusjs check` writes .clarusjs/views.d.ts,
// which types each name with that view's inputs.

import { baseUrl } from '../runtime/attrs.ts'
import { attrHtml, escape, HTML } from '../runtime/html.ts'

// The site's base (Vite's), for the URL attributes h() writes: the handler sets it.
// The base h() gives URLs: the handler's own, for the whole request (load() and render; createHandler() keeps it in an
// AsyncLocalStorage), so two handlers in one process, or overlapping requests, don't mix theirs. Outside a request: '/'.
const requestBase = () => (globalThis as { __clViewBase?: { getStore(): string | undefined } }).__clViewBase?.getStore()
/** @internal createHandler() calls this with its base. */
type View = { render(props?: object, slots?: Record<string, string>): string | Promise<string> } // async: a <script server> that awaits (#430)
type Registry = Record<string, () => Promise<View>>

/**
 * View name → inputs. Filled in by the generated .clarusjs/views.d.ts (declaration merging).
 * @see https://clarusjs.com/reference/server#render
 */
export interface Views {}

/**
 * Without the generated registry any name is accepted; with it, only real views.
 * @see https://clarusjs.com/reference/server#render
 */
export type ViewName = [keyof Views] extends [never] ? string : Extract<keyof Views, string>
/**
 * A view's props: its inputs, from the generated registry.
 * @see https://clarusjs.com/reference/server#render
 */
export type ViewProps<N> = N extends keyof Views ? Views[N] : Record<string, unknown>

/** '/src/components/pill.tscl' → 'components/pill' @internal */
export function viewName(file: string): string {
  return file.replace(/^.*?\/src\//, '').replace(/\.[^./]+$/, '')
}

// On globalThis: the bundled server and an app's own `import 'clarusjs/views'` may be two copies of this module.
const store = globalThis as { __clViews?: Map<string, () => Promise<View>> }

/** Called by the server entry with import.meta.glob('/src/**\/*.tscl'). @internal */
export function registerViews(files: Registry): void {
  store.__clViews = new Map(Object.entries(files).map(([file, load]) => [viewName(file), load]))
}

/**
 * Render a view (any `.tscl` under src/, by its path without the extension) to HTML, from server code: a `load()`,
 * an endpoint, a script importing the built server. Its props are checked against its inputs once `clarusjs check`
 * has generated the registry.
 * @example
 * ```ts
 * import { render } from 'clarusjs/views'
 * const html = await render('components/pill', { text: 'new' })
 * ```
 * @see https://clarusjs.com/reference/server#render
 */
export async function render<N extends ViewName>(name: N, props: ViewProps<N>): Promise<string> {
  const views = store.__clViews
  if (!views) throw new Error('clarusjs: no views are registered; render() runs in server code, after the server entry has loaded')
  const load = views.get(name)
  if (!load) throw new Error(`clarusjs: no view "${name}"; views: ${[...views.keys()].sort().join(', ')}`)
  return (await load()).render(props as object)
}

/**
 * HTML that `h()` built: a template's `{{ }}` inserts it as it is (any other value is escaped). Only `h()` makes one,
 * from escaped parts; data (JSON) can't. It's for server-rendered pages and components: it can't be sent to the
 * browser (an island's props, a client route's data).
 * @see https://clarusjs.com/reference/server#h
 */
export type Html = { readonly [HTML]: true; readonly html: string; toString(): string }
/**
 * What `h()` takes as children: text (escaped), `h()` results, numbers, nothing (null, false), and lists of these.
 * @see https://clarusjs.com/reference/server#h
 */
export type Children = Html | string | number | boolean | null | undefined | Promise<Html> | Children[]

const html = (s: string): Html => ({ [HTML]: true, html: s, toString: () => s })
const VOID = new Set(['area', 'br', 'col', 'hr', 'img', 'input', 'source', 'track', 'wbr'])
// Tags that load or run things: in a .tscl view, where the compiler's rules apply, not from code.
const REFUSED = new Set(['script', 'style', 'iframe', 'frame', 'object', 'embed', 'base', 'link', 'meta', 'template'])

async function childrenHtml(children: Children): Promise<string> {
  const c = await children
  if (c == null || typeof c === 'boolean') return ''
  if (Array.isArray(c)) return (await Promise.all(c.map(childrenHtml))).join('')
  return escape(c) // text escaped; h()'s output inserted as it is
}

/**
 * Build HTML in server code: an element (`'p'`, `'div'`), or a view (any `.tscl` under src/, by its path:
 * `'components/card'`), with props or attributes and children. Text is escaped and attributes are URL-checked, as in
 * templates; `h()` results nest. Put the result in a page through `load()`: `{{ }}` inserts it as HTML. Take view and
 * tag names from your own list, never from request data or a database.
 * @param name An element's tag, or a view's name (it has a `/`).
 * @param props A view's inputs, or an element's attributes (`on*`, `srcdoc` refused).
 * @param children The default slot's (or element's) content; for a view, an object fills named slots.
 * @example
 * ```ts
 * // src/pages/index.load.ts
 * import { h } from 'clarusjs/views'
 * export async function load() {
 *   const picked = await getWidgets() // [{ view: 'components/chart', props: {…} }, …]
 *   return { widgets: await h('div', { class: 'grid' }, picked.map((w) => h(w.view, w.props))) }
 * }
 * // src/pages/index.tscl: @input widgets: any … <main>{{ widgets }}</main>
 * ```
 * @see https://clarusjs.com/reference/server#h
 */
export async function h<N extends ViewName>(name: N | (string & {}), props: (N extends ViewName ? ViewProps<N> : never) | Record<string, unknown> = {}, children: Children | Record<string, Children> = []): Promise<Html> {
  if (name.includes('/')) {
    const views = store.__clViews
    const load = views?.get(name)
    if (!load) throw new Error(`clarusjs: no view "${name}"${views ? `; views: ${[...views.keys()].sort().join(', ')}` : ' (h() runs in server code, after the server entry has loaded)'}`)
    const named = children && typeof children === 'object' && !Array.isArray(children) && !(children as { [HTML]?: unknown })[HTML] && !(children instanceof Promise)
    const slots: Record<string, string> = {}
    // All at once, so every slot's failure is observed (one rejected slot doesn't leave another's unhandled).
    const entries = Object.entries(named ? (children as Record<string, Children>) : { default: children as Children })
    const filled = await Promise.all(entries.map(([, content]) => childrenHtml(content)))
    entries.forEach(([slot], k) => { if (filled[k]) slots[slot] = filled[k]! }) // only slots with content: a view without a <slot /> takes no children
    return html(await (await load()).render(props as object, Object.keys(slots).length ? slots : undefined))
  }
  const tag = name.toLowerCase()
  if (!/^[a-z][a-z0-9-]*$/.test(tag)) throw new Error(`h(): "${name}" isn't a tag or a view name (views have a /, such as "components/card")`)
  // cl-*: clarusjs's own markup (a cl-island loads and runs the script at its src).
  if (REFUSED.has(tag) || tag.startsWith('cl-')) throw new Error(`h(): <${tag}> loads or runs things: write it in a .tscl view, where the compiler checks it`)
  if (children && typeof children === 'object' && !Array.isArray(children) && !(children as { [HTML]?: unknown })[HTML] && !(children instanceof Promise)) throw new Error(`h(): named slots are for views; <${tag}> takes a list of children`)
  let attrs = ''
  for (const [key, value] of Object.entries(props as Record<string, unknown>)) {
    if (!/^[^\s"'>/=]+$/.test(key)) throw new Error(`h(): "${key}" isn't an attribute name`)
    if (/^on/i.test(key) || key.toLowerCase() === 'srcdoc') throw new Error(`h(): "${key}" can't be set from code (event handlers and srcdoc run code); use a .tscl view`)
    attrs += attrHtml(key, baseUrl(requestBase() ?? '/', key, value), tag) // a root-relative URL gets the site's base, as in templates
  }
  const inner = await childrenHtml(children as Children)
  if (VOID.has(tag) && inner) throw new Error(`h(): <${tag}> can't have children`)
  return html(VOID.has(tag) ? `<${tag}${attrs}>` : `<${tag}${attrs}>${inner}</${tag}>`)
}
