// Moving between pages from islands: `import { navigate, back, currentUrl } from 'clarusjs/navigation'`.
// Navigations go through the Navigation API, so the page's navigator (fragments or the client router) takes them
// over exactly like a link click; without it they are normal page loads. Island scripts also run on the server,
// where this does nothing.
import { effect, onDispose, state, type Signal } from './signals.ts'
import type { Transition } from './navigate.ts'

export type { Transition }

type Navigation = EventTarget & {
  navigate(url: string, options: { history: 'auto' | 'replace'; state?: unknown; info?: unknown }): { finished: Promise<unknown> }
  currentEntry?: { getState(): unknown } | null
}
const navigation = (globalThis as { navigation?: Navigation }).navigation
const browser = typeof document !== 'undefined'

/**
 * The current page's URL, as a store: `let here = shared(currentUrl)` in an island's script. `null` on the server
 * (what the server renders), so pass the page's path as a prop when the server HTML needs it.
 * @example
 * ```tscl
 * <script>
 *   import { currentUrl } from 'clarusjs/navigation'
 *   let here = shared(currentUrl)
 * </script>
 * <a href="/guide" [class]="here?.pathname === '/guide' ? 'active' : ''">Guide</a>
 * ```
 * @see https://clarusjs.com/reference/navigation#currenturl
 * @see https://clarusjs.com/guide/fragment-navigation
 */
export const currentUrl: Signal<URL | null> = state(browser ? new URL(location.href) : null)
if (browser) {
  const update = () => currentUrl.set(new URL(location.href))
  // currententrychange covers links, back/forward and the page's own pushState/replaceState; without the
  // Navigation API, only back/forward and #hash changes happen within a page.
  if (navigation) navigation.addEventListener('currententrychange', update)
  else for (const type of ['popstate', 'hashchange']) addEventListener(type, update)
}

/**
 * The current page's query, as a store kept in step with `currentUrl`: `let query = shared(searchParams)`, then
 * `query?.get('q')`. `null` on the server, like `currentUrl`. Change it with `setSearch()`.
 * @example
 * ```tscl
 * <script>
 *   import { searchParams } from 'clarusjs/navigation'
 *   let query = shared(searchParams)
 * </script>
 * <p>Results for {{ query?.get('q') ?? 'everything' }}</p>
 * ```
 * @see https://clarusjs.com/guide/navigation#query-strings
 */
export const searchParams: Signal<URLSearchParams | null> = state(currentUrl.get() ? new URLSearchParams(currentUrl.get()!.search) : null)
effect(() => {
  const url = currentUrl.get()
  searchParams.set(url ? new URLSearchParams(url.search) : null)
})

/**
 * Change the current URL's query and go there: each key is set (a string or number), repeated (an array) or removed
 * (`null`); the path, hash and other params stay. Replaces the history entry by default, as a search box or filter
 * should (so Back leaves the page, not each keystroke); `{ replace: false }` adds one. Keeps the scroll position by
 * default (`{ scroll: true }` goes to the top, as a new page does).
 * @example
 * ```ts
 * setSearch({ q: input.value, page: null }) // a new search starts at page 1
 * setSearch({ page: 3 }, { replace: false }) // pages are worth a Back step
 * ```
 * @see https://clarusjs.com/guide/navigation#query-strings
 */
export function setSearch(changes: Record<string, string | number | null | readonly (string | number)[]>, options: { replace?: boolean; state?: unknown; scroll?: boolean } = {}): Promise<void> {
  if (!browser) return Promise.resolve()
  const url = new URL(location.href)
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) url.searchParams.delete(key)
    else if (!Array.isArray(value)) url.searchParams.set(key, String(value)) // keeps its place
    else {
      url.searchParams.delete(key)
      for (const v of value) url.searchParams.append(key, String(v))
    }
  }
  return navigate(url, { replace: options.replace ?? true, state: options.state, scroll: options.scroll ?? false })
}

