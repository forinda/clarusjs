// #95: src/pages/**/*.ts endpoints (GET, POST, …) served by the same handler, with cross-site writes refused.
import { expect, test } from 'vitest'
import { createHandler } from '../../src/server/handler.ts'

const h = createHandler(
  { '/src/pages/index.tscl': async () => ({ render: () => '<h1>home</h1>' }) },
  {
    endpoints: {
      '/src/pages/api/items.ts': async () => ({
        GET: ({ request, cookies, locals }: any) => Response.json({ q: new URL(request.url).searchParams.get('q'), session: cookies.get('session') ?? null, user: locals.user ?? null }),
        POST: async ({ request, cookies }: any) => { cookies.set('saved', '1'); return Response.json({ got: await request.json() }, { status: 201 }) },
      }),
      '/src/pages/api/items/[id].ts': async () => ({ DELETE: ({ params }: any) => new Response(null, { status: 204, headers: { 'x-id': params.id } }) }),
      '/src/pages/api/broken.ts': async () => ({ GET: () => 'not a response' }) as never,
      '/src/pages/api/helpers.ts': async () => ({ helper: () => 1 }) as never, // no method exported: not an endpoint
    },
    hooks: { handle: ({ locals }) => { (locals as { user?: string }).user = 'ada' } },
    site: { url: 'https://clarusjs.com' },
  },
)
const call = (path: string, init: RequestInit = {}) => h.fetch(new Request(`https://x.test${path}`, init))

test('GET: the handler gets the request, cookies and locals; its Response is the answer', async () => {
  const r = await call('/api/items?q=a', { headers: { cookie: 'session=7' } })
  expect(r.status).toBe(200)
  expect(await r.json()).toEqual({ q: 'a', session: '7', user: 'ada' })
})

test('POST from the same origin: allowed, Set-Cookie on the answer', async () => {
  const r = await call('/api/items', { method: 'POST', headers: { origin: 'https://x.test', 'content-type': 'application/json' }, body: '{"a":1}' })
  expect(r.status).toBe(201)
  expect(await r.json()).toEqual({ got: { a: 1 } })
  expect(r.headers.get('set-cookie')).toContain('saved=1')
})

test('route params; HEAD falls back to GET; a method not exported is 405 with Allow', async () => {
  expect((await call('/api/items/42', { method: 'DELETE', headers: { origin: 'https://x.test' } })).headers.get('x-id')).toBe('42')
  const head = await call('/api/items', { method: 'HEAD' })
  expect(head.status).toBe(200)
  expect(await head.text()).toBe('')
  const put = await call('/api/items', { method: 'PUT', headers: { origin: 'https://x.test' } })
  expect(put.status).toBe(405)
  expect(put.headers.get('allow')).toBe('GET, HEAD, POST')
})

test('CSRF: a cross-site write is refused (Origin or Sec-Fetch-Site); the site URL counts as same-origin (behind a proxy)', async () => {
  expect((await call('/api/items', { method: 'POST', headers: { origin: 'https://evil.test' }, body: '{}' })).status).toBe(403)
  expect((await call('/api/items', { method: 'POST', headers: { 'sec-fetch-site': 'cross-site' }, body: '{}' })).status).toBe(403)
  expect((await call('/api/items/1', { method: 'DELETE', headers: { origin: 'https://evil.test' } })).status).toBe(403)
  // Behind a proxy the request URL can be http://localhost:3000 while the browser is on the public site.
  const proxied = await h.fetch(new Request('http://localhost:3000/api/items', { method: 'POST', headers: { origin: 'https://clarusjs.com', 'content-type': 'application/json' }, body: '{}' }))
  expect(proxied.status).toBe(201)
  // No Origin (curl, a server): allowed; reads are never checked.
  expect((await call('/api/items', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } })).status).toBe(201)
  expect((await call('/api/items', { headers: { origin: 'https://evil.test' } })).status).toBe(200)
})

test('a handler that returns something else is a 500; a module without methods is no endpoint (404)', async () => {
  expect((await call('/api/broken')).status).toBe(500)
  expect((await call('/api/helpers')).status).toBe(404)
})

test('endpoints are server routes (for preview, adapters and the manifest); pages still answer', async () => {
  expect(h.serverRoutes).toEqual(expect.arrayContaining(['/api/items', '/api/items/[id]']))
  expect(h.isServerPath('/api/items/9')).toBe(true)
  expect(await (await call('/')).text()).toContain('<h1>home</h1>')
})

test('review: a write without Origin is checked by Referer, and refused when it carries cookies and neither header', async () => {
  const post = (headers: Record<string, string>) => call('/api/items', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: '{}' })
  expect((await post({ referer: 'https://evil.test/page' })).status).toBe(403)
  expect((await post({ origin: 'null', referer: 'https://x.test/page' })).status).toBe(403) // a sandboxed frame
  expect((await post({ referer: 'https://x.test/somewhere' })).status).toBe(201)
  expect((await post({ cookie: 'session=1' })).status).toBe(403) // a browser acting for the visitor, unidentified
  expect((await post({})).status).toBe(201) // no cookies: a server or a script, nothing of the visitor's to abuse
})

test('review: a malformed escape in an endpoint path is a 404, not a crash', async () => {
  expect((await call('/api/items/%E0%A4%A')).status).toBe(404)
})
