import { modeFor, type ModeTable } from './modes.ts'
import { AsyncLocalStorage } from 'node:async_hooks'
import { toBrowser } from '../runtime/server.ts'
import { completeHead, type HeadOptions, type SiteOptions } from './head.ts'
import { escape } from '../runtime/html.ts'

const DATA = '__data.json'
const FRAG = 'index.frag.html'
/** JSON that is safe inside a <script> element and in any HTML context: '<' never appears raw. */
const safeJson = (json: string) => json.replace(/</g, '\\u003c')

// The fetch handler: Request → Response. Same function for dev, per-request SSR and (later) build-time prerender.

type PageModule = { render(props?: object, slots?: undefined, opts?: { route: { path: string; params: Record<string, string> } }): string | Promise<string> }

/** Each render's component loader data (#97), read by loaded() (runtime/server.ts) across awaits (#430). */
const loadedStore = new AsyncLocalStorage<Map<string, object>>()
;(globalThis as { __clLoadedStore?: AsyncLocalStorage<Map<string, object>> }).__clLoadedStore = loadedStore
/** Each request's site base, for h() (server/views.ts): per handler, across awaits. */
const viewBase = ((globalThis as { __clViewBase?: AsyncLocalStorage<string> }).__clViewBase ??= new AsyncLocalStorage<string>())
type Params = Record<string, string>
/**
 * `[page].load.ts`: data for a route, server only. entries() lists a dynamic route's pages to prerender; load()
 * returns the page's inputs and runs per request on the server, or once per page at build.
 */
type DataModule = {
  entries?(): Params[] | Promise<Params[]>
  load?(context: LoadContext): object | Promise<object>
}

/**
 * Data a request carries from `handle()` (src/server.ts) to every `load()`, such as the signed-in user. Declare what
 * it holds once, and every loader is checked against it:
 * @example
 * ```ts
 * // src/server.ts
 * declare module 'clarusjs/server' {
 *   interface Locals { user?: { id: string; name: string } }
 * }
 * ```
 * @see https://clarusjs.com/reference/server#locals
 */
export interface Locals {}

/**
 * Options for `cookies.set()`. Defaults: `path: '/'`, `httpOnly: true`, `sameSite: 'lax'`, and `secure: true` except
 * in the Vite dev server (so development over plain http works everywhere).
 * @see https://clarusjs.com/reference/server#cookies
 */
export type CookieOptions = { path?: string; domain?: string; maxAge?: number; expires?: Date; httpOnly?: boolean; secure?: boolean; sameSite?: 'lax' | 'strict' | 'none' }

/**
 * A request's cookies: read from its `Cookie` header; what's set or deleted goes on the answer as `Set-Cookie`.
 * @example
 * ```ts
 * export function load({ cookies }: LoadContext) {
 *   cookies.set('visited', 'yes', { maxAge: 60 * 60 * 24 })
 *   return { theme: cookies.get('theme') ?? 'light' }
 * }
 * ```
 * @see https://clarusjs.com/reference/server#cookies
 */
export type Cookies = {
  get(name: string): string | undefined
  getAll(): Record<string, string>
  set(name: string, value: string, options?: CookieOptions): void
  delete(name: string, options?: Pick<CookieOptions, 'path' | 'domain'>): void
}

/**
 * What a page's `load()` gets: its route params, the request, its cookies and the locals `handle()` filled.
 * @see https://clarusjs.com/reference/server#loadcontext
 */
export type LoadContext = { params: Params; request: Request; cookies: Cookies; locals: Locals }

/**
 * What a folder's `+guard.ts` gets (#457): the page's load() context plus the URL. Return a `Response` (such as
 * `redirect()`) to answer instead of the page, or nothing to go on; it may set `locals` for what runs after it.
 *
 * ```ts
 * // src/pages/admin/+guard.ts
 * export function guard({ locals, url }: GuardContext) {
 *   if (!locals.user) return redirect('/sign-in?next=' + encodeURIComponent(url.pathname))
 * }
 * ```
 * @see https://clarusjs.com/guide/auth
 */
