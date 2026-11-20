import { modeFor, type ModeTable } from './modes.ts'
import { stringify } from '../runtime/serialize.ts'

const DATA = '__data.json'
const FRAG = 'index.frag.html'
/** JSON that is safe inside a <script> element and in any HTML context: '<' never appears raw. */
const safeJson = (json: string) => json.replace(/</g, '\\u003c')

// The fetch handler: Request → Response. Same function for dev, per-request SSR and (later) build-time prerender.

type PageModule = { render(props?: object): string }
type Params = Record<string, string>
/**
 * `[page].load.ts`: data for a route, server only. entries() lists a dynamic route's pages to prerender; load()
 * returns the page's inputs and runs per request on the server, or once per page at build.
 */
type DataModule = {
  entries?(): Params[] | Promise<Params[]>
  load?(context: { params: Params; request: Request }): object | Promise<object>
}

type Route = { path: string; file: string; keys: string[]; regex: RegExp; load: () => Promise<PageModule> }

/** A whole path segment that is a parameter: [id], [$id]. Anything else, like v[2], is literal text. */
const PARAM = /^\[([A-Za-z_$][\w$]*)\]$/

/** '/users/[id]' → keys ['id'] and a RegExp that captures each segment. */
function compile(path: string): { keys: string[]; regex: RegExp } {
  const keys: string[] = []
  const source = path.split('/').map((seg) => {
    const m = PARAM.exec(seg)
    if (!m) return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    keys.push(m[1]!)
    return '([^/]+)'
  }).join('/')
  return { keys, regex: new RegExp(`^${source}$`) }
}

/** '/src/pages/index.tscl' → '/', '/src/pages/blog/index.tscl' → '/blog', '/src/pages/about.tscl' → '/about' */
export function routeFromFile(file: string): string {
  const path = file.replace(/^.*?\/src\/pages/, '').replace(/\.tscl$/, '').replace(/\/index$/, '')
  return path || '/'
}