/**
 * What `navigate(url, { state })` stored with the current history entry (`undefined` if nothing, or on the server).
 * Kept by the browser for Back and Forward, not in the URL: for things like where the visitor came from.
 * @example
 * ```ts
 * await navigate('/results', { state: { from: 'search' } })
 * // later, on /results:
 * const from = (navigationState() as { from?: string } | undefined)?.from
 * ```
 * @see https://clarusjs.com/guide/navigation#history-state
 */
export function navigationState<T = unknown>(): T | undefined {
  if (!browser) return undefined
  const entry = navigation?.currentEntry
  return (entry ? entry.getState() : history.state) as T | undefined
}

/**
 * Go to `to`, as a link click would: the page's navigator swaps or renders it. Resolves once the new page is shown,
 * and also when the navigation is cancelled or a newer one replaces it (so check `currentUrl` when it matters);
 * rejects when it fails.
 * @example
 * ```ts
 * async function save() {
 *   await post(form)
 *   await navigate('/account', { replace: true })
 * }
 * ```
 * @see https://clarusjs.com/reference/navigation#navigate
 * @see https://clarusjs.com/guide/fragment-navigation
 */
export async function navigate(to: string | URL, options: { replace?: boolean; state?: unknown; scroll?: boolean } = {}): Promise<void> {
  if (!browser) return
  if (typeof to === 'string') to = addBase(siteBase(), to) // a path without the site's base, as everywhere
  if (!navigation) return options.replace ? location.replace(String(to)) : location.assign(String(to))
  try {
    // scroll: false reaches the navigator (navigate.ts) as info: it keeps the scroll position for this navigation.
    await navigation.navigate(String(to), { history: options.replace ? 'replace' : 'auto', state: options.state, info: { scroll: options.scroll ?? true } }).finished
  } catch (err) {
    if ((err as Error).name != 'AbortError') throw err
  }
}

/**
 * Stops the navigation in progress, like the browser's stop button: its requests are cancelled and, where the URL was
 * held while loading (push and replace in browsers with precommit handlers), page and URL stay as they were. Hooks
 * see it through `t.signal`. Like the stop button, it also stops the page's own loading (images still arriving).
 * @example
 * ```tscl
 * <button (click)="abort()">Stop loading</button>
 * ```
 * @see https://clarusjs.com/reference/navigation#abort
 */
export function abort(): void {
  if (browser) stop()
}

/**
 * Back one entry, like the browser's back button.
 * @example
 * ```tscl
 * <button (click)="back()">Back</button>
 * ```
 * @see https://clarusjs.com/reference/navigation#back
 */
export function back(): void {
  if (browser) history.back()
}

// A hook listens on the Navigation API for as long as the island that registered it (no-op without the API).
function hook(type: string, listener: (e: Event & { navigationType?: string; destination?: { url: string }; error?: unknown }) => void): void {
  if (!navigation) return
  navigation.addEventListener(type, listener)
  onDispose(() => navigation.removeEventListener(type, listener))
}

/**
 * Before any navigation (links, forms, back/forward, `navigate()`): `nav.cancel()` stops it, for example to keep
 * unsaved work. Back/forward can only be cancelled where the browser allows it.
 * @example
 * ```ts
 * beforeNavigate((to, nav) => {
 *   if (dirty && !confirm('Leave without saving?')) nav.cancel()
 * })
 * ```
 * @see https://clarusjs.com/reference/navigation#beforenavigate
 */
export function beforeNavigate(fn: (to: URL, nav: { type: string; cancel(): void }) => void): void {
  hook('navigate', (e) => fn(new URL(e.destination!.url), { type: e.navigationType!, cancel: () => e.preventDefault() }))
}

/**
 * After a navigation within the page finished: the new page is in and its islands attached.
 * @example
 * ```ts
 * afterNavigate((to) => analytics.page(to.pathname))
 * ```
 * @see https://clarusjs.com/reference/navigation#afternavigate
 */
