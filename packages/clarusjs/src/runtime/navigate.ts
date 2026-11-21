// Which navigations clarusjs takes over, in one place for the fragment navigator and the client router. Browser
// only. Each passes a picker: given the URL, it returns how to render that page, or nothing to leave it alone.

/** `gate()` is awaited right before the page changes the document: false means stop (a newer navigation won). */
/** `signal`: aborts when the navigation does (pass it to the page's requests). */
export type Render = (url: URL, gate: () => Promise<boolean> | boolean, signal?: AbortSignal) => Promise<unknown>
/** A navigation in progress, as the in-between hooks and the navigating store see it. */
export type Transition = { from: URL; to: URL; type: string; phase: 'loading' | 'swapping'; signal: AbortSignal }
// Set by clarusjs/navigation, which islands bundle separately: told each step of a navigation (loading, swapping,
// swapped, then undefined when it ends), it runs the in-between hooks and updates the navigating store. The
// navigation waits for the promise it returns.
type Step = Transition['phase'] | 'swapped' | undefined
type Hub = (step: Step, t: Transition) => unknown
type Pick = (url: URL) => Render | false | null | undefined

type NavigateEvent = {
  canIntercept: boolean
  hashChange: boolean
  downloadRequest: string | null
  formData: FormData | null
  destination: { url: string; sameDocument: boolean }
  navigationType: string
  signal: AbortSignal
  intercept(options: { handler(): Promise<void>; precommitHandler?(): Promise<void> }): void
}

/** The number of the latest navigation taken over (0 before any): only that one may change the document. */
export let latest = 0
// A URL that failed to render loads normally, never taken over again (its reload is itself a navigation to it).
let fallback = ''
let swapping = false
// The URL a held navigation is loading (not committed yet).
let held = ''

/**
 * Take over the navigations `pick` wants. A page loads one navigator (the router or fragments), so one picker.
 * @see https://clarusjs.com/guide/client-routes
 * @see https://clarusjs.com/guide/fragment-navigation
 */
export function takeOver(pick: Pick): void {
  ;(globalThis as { navigation?: EventTarget }).navigation?.addEventListener('navigate', (e) => onNavigate(e as never, pick))
}

export function onNavigate(e: NavigateEvent, pick: Pick): void {
  // A #hash, and the page's own history.pushState/replaceState (same-document push or replace), are never a page
  // load, except while a swap runs after its URL changed: they abort it, so this navigation shows the new page.
  if (!e.canIntercept || e.hashChange || e.downloadRequest != null || e.formData) return
  // Push and replace (same-document ones too: never reloads; back/forward is a traverse).
  const hold = /^(p|rep)/.test(e.navigationType)
  if (e.destination.sameDocument && hold && !swapping) {
    // The page's own history change aborts a navigation whose URL is held: it goes on to its page right after.
    if (held) setTimeout((navigation as { navigate(url: string): unknown }).navigate.bind(navigation, held)) // it fired this event
    return
  }
  const url = new URL(e.destination.url)
  const render = url.href != fallback && pick(url)
  if (!render) return
  const id = ++latest
  const isCurrent = () => latest == id && !e.signal.aborted
  const t: Transition = { from: new URL(location.href), to: url, type: e.navigationType, phase: 'loading', signal: e.signal }
  const data = document.documentElement.dataset
  // Each step: on <html data-cl-navigating> (for CSS), then to clarusjs/navigation when an island loaded it.
  const step = async (s?: Step) => {
    if (s != 'swapped') s ? (data.clNavigating = t.phase = s) : delete data.clNavigating
    await (globalThis as { __clNav?: Hub }).__clNav?.(s, t)
  }
  step('loading')
  // Push and replace hold the URL while the page loads, where the browser can (precommitHandler; others ignore it and
  // only run handler): it changes once the page is ready to swap in, so an abort before that leaves page and URL as
  // they were. Back/forward and reloads change it at once. Until its URL changes, a held navigation leaves the page's
  // own history changes alone (see above).
  swapping = !hold
  held = hold ? url.href : ''
  let ready!: () => void
  let commit!: () => void
  const atGate = new Promise<void>((r) => (ready = r))
  const onCommit = new Promise<void>((r) => (commit = () => { swapping = true; r() }))
  let running: Promise<void> | undefined
  const work = () => (running = render(url, async () => {
    if (!isCurrent()) return false
    ready()
    await onCommit
    await step('swapping')
    return isCurrent()
  }, e.signal).then((): unknown => isCurrent() && step('swapped')).catch((err: unknown) => {
    if (!isCurrent()) return
    fallback = url.href
    // Loaded normally: a reload once the URL changed (assign() would only move within the page with a #hash), else
    // the new URL.
    location.href == url.href ? location.reload() : location.assign(url.href)
    throw err // reported as navigateerror (onNavigateError)
  }).finally(() => {
    ready() // a held URL is released either way: the page is swapped in, or loads normally
    if (latest == id) { swapping = false; held = ''; step() }
  }) as Promise<void>)
  e.intercept({
    precommitHandler: hold ? () => (work(), atGate) : undefined,
    handler: () => (commit(), running ?? work()),
  })
}