export type GuardContext = LoadContext & { url: URL }
type GuardModule = { guard?(context: GuardContext): Response | void | undefined | Promise<Response | void | undefined> }

/**
 * `handle()` in src/server.ts: runs once per request before any page loads, to resolve the session into `locals`.
 * Returning a Response (such as `redirect('/login')`) answers the request instead.
 * @example
 * ```ts
 * // src/server.ts
 * import type { Handle } from 'clarusjs/server'
 * export const handle: Handle = async ({ cookies, locals }) => {
 *   const id = cookies.get('session')
 *   if (id) locals.user = await sessions.get(id)
 * }
 * ```
 * @see https://clarusjs.com/reference/server#handle
 */
export type Handle = (context: { request: Request; cookies: Cookies; locals: Locals }) => void | Response | Promise<void | Response>

/**
 * An endpoint's handler (`export function GET(…)` in src/pages/api/items.ts): the request, its route params, cookies
 * and locals; returns the Response.
 * @example
 * ```ts
 * // src/pages/api/items.ts
 * import type { RequestHandler } from 'clarusjs/server'
 * export const GET: RequestHandler = ({ locals }) => Response.json(listItemsFor(locals.user))
 * export const POST: RequestHandler = async ({ request }) => Response.json(await save(await request.json()), { status: 201 })
 * ```
 * @see https://clarusjs.com/reference/server#endpoints
 */
export type RequestHandler = (context: LoadContext) => Response | Promise<Response>

/** An endpoint module: one handler per HTTP method it answers. @internal */
export type EndpointModule = Partial<Record<'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS', RequestHandler>>

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

/** '/src/pages/index.tscl' → '/', '/src/pages/blog/index.tscl' → '/blog', '/src/pages/about.md' → '/about' (any page source) */
/**
 * A redirect for a server page's `load()` to return: `return redirect('/login')`. 302 by default; 301 or 308 for
 * a page that moved for good, 303 after a form, 307 to keep the method.
 * @example
 * ```ts
 * // src/pages/account.load.ts (a server route)
 * export async function load({ request }: { request: Request }) {
 *   const user = await userFrom(request)
 *   if (!user) return redirect('/login')
 *   return { user }
 * }
 * ```
 * @see https://clarusjs.com/reference/server#redirect
 */
export function redirect(to: string, status: 301 | 302 | 303 | 307 | 308 = 302): Response {
  return new Response(null, { status, headers: { location: to } })
}

/** @internal clarusjs's own build and server code call this; apps don't. */
export function isPageFile(file: string): boolean {
  return !/\/\+[^/]*$/.test(file) // +layout.tscl (#456) and other + files are never routes
}

/** @internal clarusjs's own build and server code call this; apps don't. */
export function routeFromFile(file: string): string {
  const path = file.replace(/^.*?\/src\/pages/, '').replace(/\.[^./]+$/, '').replace(/\/index$/, '')
  return path || '/'
}

