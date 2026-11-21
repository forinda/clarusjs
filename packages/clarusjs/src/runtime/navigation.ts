// Moving between pages from islands: `import { navigate, back, currentUrl } from 'clarusjs/navigation'`.
// Navigations go through the Navigation API, so the page's navigator (fragments or the client router) takes them
// over exactly like a link click; without it they are normal page loads. Island scripts also run on the server,
// where this does nothing.
import { onDispose, state, type Signal } from './signals.ts'
import type { Transition } from './navigate.ts'

export type { Transition }

type Navigation = EventTarget & {
  navigate(url: string, options: { history: 'auto' | 'replace'; state?: unknown }): { finished: Promise<unknown> }
}
const navigation = (globalThis as { navigation?: Navigation }).navigation
const browser = typeof document !== 'undefined'

/**
 * The current page's URL, as a store: `let here = shared(currentUrl)` in an island's script. `null` on the server
 * (what the server renders), so pass the page's path as a prop when the server HTML needs it.
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
 * Go to `to`, as a link click would: the page's navigator swaps or renders it. Resolves once the new page is shown,
 * or when a newer navigation replaces this one; rejects when it fails.
 * @see https://clarusjs.com/guide/fragment-navigation
 * @see https://clarusjs.com/guide/client-routes
 */
export async function navigate(to: string | URL, options: { replace?: boolean; state?: unknown } = {}): Promise<void> {
  if (!browser) return
  if (!navigation) return options.replace ? location.replace(String(to)) : location.assign(String(to))
  try {
    await navigation.navigate(String(to), { history: options.replace ? 'replace' : 'auto', state: options.state }).finished
  } catch (err) {
    if ((err as Error).name != 'AbortError') throw err
  }
}

/**
 * Stops the navigation in progress, like the browser's stop button: its requests are cancelled and, where the URL was
 * held while loading (push and replace in browsers with precommit handlers), page and URL stay as they were. Hooks
 * see it through `t.signal`. Like the stop button, it also stops the page's own loading (images still arriving).
 * @see https://clarusjs.com/guide/navigation
 */
export function abort(): void {
  if (browser) stop()
}

/** Back one entry, like the browser's back button. */
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
 * @see https://clarusjs.com/guide/navigation
 */
export function beforeNavigate(fn: (to: URL, nav: { type: string; cancel(): void }) => void): void {
  hook('navigate', (e) => fn(new URL(e.destination!.url), { type: e.navigationType!, cancel: () => e.preventDefault() }))
}

/**
 * After a navigation within the page finished: the new page is in and its islands attached.
 * @see https://clarusjs.com/guide/navigation
 */
export function afterNavigate(fn: (to: URL) => void): void {
  hook('navigatesuccess', () => fn(new URL(location.href)))
}

/**
 * A navigation failed (a fragment or a client page could not be loaded). The page then loads normally.
 * @see https://clarusjs.com/guide/navigation
 */
export function onNavigateError(fn: (to: URL, error: unknown) => void): void {
  hook('navigateerror', (e) => fn(new URL(location.href), e.error))
}

/**
 * The navigation in progress, as a store (`let nav = shared(navigating)`): `null` when idle, else where it goes and
 * its phase, `'loading'` (the next page is fetched) or `'swapping'` (it replaces this one). For CSS alone,
 * `<html data-cl-navigating>` carries the phase.
 * @see https://clarusjs.com/guide/navigation
 */
export const navigating: Signal<Transition | null> = state(null)
const before: ((t: Transition) => unknown)[] = []
const after: ((t: Transition) => unknown)[] = []
// The page's navigator (the router or fragments, a separate script) reports each step here and waits for it.
if (browser) {
  ;(globalThis as { __clNav?: unknown }).__clNav = async (step: string | undefined, t: Transition) => {
    navigating.set(step ? { ...t } : null)
    for (const hook of step == 'swapping' ? [...before] : step == 'swapped' ? [...after] : []) await hook(t)
  }
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
 * @see https://clarusjs.com/guide/navigation
 */
export function beforeSwap(fn: (t: Transition) => unknown): void {
  inBetween(before, fn)
}

/**
 * Runs once the new page is in and its islands attached (animate in, move focus). Return a promise to make the
 * navigation wait for it.
 * @see https://clarusjs.com/guide/navigation
 */
export function afterSwap(fn: (t: Transition) => unknown): void {
  inBetween(after, fn)
}
