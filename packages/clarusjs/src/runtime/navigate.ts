// Which navigations clarusjs takes over, in one place for the fragment navigator and the client router. Browser
// only. Each passes a picker: given the URL, it returns how to render that page, or nothing to leave it alone.

export type Render = (url: URL, isCurrent: () => boolean) => Promise<unknown>
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
  swapping = true
  e.intercept({
    handler: () => render(url, isCurrent).catch(() => {
      if (!isCurrent()) return
      fallback = url.href
      location.reload() // the URL is already committed; assign() would stay in the page with a #hash
    }).finally(() => { if (latest == id) swapping = false }) as Promise<void>,
  })
}
