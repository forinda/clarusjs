// Client router: renders client-mode routes in the browser. Browser only. The server sends a shell with the client
// route table; the router loads the page's render module and its <path>/__data.json, swaps the document, and lets
// the island loader attach. Later navigations between client routes are intercepted with the Navigation API;
// browsers without it simply load pages normally.
import { parse } from './serialize.ts'

type Entry = { p: string; r: string }
type Page = { render(props: object): string }

/** The route a path belongs to, with its decoded params. Same grammar as the server: whole [param] segments. */
export function matchRoute(table: Entry[], pathname: string): { r: string; params: Record<string, string> } | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  for (const { p, r } of table) {
    const keys: string[] = []
    const source = p.split('/').map((seg) => {
      const m = /^\[([A-Za-z_$][\w$]*)\]$/.exec(seg)
      if (!m) return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      keys.push(m[1]!)
      return '([^/]+)'
    }).join('/')
    const m = new RegExp(`^${source}$`).exec(path)
    if (!m) continue
    const params: Record<string, string> = {}
    try {
      keys.forEach((key, i) => { params[key] = decodeURIComponent(m[i + 1]!) })
    } catch {
      return null
    }
    return { r, params }
  }
  return null
}

/** Render the client route at `url` into the document. False when `url` is not a client route. */
export async function show(
  url: URL,
  table: Entry[],
  load: (src: string) => Promise<Page> = (src) => import(/* @vite-ignore */ src),
  get: (url: string) => Promise<Response> = (u) => fetch(u),
): Promise<boolean> {
  const found = matchRoute(table, url.pathname)
  if (!found) return false
  const data = `${url.pathname.replace(/\/+$/, '')}/__data.json`
  const [page, props] = await Promise.all([
    load(found.r),
    get(data).then(async (res) => {
      if (!res.ok) throw new Error(`${data}: ${res.status}`)
      return parse(await res.text()) as object
    }),
  ])
  const doc = new DOMParser().parseFromString(page.render(props), 'text/html')
  const style = doc.createElement('style')
  style.textContent = 'cl-island{display:contents}' // islands never affect layout
  doc.head.append(style)
  document.title = doc.title
  document.head.replaceWith(doc.head)
  document.body.replaceWith(doc.body)
  ;(globalThis as { __clAttach?: (root: ParentNode) => void }).__clAttach?.(document.body)
  return true
}

type NavigateEvent = Event & {
  canIntercept: boolean
  hashChange: boolean
  downloadRequest: string | null
  formData: FormData | null
  destination: { url: string }
  intercept(options: { handler(): Promise<void> }): void
}

const routes = typeof document !== 'undefined' ? document.getElementById('cl-routes') : null
if (routes) {
  const table = JSON.parse(routes.textContent ?? '[]') as Entry[]
  show(new URL(location.href), table).catch((err) => {
    console.error('[clarusjs] could not render this page', err)
    document.body.textContent = 'This page could not be loaded. Please try again.'
  })
  // A URL that failed to render is loaded normally, never intercepted again (no retry loop).
  let fallback = ''
  const navigation = (globalThis as { navigation?: EventTarget }).navigation
  navigation?.addEventListener('navigate', (event) => {
    const e = event as NavigateEvent
    if (!e.canIntercept || e.hashChange || e.downloadRequest !== null || e.formData) return
    const url = new URL(e.destination.url)
    if (url.origin !== location.origin || url.href === fallback || !matchRoute(table, url.pathname)) return
    e.intercept({
      handler: () => show(url, table).then(() => undefined, () => {
        fallback = url.href
        location.assign(url.href)
      }),
    })
  })
}