/** @internal clarusjs's own build and server code call this; apps don't. */
export function createHandler(
  pages: Record<string, () => Promise<PageModule>>,
  options: {
    loaderUrl?: string
    data?: Record<string, () => Promise<DataModule>>
    /** Folder guards (#457): each src/pages folder's +guard.ts → its module. */
    guards?: Record<string, () => Promise<GuardModule>>
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
    /** Title template, site-wide head tags and a transform (see head.ts). */
    head?: HeadOptions
    /** The site's public address: canonical URLs and social cards (see head.ts). */
    site?: SiteOptions
    /** Development: a failing page throws its error (the dev server shows it with its stack) instead of answering 500. */
    dev?: boolean
    /** src/server.ts: its `handle()` runs once per request, before any page loads. */
    hooks?: { handle?: Handle }
    /** Component loaders (#97): each route's (as its file names it) loader files, by Vite path ('/src/x.load.ts'). */
    componentLoaders?: Record<string, string[]>
    /** The component loader modules, by Vite path. */
    componentData?: Record<string, () => Promise<DataModule>>
    /** Endpoints: .ts files under src/pages (not .load.ts) exporting GET, POST, … handlers. */
    endpoints?: Record<string, () => Promise<EndpointModule>>
  } = {},
): { fetch(request: Request): Promise<Response>; routes: string[]; serverRoutes: string[]; base: string; paths(): Promise<string[]>; hasLoader(route: string): Promise<boolean>; readsCookies(route: string): Promise<boolean>; isServerPath(pathname: string): boolean } {
  // Static routes first, then dynamic ones with more fixed segments first: /users/new beats /users/[id].
  const routes: Route[] = Object.entries(pages)
    .filter(([file]) => isPageFile(file))
    .map(([file, load]) => ({ path: routeFromFile(file), file: file.replace(/^\//, ''), load, ...compile(routeFromFile(file)) }))
    .sort((a, b) => a.keys.length - b.keys.length || b.path.split('/').length - a.path.split('/').length)
  // Endpoints (src/pages/api/items.ts → /api/items), matched after pages; most fixed segments first, as for pages.
  const endpointRoutes = Object.entries(options.endpoints ?? {})
    .filter(([file]) => isPageFile(file)) // +guard.ts is a guard, not an endpoint
    .map(([file, load]) => ({ path: routeFromFile(file), file: file.replace(/^\//, ''), load, ...compile(routeFromFile(file)) }))
    .sort((a, b) => a.keys.length - b.keys.length || b.path.split('/').length - a.path.split('/').length)
  const matchEndpoint = (pathname: string) => {
    for (const route of endpointRoutes) {
      const m = route.regex.exec(pathname)
      if (!m) continue
      // A malformed %-escape in a param names no endpoint: a 404, as for pages, never a crash.
      try { return { route, params: Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1]!)])) } } catch { return undefined }
    }
    return undefined
  }
  const data = options.data ?? {}
  const guards = options.guards ?? {}
  /**
   * The +guard.ts of each folder above a route's file (#457), outer first: the first Response is the answer. A route
   * built once (not 'server') can't read cookies or headers in its guards, as in load(). Throws naming the guard.
   */
  async function guarded(file: string, once: boolean, context: LoadContext): Promise<Response | undefined> {
    const folders = file.replace(/^\/?src\/pages\//, '').split('/').slice(0, -1)
    for (let i = 0; i <= folders.length; i++) {
      const key = `/src/pages/${[...folders.slice(0, i), '+guard.ts'].join('/')}`
      if (!guards[key]) continue
      try {
        const mod = await guards[key]!()
        const route = routeFromFile(`/${file.replace(/^\//, '')}`)
        const answer = await mod.guard?.({ ...context, url: new URL(context.request.url), ...(once ? builtOnce(route, context.request) : {}) })
        if (answer instanceof Response) return answer
      } catch (err) {
        throw new Error(`${key.slice(1)}: guard() failed: ${(err as Error)?.message ?? err}`, { cause: err })
      }
    }
    return undefined
  }
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
      const file = `/${route.file.replace(/\.[^./]+$/, '.load.ts')}`
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

  const handler: ReturnType<typeof createHandler> = {
    routes: routes.map((r) => r.path).sort(),
    /** Vite's base: a server in front strips it from request paths before calling fetch() (routes are base-free). */
    base: options.base ?? '/',
    /** Routes rendered per request ('server' mode), as their files name them. */
    serverRoutes: [...routes.filter((r) => modeFor(r.path, modes) === 'server').map((r) => r.path), ...endpointRoutes.map((r) => r.path)].sort(),
    /** Whether a URL path belongs to a server route (what a host must send to this handler instead of a file). */
    isServerPath(pathname) {
      const trim = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path)
      // <page>/index.frag.html belongs to that page when it exists; otherwise it is an ordinary path.
      const owner = options.fragments && pathname.endsWith(`/${FRAG}`) ? match(trim(pathname.slice(0, -FRAG.length - 1) || '/')) : null
      const found = owner ?? match(trim(pathname))
      return Boolean(found ? modeFor(found.route.path, modes) === 'server' : matchEndpoint(trim(pathname)))
    },
    /** Whether a route (as its file names it) has a load(). */
    /** Whether a route's load() mentions cookies (its source text): for clarusjs explain. */
    async readsCookies(route) {
      const found = routes.find((r) => r.path === route)
      const dataFile = found && `/${found.file.replace(/\.[^./]+$/, '.load.ts')}`
      const mod = dataFile && data[dataFile] ? await data[dataFile]!() : undefined
      return !!mod?.load && /\bcookies\b/.test(String(mod.load))
    },
    async hasLoader(path) {
      const route = routes.find((r) => r.path === path)
      const file = route && `/${route.file.replace(/\.[^./]+$/, '.load.ts')}`
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
        const dataFile = route.file.replace(/\.[^./]+$/, '.load.ts')
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
      // The request's cookies (Set-Cookie on whatever answers it) and locals, filled by handle() before pages load.
      const jar = cookieJar(request, options.dev === true)
      const locals = {} as Locals
      if (options.hooks?.handle) {
        let early: void | Response
        try {
          early = await options.hooks.handle({ request, cookies: jar.cookies, locals })
        } catch (err) {
          if (options.dev) throw err
          console.error(`clarusjs: src/server.ts: handle() failed: ${(err as Error)?.message ?? err}`)
          return jar.apply(failure('src/server.ts: handle() failed'))
        }
        if (early instanceof Response) return jar.apply(early)
      }
      return jar.apply(await answer(request, jar.cookies, locals))
    },
  }

  async function answer(request: Request, cookies: Cookies, locals: Locals): Promise<Response> {
    // An endpoint answers where no page does (pages win a shared path).
    if (endpointRoutes.length) {
      const path = new URL(request.url).pathname
      const trimmed = path.length > 1 ? path.replace(/\/+$/, '') : path
      const found = !match(trimmed) && matchEndpoint(trimmed)
      if (found) {
        // Its folders' guards first (#457), per request like the endpoint.
        try {
          const stop = await guarded(found.route.file, false, { request, params: found.params, cookies, locals })
          if (stop) return stop
        } catch (err) {
          if (options.dev) throw err
          return failure((err as Error).message)
        }
        const response = await callEndpoint(found.route.file, await found.route.load(), { request, params: found.params, cookies, locals }, options)
        if (response) return response
      }
    }
    {
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
      const plain = () => new Response(head ? null : 'Not Found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } })
      // An unknown page gets src/pages/404.tscl (when there is one) with status 404; data and fragment requests don't.
      const notFound = async () => {
        if (pathname.endsWith(`/${DATA}`) || pathname.endsWith(`/${FRAG}`) || trim(pathname) === '/404' || !routes.some((r) => r.path === '/404')) return plain()
        const page = await handler.fetch(new Request(new URL('/404', request.url), { method: request.method }))
        if (page.status !== 200) return plain()
        return new Response(head ? null : rootLinks(await page.text(), options.base ?? '/'), { status: 404, headers: page.headers })
      }
      // A failing page: in development its error is thrown, for the dev server to show. Otherwise the details go to the
      // log and the visitor gets the site's 500 page (src/pages/500.tscl, given { status: 500 }), or plain text.
      const fail = async (message: string, err?: unknown): Promise<Response> => {
        if (options.dev) throw err ?? new Error(message)
        const plain500 = failure(message)
        if (wantsData || wantsFrag || trim(pathname) === '/500' || !routes.some((r) => r.path === '/500')) return plain500
        try {
          const page = await handler.fetch(new Request(new URL('/500', request.url), { method: request.method }))
          if (page.status !== 200) return plain500
          return new Response(head ? null : rootLinks(await page.text(), options.base ?? '/'), { status: 500, headers: page.headers })
        } catch {
          return plain500
        }
      }
      const mode = found && modeFor(found.route.path, modes)
      if (!found) return notFound()
      // A prerendered dynamic route only has the pages its entries() lists, as on a static host.
      if (mode !== 'server' && found.route.keys.length && !(await listed(found.route, found.params))) return notFound()
      // Component loaders (#97) run on the server around the page's render; a client route renders in the browser.
      const componentFiles = options.componentLoaders?.[found.route.path] ?? []
      if (mode === 'client' && componentFiles.length) {
        return fail(`${found.route.file}: component loaders don't run in client routes yet (${componentFiles.map((f) => f.replace(/^\//, '')).join(', ')}); make the route 'static' or 'server'`)
      }
      if (mode === 'client' && !wantsData) {
        // In matching order (static before dynamic, as on the server): the router takes the first match.
        const client = options.client ?? {}
        const prefix = (options.base ?? '/').replace(/\/$/, '')
        const table = routes.filter((r) => client[r.path]).map((r) => ({ p: (prefix + r.path).replace(/(.)\/$/, '$1'), r: client[r.path]! }))
        const shell = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
          // Every client page's stylesheets: the router keeps the head, so this is all they get.
          // ...and the 404 and 500 pages', which the router shows when a first render fails (data-base: where they are).
          links(routes.filter((r) => client[r.path] || r.path === '/404' || r.path === '/500').flatMap((r) => options.css?.[r.path] ?? [])) +
          `<style>cl-island{display:contents}</style><script type="application/json" id="cl-routes" data-title="${escape(options.head?.titleTemplate ?? '%s')}" data-base="${escape(options.base ?? '/')}">${safeJson(JSON.stringify(table))}</script>` +
          `<script type="module" src="${loaderUrl}"></script><script type="module" src="${options.routerUrl ?? '/cl-router.js'}"></script>` +
          '</head><body><noscript>This page is rendered in the browser and needs JavaScript.</noscript></body></html>'
        // Site tags and transformHead apply to the shell; the router applies the title template to each page's title.
        const { titleTemplate: _, ...siteHead } = options.head ?? {}
        let page: string
        try {
          page = completeHead(shell, maskComments, { ...siteHead, site: options.site, base: options.base }, { route: found.route.path, path: pagePath(pathname, false) })
        } catch (err) {
          return fail(`${found.route.file}: ${(err as Error).message}`, err)
        }
        return new Response(head ? null : page, { headers: { 'content-type': 'text/html; charset=utf-8' } })
      }
      // The 500 page is told its status, whether a failure shows it or it is visited (or prerendered) at /500.
      // The folders' guards (#457), before load(): for a client route, when its data is asked for.
      try {
        const stop = await guarded(found.route.file, modeFor(found.route.path, modes) !== 'server', { params: found.params, locals, request, cookies })
        if (stop) return stop
      } catch (err) {
        return fail((err as Error).message, err)
      }
      let props: object = found.route.path === '/500' ? { status: 500, ...found.params } : found.params
      const dataFile = found.route.file.replace(/\.[^./]+$/, '.load.ts')
      const mod = data[`/${dataFile}`] ? await data[`/${dataFile}`]!() : undefined
      if (mod?.load) {
        let loaded: unknown
        try {
          // A route that isn't 'server' is built once for everyone: its load() can't use a visitor's cookies or headers.
          const once = modeFor(found.route.path, modes) !== 'server'
          loaded = await mod.load({ params: found.params, locals, ...(once ? builtOnce(found.route.path, request) : { request, cookies }) })
        } catch (err) {
          return fail(`${dataFile}: load() failed: ${(err as Error)?.message ?? err}`, err)
        }
        // A Response (such as redirect()) is the answer, for the page as for its fragment or data: a navigator
        // that followed a redirect then loads the target page normally.
        if (loaded instanceof Response) return loaded
        if (loaded === null || typeof loaded !== 'object' || Array.isArray(loaded)) {
          return fail(`${dataFile}: load() must return an object of page inputs (or a Response, such as redirect()), got ${Array.isArray(loaded) ? 'an array' : loaded === null ? 'null' : typeof loaded}`)
        }
        ;(globalThis as { __clLoaderRan?: boolean }).__clLoaderRan = true // recorded by prerender for the manifest
        props = { ...props, ...loaded }
      }
      if (wantsData) {
        return new Response(head ? null : safeJson(toBrowser(props)), { headers: { 'content-type': 'application/json; charset=utf-8' } })
      }
      // Every component loader the page uses, side by side; then a synchronous render that reads their results.
      let componentData = new Map<string, object>()
      if (componentFiles.length) {
        const once = mode !== 'server'
        const context = { params: found.params, locals, ...(once ? builtOnce(found.route.path, request) : { request, cookies }) }
        try {
          componentData = new Map(await Promise.all(componentFiles.map(async (file) => {
            const name = file.replace(/^\//, '')
            const mod = await options.componentData?.[file]?.()
            let value: unknown
            try {
              value = await mod?.load?.(context)
            } catch (err) {
              throw Object.assign(new Error(`${name}: load() failed: ${(err as Error)?.message ?? err}`), { cause: err })
            }
            if (value === null || typeof value !== 'object' || Array.isArray(value) || value instanceof Response) {
              throw new Error(`${name}: load() must return an object of the component's inputs, got ${value instanceof Response ? 'a Response' : Array.isArray(value) ? 'an array' : value === null ? 'null' : typeof value}`)
            }
            return [name.replace(/\.load\.ts$/, '.tscl'), value as object] as const
          })))
        } catch (err) {
          return fail((err as Error).message, err)
        }
      }
      let html: string
      try {
        const module = await found.route.load()
        // Awaited: a page or a component in it may await in its <script server> (#430). Component loaders' data is
        // this render's, even while it waits (see loaded() in runtime/server.ts).
        // The route goes to the page's folder and config layouts (#456): their path and params.
        html = await loadedStore.run(componentData, () => module.render(props, undefined, { route: { path: pathname, params: found.params } }))
      } catch (err) {
        return fail(`${found.route.file}: render failed: ${(err as Error)?.message ?? err}`, err)
      }
      // A page that isn't a whole document is put in a minimal one, so every page's head is completed the same way.
      if (!/<html[\s>]/i.test(maskComments(html))) html = `<!doctype html><html><head><meta charset="utf-8"><title>clarusjs</title></head><body>${html}</body></html>`
      try {
        html = completeHead(html, maskComments, { ...options.head, site: options.site, base: options.base }, { route: found.route.path, path: pagePath(pathname, wantsFrag) })
      } catch (err) {
        return fail(`${found.route.file}: ${(err as Error).message}`, err)
      }
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
      const body = fullDocument(html, style, script)
      return new Response(head ? null : body, { headers: { 'content-type': 'text/html; charset=utf-8' } })
    }
  }
  // h() writes URLs with this handler's base (a CDN base: page links stay on the site)
  const respond = handler.fetch
  const base = /^https?:\/\//.test(options.base ?? '/') ? '/' : (options.base ?? '/')
  handler.fetch = (request) => viewBase.run(base, () => respond(request))
  return handler
}

/** A 500 that tells the visitor nothing internal; the details go to the server log (and the build's output). */
/** The page's own path: no trailing slash (but '/'), and without index.frag.html for a fragment. */
function pagePath(pathname: string, fragment: boolean): string {
  const path = fragment ? pathname.slice(0, -FRAG.length) : pathname
  return path.replace(/(.)\/+$/, '$1') || '/'
}

function failure(message: string): Response {
  console.error(`[clarusjs] ${message}`)
  return new Response('Internal Server Error', { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } })
}

/**
 * A page's fragment: its <title>, then the element marked data-cl-swap (the region fragment navigation replaces), or
 * its <body> when nothing is marked. Comments are ignored when looking; nested tags of the same name are balanced.
 * @internal clarusjs's own build and server code call this; apps don't.
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

/**
 * Same length as `html`, with every HTML comment and the contents of every <script> and <style> blanked out, so tags
 * found in it are real tags (not text in a comment or a string in a script) and positions are valid in `html`.
 */
function maskComments(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, (c) => ' '.repeat(c.length))
    .replace(/(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi, (_, open: string, _tag: string, body: string, close: string) => open + ' '.repeat(body.length) + close)
}

/** A page whose layout renders the whole document: add the doctype if missing, and put style/script in place. */
function fullDocument(html: string, style: string, script: string): string {
  // A BOM or a comment may come first (\s covers U+FEFF; comments are masked to spaces).
  let out = /^\s*<!doctype/i.test(maskComments(html)) ? html : `<!doctype html>${html}`
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

/**
 * The 404 page is served at any depth (/a/b/c), so its relative links (href, src) are resolved from the site root:
 * 'guide' means <base>guide wherever the visitor is.
 * @internal clarusjs's own build and server code call this; apps don't.
 */
export function rootLinks(html: string, base: string): string {
  return html.replace(/(\s(?:href|src)=")([^"]*)"/gi, (all, attr: string, url: string) => {
    if (/^(?:[a-z][\w+.-]*:|\/|#|\?)/i.test(url)) return all
    const resolved = new URL(url.replace(/&amp;/g, '&'), `http://x${base}`)
    return `${attr}${(resolved.pathname + resolved.search + resolved.hash).replace(/&/g, '&amp;')}"`
  })
}

// A cookie name: an RFC 6265 token (no spaces, separators or controls).
const TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

/** The request's cookies, and `apply(response)`: the response with a Set-Cookie for each cookie set or deleted. */
function cookieJar(request: Request, dev: boolean): { cookies: Cookies; apply(response: Response): Response } {
  const incoming = new Map<string, string>()
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const at = part.indexOf('=')
    if (at < 1) continue
    const name = part.slice(0, at).trim()
    const raw = part.slice(at + 1).trim().replace(/^"(.*)"$/, '$1')
    let value = raw
    try { value = decodeURIComponent(raw) } catch {}
    if (!incoming.has(name)) incoming.set(name, value)
  }
  const current = new Map(incoming)
  const out = new Map<string, string>() // name (and path, domain) → Set-Cookie value
  const write = (name: string, value: string, o: CookieOptions) => {
    if (!TOKEN.test(name)) throw new Error(`cookies.set: ${JSON.stringify(name)} isn't a valid cookie name`)
    const path = o.path ?? '/'
    let header = `${name}=${encodeURIComponent(value)}; Path=${path}`
    if (o.domain) header += `; Domain=${o.domain}`
    if (o.maxAge !== undefined) header += `; Max-Age=${Math.floor(o.maxAge)}`
    if (o.expires) header += `; Expires=${o.expires.toUTCString()}`
    if (o.httpOnly ?? true) header += '; HttpOnly'
    header += `; SameSite=${({ lax: 'Lax', strict: 'Strict', none: 'None' } as const)[o.sameSite ?? 'lax']}`
    // Secure unless the Vite dev server answers: never guessed from the request's URL, which behind a proxy can be
    // http://localhost in production. (Browsers accept Secure cookies on http://localhost, so vite preview works.)
    if (o.secure ?? !dev) header += '; Secure'
    out.set(`${name};${path};${o.domain ?? ''}`, header)
  }
  return {
    cookies: {
      get: (name) => current.get(name),
      getAll: () => Object.fromEntries(current),
      set(name, value, options = {}) {
        write(name, value, options)
        current.set(name, value)
      },
      delete(name, options = {}) {
        // An expired cookie with the attributes it was set with (Max-Age=0 after them, so it reads as a removal).
        write(name, '', { ...options, maxAge: undefined })
        const key = `${name};${options.path ?? '/'};${options.domain ?? ''}`
        out.set(key, out.get(key)! + '; Max-Age=0')
        current.delete(name)
      },
    },
    apply(response) {
      if (!out.size) return response
      const headers = new Headers(response.headers) // a redirect's headers are immutable: copy them
      for (const header of out.values()) headers.append('set-cookie', header)
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
    },
  }
}

/**
 * A static or client route's view of the request: built once for everyone, so a visitor's cookies and headers aren't
 * there to read. Using either throws, naming the route and the fix; the rest (the URL) is fine.
 */
function builtOnce(route: string, request: Request): { request: Request; cookies: Cookies } {
  const refuse = (what: string) => () => { throw new Error(`${route} reads ${what}, but static routes are built once for everyone: make it 'server' (routes in vite.config.ts)`) }
  const cookies: Cookies = { get: refuse('cookies'), getAll: refuse('cookies'), set: refuse('cookies'), delete: refuse('cookies') }
  const headers = new Proxy(request.headers, { get: refuse("the request's headers") })
  const proxied = new Proxy(request, {
    get(target, key) {
      if (key === 'headers') return headers
      const value = Reflect.get(target, key, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
  return { request: proxied, cookies }
}

const METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const
const WRITES = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * An endpoint's answer: the method's handler (HEAD falls back to GET), 405 with Allow for others, 403 for a write from
 * another site. Undefined when the module exports no handler at all (a helper file, not an endpoint).
 */
async function callEndpoint(file: string, mod: EndpointModule, context: LoadContext, options: { site?: SiteOptions; dev?: boolean }): Promise<Response | undefined> {
  const exported = METHODS.filter((m) => typeof mod[m] === 'function')
  if (!exported.length) return undefined
  const { request } = context
  const method = request.method.toUpperCase()
  const fn = mod[method as (typeof METHODS)[number]] ?? (method === 'HEAD' ? mod.GET : undefined)
  if (!fn) {
    const allow = [...new Set(exported.flatMap((m) => (m === 'GET' ? ['GET', 'HEAD'] : [m])))].sort()
    return new Response('Method Not Allowed', { status: 405, headers: { allow: allow.join(', '), 'content-type': 'text/plain; charset=utf-8' } })
  }
  if (WRITES.has(method) && !sameOrigin(request, options.site?.url)) {
    return new Response('Forbidden: cross-site request', { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8' } })
  }
  let response: unknown
  try {
    response = await fn(context)
  } catch (err) {
    if (options.dev) throw err
    console.error(`clarusjs: ${file}: ${method} failed: ${(err as Error)?.message ?? err}`)
    return failure(`${file}: ${method} failed`)
  }
  if (!(response instanceof Response)) {
    const message = `${file}: ${method} must return a Response (got ${response === null ? 'null' : typeof response})`
    if (options.dev) throw new Error(message)
    console.error(`clarusjs: ${message}`)
    return failure(message)
  }
  return method === 'HEAD' ? new Response(null, { status: response.status, statusText: response.statusText, headers: response.headers }) : response
}

/**
 * Whether a write comes from this site (CSRF): not marked cross-site by the browser, and its Origin (else its Referer's
 * origin) is the request's own or the configured site URL's (behind a proxy the request URL can differ). With neither
 * header, a write carrying cookies is refused (a browser acting for the visitor, unidentified); one without cookies
 * (a server or a script) has nothing of the visitor's to abuse, and is allowed.
 */
function sameOrigin(request: Request, site?: string): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false
  let origin = request.headers.get('origin')
  if (origin === 'null') return false // an opaque origin (a sandboxed frame, a data: page): never this site
  if (!origin) {
    const referer = request.headers.get('referer')
    try { origin = referer ? new URL(referer).origin : null } catch { origin = null }
  }
  if (!origin) return !request.headers.has('cookie')
  const allowed = [new URL(request.url).origin]
  if (site) try { allowed.push(new URL(site).origin) } catch {}
  return allowed.includes(origin)
}
