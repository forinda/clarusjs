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

/** '/users/[id]' → keys ['id'] and a RegExp that captures each segment. */
function compile(path: string): { keys: string[]; regex: RegExp } {
  const keys: string[] = []
  const source = path.split('/').map((seg) => {
    const m = /^\[([A-Za-z_$][\w$]*)\]$/.exec(seg)
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
  options: { loaderUrl?: string; data?: Record<string, () => Promise<DataModule>> } = {},
): { fetch(request: Request): Promise<Response>; routes: string[]; paths(): Promise<string[]> } {
  // Static routes first, then dynamic ones with more fixed segments first: /users/new beats /users/[id].
  const routes: Route[] = Object.entries(pages)
    .map(([file, load]) => ({ path: routeFromFile(file), file: file.replace(/^\//, ''), load, ...compile(routeFromFile(file)) }))
    .sort((a, b) => a.keys.length - b.keys.length || b.path.split('/').length - a.path.split('/').length)
  const data = options.data ?? {}
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

  return {
    routes: routes.map((r) => r.path).sort(),
    /** Every concrete path to prerender: static routes as they are, dynamic ones from their entries(). */
    async paths() {
      const out: string[] = []
      for (const route of routes) {
        if (!route.keys.length) { out.push(route.path); continue }
        const dataFile = route.file.replace(/\.tscl$/, '.load.ts')
        const mod = data[`/${dataFile}`] ? await data[`/${dataFile}`]!() : undefined
        if (!mod?.entries) throw new Error(`${route.path} is a dynamic route: export entries() from ${dataFile} to list the pages to prerender`)
        for (const params of await mod.entries()) {
          out.push(route.path.replace(/\[(\w+)\]/g, (_, key: string) => {
            const value = (params as Record<string, unknown>)[key]
            // Each value fills one path segment and names a folder in the build: never empty, '.', '..' or with a '/'.
            if (typeof value !== 'string' || value === '' || value === '.' || value === '..' || value.includes('/')) {
              throw new Error(`${dataFile}: entries() gave ${JSON.stringify(value)} for "${key}"; each value must be a non-empty string without "/"`)
            }
            return encodeURIComponent(value)
          }))
        }
      }
      return out.sort()
    },
    async fetch(request) {
      if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method Not Allowed', { status: 405 })
      const pathname = new URL(request.url).pathname
      // '/guide/x/' is the same page as '/guide/x', in dev as on a static host.
      const found = match(pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname)
      const head = request.method === 'HEAD'
      if (!found) return new Response(head ? null : 'Not Found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } })
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
      const html = (await found.route.load()).render(props)
      const visible = maskComments(html)
      const hasIslands = visible.includes('<cl-island ')
      // Only pages with islands get a script, and only the loader; it fetches each island's own chunk.
      const style = hasIslands ? '<style>cl-island{display:contents}</style>' : '' // islands never affect layout
      const script = hasIslands ? `<script type="module" src="${loaderUrl}"></script>` : ''
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
