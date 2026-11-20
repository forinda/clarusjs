// The fetch handler: Request → Response. Same function for dev, per-request SSR and (later) build-time prerender.

type PageModule = { render(props?: object): string }

/** '/src/pages/index.kvw' → '/', '/src/pages/blog/index.kvw' → '/blog', '/src/pages/about.kvw' → '/about' */
export function routeFromFile(file: string): string {
  const path = file.replace(/^.*?\/src\/pages/, '').replace(/\.kvw$/, '').replace(/\/index$/, '')
  return path || '/'
}

export function createHandler(pages: Record<string, () => Promise<PageModule>>): { fetch(request: Request): Promise<Response> } {
  const routes = new Map(Object.entries(pages).map(([file, load]) => [routeFromFile(file), load]))
  return {
    async fetch(request) {
      if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method Not Allowed', { status: 405 })
      const load = routes.get(new URL(request.url).pathname)
      if (!load) return new Response('Not Found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } })
      const html = (await load()).render({})
      // Only pages with islands get a script, and only the loader; it fetches each island's own chunk.
      const scripts = html.includes('<kv-island') ? '<script type="module" src="/kv-loader.js"></script>' : ''
      const body = `<!doctype html><html><head><meta charset="utf-8"><title>kview</title></head><body>${html}${scripts}</body></html>`
      return new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' } })
    },
  }
}
