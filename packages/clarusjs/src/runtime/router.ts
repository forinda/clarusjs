// Client router: renders client-mode routes in the browser. Browser only. The server sends a shell with the client
// route table; the router loads the page's render module and its <path>/__data.json, swaps the document, and lets
// the island loader attach. Later navigations between client routes are intercepted with the Navigation API;
// browsers without it simply load pages normally.
import { parse } from './serialize.ts'
import { latest, takeOver } from './navigate.ts'

type Entry = { p: string; r: string }
type Page = { render(props: object): string }

/** The route a path belongs to, with its decoded params. Same grammar as the server: whole [param] segments. */
export function matchRoute(table: Entry[], pathname: string): { r: string; params: Record<string, string> } | null {
  const got = pathname.replace(/(.)\/+$/, '$1').split('/')
  try {
    for (const { p, r } of table) {
      const want = p.split('/')
      const params: Record<string, string> = {}
      // Segment by segment: a [param] takes any one non-empty segment, anything else must be equal.
      const hit = want.length === got.length && want.every((w, i) => {
        const key = /^\[([A-Za-z_$][\w$]*)\]$/.exec(w)?.[1]
        if (key === undefined) return w === got[i]
        params[key] = decodeURIComponent(got[i]!)
        return got[i] !== ''
      })
      if (hit) return { r, params }
    }
  } catch {} // a malformed %-escape names no page
  return null
}

/** Render the client route at `url` into the document. False when `url` is not a client route. */
export async function show(
  url: URL,
  table: Entry[],
  // False once a newer navigation has started: then this one must not touch the document.
  isCurrent: () => boolean = () => true,
  load: (src: string) => Promise<Page> = (src) => import(/* @vite-ignore */ src),
  get: (url: string) => Promise<Response> = fetch,
): Promise<boolean> {
  const found = matchRoute(table, url.pathname)
  if (!found) return false
  const data = `${url.pathname.replace(/\/+$/, '')}/__data.json`
  const [page, props] = await Promise.all([
    load(found.r),
    get(data).then(async (res) => {
      if (!res.ok) throw new Error(`${res.status} ${data}`)
      return parse(await res.text()) as object
    }),
  ])
  if (!isCurrent()) return false
  const doc = new DOMParser().parseFromString(page.render(props), 'text/html')
  // The head stays (its stylesheets are every client page's, linked by the shell); the title and the page's own
  // <html> attributes (lang, dir, …) are the new page's.
  // The site's titleTemplate, from the shell (always set: '%s' without one).
  document.title = document.getElementById('cl-routes')!.dataset.title!.replace('%s', () => doc.title)
  const root = document.documentElement
  for (const { name } of [...root.attributes]) root.removeAttribute(name)
  for (const { name, value } of [...doc.documentElement.attributes]) root.setAttribute(name, value)
  document.body.replaceWith(doc.body)
  // The page's inline head scripts (such as setting the theme before paint) run once, as on a normal load.
  for (const old of doc.head.querySelectorAll('script:not([src])')) {
    const script = document.createElement('script')
    script.textContent = old.textContent
    document.head.append(script)
    script.remove()
  }
  // Attaches the new page's islands; the loader also releases the old page's.
  ;(globalThis as { __clAttach?: (root: ParentNode, navigated: 1) => void }).__clAttach?.(document.body, 1) // 1: navigated (bytes)
  return true
}

const routes = globalThis.document?.getElementById('cl-routes')
if (routes) {
  const table = JSON.parse(routes.textContent!) as Entry[]
  // The first render is current until a navigation is taken over.
  show(new URL(location.href), table, () => !latest).catch((err: Error) => {
    if (latest) return
    document.body.textContent = err.message.startsWith('404') ? 'Page not found.' : 'Could not load page.'
  })
  // Later navigations to client routes.
  takeOver((url) => matchRoute(table, url.pathname) && ((url, isCurrent) => show(url, table, isCurrent)))
}
