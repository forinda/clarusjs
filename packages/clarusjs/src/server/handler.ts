// The fetch handler: Request → Response. Same function for dev, per-request SSR and (later) build-time prerender.

type PageModule = { render(props?: object): string }

/** '/src/pages/index.clarus' → '/', '/src/pages/blog/index.clarus' → '/blog', '/src/pages/about.clarus' → '/about' */
export function routeFromFile(file: string): string {
  const path = file.replace(/^.*?\/src\/pages/, '').replace(/\.clarus$/, '').replace(/\/index$/, '')
  return path || '/'
}

export function createHandler(
  pages: Record<string, () => Promise<PageModule>>,
  options: { loaderUrl?: string } = {},
): { fetch(request: Request): Promise<Response>; routes: string[] } {
  const routes = new Map(Object.entries(pages).map(([file, load]) => [routeFromFile(file), load]))
  const loaderUrl = options.loaderUrl ?? '/cl-loader.js'
  return {
    routes: [...routes.keys()].sort(),
    async fetch(request) {
      if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method Not Allowed', { status: 405 })
      const load = routes.get(new URL(request.url).pathname)
      const head = request.method === 'HEAD'
      if (!load) return new Response(head ? null : 'Not Found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } })
      const html = (await load()).render({})
      const hasIslands = html.replace(/<!--[\s\S]*?-->/g, '').includes('<cl-island ')
      // Only pages with islands get a script, and only the loader; it fetches each island's own chunk.
      const style = hasIslands ? '<style>cl-island{display:contents}</style>' : '' // islands never affect layout
      const script = hasIslands ? `<script type="module" src="${loaderUrl}"></script>` : ''
      const body = /<html[\s>]/i.test(html)
        ? fullDocument(html, style, script)
        : `<!doctype html><html><head><meta charset="utf-8"><title>clarusjs</title>${style}</head><body>${html}${script}</body></html>`
      return new Response(head ? null : body, { headers: { 'content-type': 'text/html; charset=utf-8' } })
    },
  }
}

/** A page whose layout renders the whole document: add the doctype if missing, and put style/script in place. */
function fullDocument(html: string, style: string, script: string): string {
  let out = /^\s*<!doctype/i.test(html) ? html : `<!doctype html>${html}`
  if (style) {
    const head = out.search(/<\/head>/i)
    out = head === -1 ? out + style : out.slice(0, head) + style + out.slice(head)
  }
  if (script) {
    const bodies = [...out.matchAll(/<\/body>/gi)]
    const body = bodies.length ? bodies[bodies.length - 1]!.index! : -1
    out = body === -1 ? out + script : out.slice(0, body) + script + out.slice(body)
  }
  return out
}