export function afterNavigate(fn: (to: URL) => void): void {
  hook('navigatesuccess', () => fn(new URL(location.href)))
}

/**
 * A navigation failed (a fragment or a client page could not be loaded). The page then loads normally.
 * @example
 * ```ts
 * onNavigateError((to, error) => report(error, { url: to.href }))
 * ```
 * @see https://clarusjs.com/reference/navigation#onnavigateerror
 */
export function onNavigateError(fn: (to: URL, error: unknown) => void): void {
  // Where it was going: a navigation that failed before its URL changed (held while loading) never became current.
  let to = ''
  hook('navigate', (e) => { to = e.destination!.url })
  hook('navigateerror', (e) => fn(new URL(to || location.href), e.error))
}

/**
 * The navigation in progress, as a store (`let nav = shared(navigating)`): `null` when idle, else where it goes and
 * its phase, `'loading'` (the next page is fetched) or `'swapping'` (it replaces this one). For CSS alone,
 * `<html data-cl-navigating>` carries the phase.
 * @example
 * ```tscl
 * <script>
 *   import { navigating } from 'clarusjs/navigation'
 *   let nav = shared(navigating)
 * </script>
 * @if (nav) { <div class="progress" role="status">Loading {{ nav.to.pathname }}…</div> }
 * ```
 * @see https://clarusjs.com/reference/navigation#navigating
 */
export const navigating: Signal<Transition | null> = state(null)
const before: ((t: Transition) => unknown)[] = []
const after: ((t: Transition) => unknown)[] = []
// The page's navigator (the router or fragments, a separate script) reports each step here and waits for it.
if (browser) {
  ;(globalThis as { __clNav?: unknown }).__clNav = async (step: string | undefined, t: Transition) => {
    navigating.set(step ? { ...t } : null)
    if (step != 'swapping') done?.() // the new page is in (or the navigation ended): the transition animates
    const hooks = step == 'swapping' ? before : step == 'swapped' ? after : []
    // Each hook is awaited in turn; one whose island was released meanwhile (by an earlier hook) is skipped.
    for (const hook of [...hooks]) if (hooks.includes(hook)) await hook(t)
    // A view transition: the browser snapshots this page, then the swap (which waits for this) runs inside it.
    const start = (document as { startViewTransition?(update: () => Promise<void>): { ready: Promise<void> } }).startViewTransition
    if (step == 'swapping' && transitions && start) {
      // A newer page change (Back before this one swapped) skips this transition: its ready rejects, as expected.
      await new Promise<void>((snapshot) => start.call(document, () => { snapshot(); return new Promise<void>((r) => (done = r)) }).ready.catch(() => {}))
    }
  }
}
let transitions = false
let done: (() => void) | undefined

/**
 * Page changes run as view transitions where the browser has them (`document.startViewTransition`), so CSS
 * `::view-transition-*` rules animate them; elsewhere they stay instant. Call it once, from any island's script.
 * `beforeSwap` hooks run before the browser's snapshot, `afterSwap` hooks once the new page is in.
 * @example
 * ```ts
 * // in the layout's island script
 * viewTransitions()
 * ```
 * @see https://clarusjs.com/reference/navigation#viewtransitions
 */
export function viewTransitions(): void {
  transitions = true
}

function inBetween(hooks: ((t: Transition) => unknown)[], fn: (t: Transition) => unknown): void {
  if (!browser) return
  hooks.push(fn)
  onDispose(() => hooks.splice(hooks.indexOf(fn), 1))
}

/**
 * Runs once the next page is loaded, before it replaces this one (animate out, save state). Return a promise to
 * make the navigation wait; `t.signal` aborts when a newer navigation takes over. A hook that throws makes the page
 * load normally.
 * @example
 * ```ts
 * beforeSwap(() => document.querySelector('main')?.animate({ opacity: [1, 0] }, 150).finished)
 * ```
 * @see https://clarusjs.com/reference/navigation#beforeswap
 */