export function createHandler(
  pages: Record<string, () => Promise<PageModule>>,
  options: {
    loaderUrl?: string
    data?: Record<string, () => Promise<DataModule>>
    modes?: ModeTable
    /** Client routes (as their files name them) → URL of the page's browser render module. */
    client?: Record<string, string>
    routerUrl?: string
    /** Vite's base ('/' or '/docs/'): client routes are listed at their browser paths, under it. */
    base?: string
    /** Fragment navigation: every static and server page also answers at <path>/index.frag.html. */
    fragments?: boolean
    /** URL of the fragment navigation script (with fragments on, every static and server page loads it). */
    navUrl?: string
    /** URL of the stylesheet with every component's <style>, linked from every page. */
    stylesUrl?: string
    /** Stylesheets each page imports (directly or through its components), by route as its file names it. */
    css?: Record<string, string[]>
  } = {},
): { fetch(request: Request): Promise<Response>; routes: string[]; serverRoutes: string[]; paths(): Promise<string[]>; hasLoader(route: string): Promise<boolean>; isServerPath(pathname: string): boolean } {
  // Static routes first, then dynamic ones with more fixed segments first: /users/new beats /users/[id].
  const routes: Route[] = Object.entries(pages)
    .map(([file, load]) => ({ path: routeFromFile(file), file: file.replace(/^\//, ''), load, ...compile(routeFromFile(file)) }))
    .sort((a, b) => a.keys.length - b.keys.length || b.path.split('/').length - a.path.split('/').length)
  const data = options.data ?? {}
  const modes = options.modes ?? {}
  const loaderUrl = options.loaderUrl ?? '/cl-loader.js'

  function match(pathname: string): { route: Route; params: Params } | null {
    for (const route of routes) {
      const m = route.regex.exec(pathname)
      if (!m) continue
      const params: Params = {}
      try {
        route.keys.forEach((key, i) => { params[key] = decodeURIComponent(m[i + 1]!) })
      } catch {
        return null // a malformed %-escape names no page
      }
      return { route, params }
    }
    return null
  }

  // A page's stylesheet links: what it imports, then the component styles (so components can build on the base).
  const links = (urls: string[]) => [...new Set([...urls, ...(options.stylesUrl ? [options.stylesUrl] : [])])].map((u) => `<link rel="stylesheet" href="${u}">`).join('')
  const pageLinks = (route: Route) => links(options.css?.[route.path] ?? [])

  // entries() per route, asked once: prerendering and requests see the same list. null when there is none.
  const entriesCache = new Map<Route, Promise<Params[] | null>>()
  function entriesOf(route: Route): Promise<Params[] | null> {
    if (!entriesCache.has(route)) {
      const file = `/${route.file.replace(/\.tscl$/, '.load.ts')}`
      entriesCache.set(route, (async () => {
        const mod = data[file] ? await data[file]!() : undefined
        return mod?.entries ? await mod.entries() : null
      })())
    }
    return entriesCache.get(route)!
  }
  // Without entries() a route isn't restricted here (the build reports it).
  async function listed(route: Route, params: Params): Promise<boolean> {
    const list = await entriesOf(route)
    return !list || list.some((entry) => route.keys.every((key) => entry[key] === params[key]))
  }

  return {
    routes: routes.map((r) => r.path).sort(),
    /** Routes rendered per request ('server' mode), as their files name them. */
    serverRoutes: routes.filter((r) => modeFor(r.path, modes) === 'server').map((r) => r.path).sort(),
    /** Whether a URL path belongs to a server route (what a host must send to this handler instead of a file). */
    isServerPath(pathname) {
      const trim = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path)
      // <page>/index.frag.html belongs to that page when it exists; otherwise it is an ordinary path.
      const owner = options.fragments && pathname.endsWith(`/${FRAG}`) ? match(trim(pathname.slice(0, -FRAG.length - 1) || '/')) : null
      const found = owner ?? match(trim(pathname))
      return Boolean(found && modeFor(found.route.path, modes) === 'server')
    },
    /** Whether a route (as its file names it) has a load(). */
    async hasLoader(path) {
      const route = routes.find((r) => r.path === path)
      const file = route && `/${route.file.replace(/\.tscl$/, '.load.ts')}`
      return Boolean(file && data[file] && typeof (await data[file]!()).load === 'function')
    },
    /** Every concrete path to prerender: static routes as they are, dynamic ones from their entries(). */
    async paths() {
      const out: string[] = []
      for (const route of routes) {
        const mode = modeFor(route.path, modes)
        if (mode === 'server') continue
        const add = (path: string) => {
          out.push(path)
          // A client page's data, fetched by the router: written next to its shell.
          if (mode === 'client') out.push(path === '/' ? `/${DATA}` : `${path}/${DATA}`)
          // A static page's fragment, for fragment navigation.
          else if (options.fragments) out.push(path === '/' ? `/${FRAG}` : `${path}/${FRAG}`)
        }
        if (!route.keys.length) { add(route.path); continue }
        const dataFile = route.file.replace(/\.tscl$/, '.load.ts')
        const list = await entriesOf(route)
        if (!list) throw new Error(`${route.path} is a dynamic route: export entries() from ${dataFile} to list the pages to prerender`)
        for (const params of list) {
          add(route.path.split('/').map((seg) => {
            const key = PARAM.exec(seg)?.[1]
            if (key === undefined) return seg
            const value = (params as Record<string, unknown>)[key]
            // Each value fills one path segment and names a folder in the build: never empty, '.' or '..'.
            // Path separators on any OS ('/', '\\') and NUL could step out of that folder once the segment is decoded.
            // __data.json and index.frag.html are a page's data and fragment files, so they can't also name a page.
            if (typeof value !== 'string' || value === '' || value === '.' || value === '..' || value === DATA || value === FRAG || /[/\\\0]/.test(value)) {
              throw new Error(`${dataFile}: entries() gave ${JSON.stringify(value)} for "${key}"; each value must be a non-empty string without "/" or "\\", and not ".", "..", "${DATA}" or "${FRAG}"`)
            }
            return encodeURIComponent(value)
          }).join('/'))
        }
      }
      return out.sort()
    },
    async fetch(request) {
      if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method Not Allowed', { status: 405 })
      const pathname = new URL(request.url).pathname
      // '/guide/x/' is the same page as '/guide/x', in dev as on a static host.
      const trim = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path)
      // <client route>/__data.json is that page's props, for the router. Only for a client route: anywhere else the
      // path is an ordinary page path (a server route may well have an [id] of "__data.json").
      let found = match(trim(pathname))
      let wantsData = false
      if (pathname.endsWith(`/${DATA}`)) {
        const owner = match(trim(pathname.slice(0, -DATA.length - 1) || '/'))
        if (owner && modeFor(owner.route.path, modes) === 'client') {
          found = owner
          wantsData = true
        }
      }
      // <static or server route>/index.frag.html: that page's fragment, for fragment navigation.
      let wantsFrag = false
      if (options.fragments && !wantsData && pathname.endsWith(`/${FRAG}`)) {
        const owner = match(trim(pathname.slice(0, -FRAG.length - 1) || '/'))
        if (owner && modeFor(owner.route.path, modes) !== 'client') {
          found = owner
          wantsFrag = true
        }
      }
      const head = request.method === 'HEAD'
      const notFound = () => new Response(head ? null : 'Not Found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } })
      const mode = found && modeFor(found.route.path, modes)
      if (!found) return notFound()
      // A prerendered dynamic route only has the pages its entries() lists, as on a static host.
      if (mode !== 'server' && found.route.keys.length && !(await listed(found.route, found.params))) return notFound()
      if (mode === 'client' && !wantsData) {
        // In matching order (static before dynamic, as on the server): the router takes the first match.
        const client = options.client ?? {}
        const prefix = (options.base ?? '/').replace(/\/$/, '')
        const table = routes.filter((r) => client[r.path]).map((r) => ({ p: (prefix + r.path).replace(/(.)\/$/, '$1'), r: client[r.path]! }))
        const shell = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
          // Every client page's stylesheets: the router keeps the head, so this is all they get.
          links(routes.filter((r) => client[r.path]).flatMap((r) => options.css?.[r.path] ?? [])) +
          `<style>cl-island{display:contents}</style><script type="application/json" id="cl-routes">${safeJson(JSON.stringify(table))}</script>` +
          `<script type="module" src="${loaderUrl}"></script><script type="module" src="${options.routerUrl ?? '/cl-router.js'}"></script>` +
          '</head><body><noscript>This page is rendered in the browser and needs JavaScript.</noscript></body></html>'
        return new Response(head ? null : shell, { headers: { 'content-type': 'text/html; charset=utf-8' } })
      }
      let props: object = found.params
      const dataFile = found.route.file.replace(/\.tscl$/, '.load.ts')
      const mod = data[`/${dataFile}`] ? await data[`/${dataFile}`]!() : undefined
      if (mod?.load) {
        let loaded: unknown
        try {
          loaded = await mod.load({ params: found.params, request })
        } catch (err) {
          return failure(`${dataFile}: load() failed: ${(err as Error)?.message ?? err}`)
        }
        if (loaded === null || typeof loaded !== 'object' || Array.isArray(loaded)) {
          return failure(`${dataFile}: load() must return an object of page inputs, got ${Array.isArray(loaded) ? 'an array' : loaded === null ? 'null' : typeof loaded}`)
        }
        ;(globalThis as { __clLoaderRan?: boolean }).__clLoaderRan = true // recorded by prerender for the manifest
        props = { ...found.params, ...loaded }
      }
      if (wantsData) {
        return new Response(head ? null : safeJson(stringify(props)), { headers: { 'content-type': 'application/json; charset=utf-8' } })
      }
      const html = (await found.route.load()).render(props)
      if (wantsFrag) {
        // The page's stylesheet links go right after its title, so fragment navigation can load any that are missing.
        const fragment = toFragment(html).replace(/^(<title\b[^>]*>[\s\S]*?<\/title\s*>)/i, (t) => t + pageLinks(found.route))
        return new Response(head ? null : fragment, { headers: { 'content-type': 'text/html; charset=utf-8' } })
      }
      const visible = maskComments(html)
      const hasIslands = visible.includes('<cl-island ')
      // Only pages with islands get a script, and only the loader; it fetches each island's own chunk. With fragment
      // navigation every page gets the navigation script instead, which brings the loader for islands that arrive.
      const nav = options.fragments === true
      const sheet = pageLinks(found.route)
      const style = sheet + (hasIslands || nav ? '<style>cl-island{display:contents}</style>' : '') // islands never affect layout
      const script = nav
        ? `<script type="module" src="${options.navUrl ?? '/cl-nav.js'}"></script>`
        : hasIslands ? `<script type="module" src="${loaderUrl}"></script>` : ''
      const body = /<html[\s>]/i.test(visible)
        ? fullDocument(html, style, script)
        : `<!doctype html><html><head><meta charset="utf-8"><title>clarusjs</title>${style}</head><body>${html}${script}</body></html>`
      return new Response(head ? null : body, { headers: { 'content-type': 'text/html; charset=utf-8' } })
    },
  }
}

/** A 500 that tells the visitor nothing internal; the details go to the server log (and the build's output). */
function failure(message: string): Response {
  console.error(`[clarusjs] ${message}`)
  return new Response('Internal Server Error', { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } })
}

/**
 * A page's fragment: its <title>, then the element marked data-cl-swap (the region fragment navigation replaces), or
 * its <body> when nothing is marked. Comments are ignored when looking; nested tags of the same name are balanced.
 */
export function toFragment(html: string): string {
  // Comments and raw-text contents (scripts, styles, textareas, the title) can hold tag-shaped text: blank them out.
  const masked = maskComments(html).replace(/(<(script|style|textarea|title)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi, (_, open: string, _tag, body: string, close: string) => open + ' '.repeat(body.length) + close)
  const title = /<title\b[^>]*>[\s\S]*?<\/title\s*>/i.exec(masked)
  const titleHtml = title ? html.slice(title.index, title.index + title[0].length) : '<title>clarusjs</title>'
  // The first start tag that carries a data-cl-swap attribute (boolean or with a value), attributes parsed properly.
  const tags = /<([a-zA-Z][\w-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>/g
  let marked: RegExpExecArray | null = null
  for (let m = tags.exec(masked); m; m = tags.exec(masked)) {
    const names = [...m[2]!.matchAll(/\s+([^\s"'>/=]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?/g)].map((a) => a[1]!.toLowerCase())
    if (names.includes('data-cl-swap')) { marked = m; break }
  }
  if (marked) {
    const tag = marked[1]!.toLowerCase()
    const same = new RegExp(`<(/?)${tag}(?=[\\s>/])`, 'gi')
    same.lastIndex = marked.index
    let depth = 0
    for (let m = same.exec(masked); m; m = same.exec(masked)) {
      depth += m[1] ? -1 : 1
      if (depth === 0) return titleHtml + html.slice(marked.index, masked.indexOf('>', m.index) + 1)
    }
  }
  const open = /<body\b[^>]*>/i.exec(masked)
  const close = masked.lastIndexOf('</body>')
  if (!open || close === -1) return `${titleHtml}<body>${html}</body>`
  return titleHtml + html.slice(open.index, close) + '</body>'
}

/** Same length as `html`, with every HTML comment blanked out, so positions found in it are valid in `html`. */
function maskComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, (c) => ' '.repeat(c.length))
}

/** A page whose layout renders the whole document: add the doctype if missing, and put style/script in place. */
function fullDocument(html: string, style: string, script: string): string {
  let out = /^\s*<!doctype/i.test(html) ? html : `<!doctype html>${html}`
  if (style) {
    const head = maskComments(out).search(/<\/head>/i)
    out = head === -1 ? out + style : out.slice(0, head) + style + out.slice(head)
  }
  if (script) {
    const bodies = [...maskComments(out).matchAll(/<\/body>/gi)]
    const body = bodies.length ? bodies[bodies.length - 1]!.index! : -1
    out = body === -1 ? out + script : out.slice(0, body) + script + out.slice(body)
  }
  return out
}
