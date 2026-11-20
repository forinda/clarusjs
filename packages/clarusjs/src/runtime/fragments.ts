// Fragment navigation: moving between static and server pages swaps their region (data-cl-swap, or the body)
// instead of reloading. Browser only. Each page's fragment is <path>/index.frag.html; elements marked
// data-cl-persist="key" are kept across swaps, and the island loader attaches whatever islands arrive.
import './loader.ts'

/** '/guide/lists/' → '/guide/lists/index.frag.html', keeping the query. */
export function fragmentUrl(url: URL): string {
  return `${url.pathname.replace(/\/+$/, '')}/index.frag.html${url.search}`
}

const region = (doc: Document) => doc.querySelector('[data-cl-swap]') ?? doc.body

/** Fetch the page's fragment and swap it in. Throws when there is none (the caller then loads the page normally). */
export async function swap(
  url: URL,
  get: (url: string) => Promise<Response> = fetch,
  // False once a newer navigation has started: then this one must not touch the document.
  isCurrent: () => boolean = () => true,
): Promise<void> {
  const src = fragmentUrl(url)
  const res = await get(src)
  if (!res.ok) throw new Error(`${res.status}: ${src}`)
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html')
  if (!isCurrent()) return
  const next = region(doc)
  for (const title of next.querySelectorAll('title')) title.remove() // some parsers leave the leading <title> in the body
  // Persisted elements move into the new page as they are, with their state and attached islands.
  for (const old of document.querySelectorAll('[data-cl-persist]')) {
    next.querySelector(`[data-cl-persist="${CSS.escape(old.getAttribute('data-cl-persist')!)}"]`)?.replaceWith(old)
  }
  document.title = doc.title
  region(document).replaceWith(next)
  ;(globalThis as { __clAttach?: (root: ParentNode) => void }).__clAttach?.(next)
}

type NavigateEvent = Event & {
  canIntercept: boolean
  hashChange: boolean
  downloadRequest: string | null
  formData: FormData | null
  destination: { url: string }
  signal: AbortSignal
  intercept(options: { handler(): Promise<void> }): void
}

const navigation = typeof document !== 'undefined' ? (globalThis as { navigation?: EventTarget }).navigation : undefined
// Only the latest navigation may change the document; a URL that failed loads normally, never intercepted again.
let latest = 0
let fallback = ''
navigation?.addEventListener('navigate', (event) => {
  const e = event as NavigateEvent
  if (!e.canIntercept || e.hashChange || e.downloadRequest !== null || e.formData) return
  const url = new URL(e.destination.url)
  if (url.href === fallback) return
  const id = ++latest
  const isCurrent = () => latest === id && !e.signal.aborted
  e.intercept({
    handler: () => swap(url, fetch, isCurrent).catch(() => {
      if (!isCurrent()) return
      fallback = url.href
      location.assign(url.href)
    }),
  })
})