export function beforeSwap(fn: (t: Transition) => unknown): void {
  inBetween(before, fn)
}

/**
 * Runs once the new page is in and its islands attached (animate in, move focus). Return a promise to make the
 * navigation wait for it.
 * @example
 * ```ts
 * afterSwap(() => document.querySelector('h1')?.focus())
 * ```
 * @see https://clarusjs.com/reference/navigation#afterswap
 */
export function afterSwap(fn: (t: Transition) => unknown): void {
  inBetween(after, fn)
}

/**
 * Route → params. Filled in by the generated .clarusjs/routes.d.ts (declaration merging; see `clarusjs check`).
 * @see https://clarusjs.com/reference/navigation#href
 */
export interface Routes {}
/**
 * Without the generated routes any path is accepted; with them, only real routes.
 * @see https://clarusjs.com/reference/navigation#href
 */
export type RouteName = [keyof Routes] extends [never] ? string : Extract<keyof Routes, string>
type ParamsOf<R> = R extends keyof Routes ? Routes[R] : Record<string, string>

/**
 * A page's URL from its route, as its file names it, with the site's base: `href('/releases/[version]',
 * { version: '0.8.0' })` is `'/releases/0.8.0'`. With .clarusjs/routes.d.ts (written by `clarusjs check`), a route
 * that doesn't exist or a missing param is a type error. Params are encoded.
 * @example
 * ```tscl
 * <a [href]="href('/releases/[version]', { version: '0.8.0' })">0.8.0</a>
 * ```
 * @see https://clarusjs.com/reference/navigation#href
 */
export function href<R extends RouteName>(
  route: R,
  // Without the generated routes, params are optional; with them, required exactly when the route has some.
  ...params: [keyof Routes] extends [never] ? [Record<string, string>?] : keyof ParamsOf<R> extends never ? [] : [ParamsOf<R>]
): string {
  const values = (params[0] ?? {}) as Record<string, string>
  const base = ((import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/').replace(/\/$/, '')
  return base + route.replace(/\[([^\]]+)\]/g, (_, key: string) => encodeURIComponent(values[key] ?? ''))
}

const siteBase = () => (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'

/** `path` with `base` in front, when it's root-relative (one `/`). @internal withBase() and navigate() call this. */
export function addBase(base: string, path: string): string {
  const b = base.replace(/\/$/, '')
  // already under it (href() gives such paths): as it is, so the base never doubles
  return path.startsWith('/') && !path.startsWith('//') && path !== b && !path.startsWith(b + '/') ? b + path : path
}

/** `url` without a leading `base`: the reverse of addBase(). @internal withoutBase() calls this. */
export function removeBase(base: string, url: string): string {
  const b = base.replace(/\/$/, '')
  if (!b) return url
  if (url === b) return '/'
  return url.startsWith(b + '/') ? url.slice(b.length) : url
}

/**
 * A root-relative path with the site's base (Vite's `base`): `withBase('/guide')` is `/docs/guide` at a site under
 * `/docs/`; a path already under it is returned as it is. For URLs built in code (`fetch()`, a link from data); templates' URL attributes get the base by themselves.
 * Full URLs, `//host`, `#…`, `?…` and relative paths are returned as they are.
 * @example
 * fetch(withBase('/api/items'))
 * @see https://clarusjs.com/reference/navigation#withbase
 */
export function withBase(path: string): string {
  return addBase(siteBase(), path)
}

/**
 * A URL's path without the site's base, the reverse of `withBase()`: `/docs/guide` is `/guide` at a site under
 * `/docs/`, to compare a link (which has the base) with a route (which doesn't). Others are returned as they are.
 * @example
 * withoutBase(link.getAttribute('href')) === '/guide'
 * @see https://clarusjs.com/reference/navigation#withoutbase
 */
export function withoutBase(url: string): string {
  return removeBase(siteBase(), url)
}
