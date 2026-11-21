// Which navigations clarusjs takes over, in one place for the fragment navigator and the client router. Browser
// only. Each passes a picker: given the URL, it returns how to render that page, or nothing to leave it alone.

/** `gate()` is awaited right before the page changes the document: false means stop (a newer navigation won). */
export type Render = (url: URL, gate: () => Promise<boolean> | boolean) => Promise<unknown>
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
  intercept(options: { handler(): Promise<void> }): void
}

/** The number of the latest navigation taken over (0 before any): only that one may change the document. */
export let latest = 0
// A URL that failed to render loads normally, never taken over again (its reload is itself a navigation to it).
let fallback = ''
let swapping = false

/**
 * Take over the navigations `pick` wants. A page loads one navigator (the router or fragments), so one picker.
 * @see https://clarusjs.com/guide/client-routes
 * @see https://clarusjs.com/guide/fragment-navigation
 */
export function takeOver(pick: Pick): void {
  ;(globalThis as { navigation?: EventTarget }).navigation?.addEventListener('navigate', (e) => onNavigate(e as never, pick))
}

export function onNavigate(e: NavigateEvent, pick: Pick): void {
  // A #hash, and the page's own history.pushState/replaceState (same-document, not back/forward), are never a page
  // load, except while a render is still loading: they abort it, so this navigation has to show the new page.
  if (!e.canIntercept || e.hashChange || (e.destination.sameDocument && e.navigationType != 'traverse' && !swapping) || e.downloadRequest != null || e.formData) return
  const url = new URL(e.destination.url)
  const render = url.href != fallback && pick(url)
  if (!render) return
  const id = ++latest
  const isCurrent = () => latest == id && !e.signal.aborted
  const t: Transition = { from: new URL(location.href), to: url, type: e.navigationType, phase: 'loading', signal: e.signal }
  const data = document.documentElement.dataset
  // Each step: on <html data-cl-navigating> (for CSS), then to clarusjs/navigation when an island loaded it.
  const step = async (s: Step) => {
    if (s != 'swapped') s ? (data.clNavigating = t.phase = s) : delete data.clNavigating
    await (globalThis as { __clNav?: Hub }).__clNav?.(s, t)
  }
  swapping = true
  step('loading')
  e.intercept({
    handler: () => render(url, async () => isCurrent() && (await step('swapping'), isCurrent()))
      .then((): unknown => isCurrent() && step('swapped')).catch((err: unknown) => {
        if (!isCurrent()) return
        fallback = url.href
        location.reload() // the URL is already committed; assign() would stay in the page with a #hash
        throw err // reported as navigateerror (onNavigateError)
      }).finally(() => { if (latest == id) { swapping = false; step(undefined) } }) as Promise<void>,
  })
}
