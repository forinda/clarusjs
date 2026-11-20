import { expect, test } from 'vitest'
import { createHandler, routeFromFile } from '../../src/server/handler.ts'

test('routeFromFile maps page files to paths', () => {
  expect(routeFromFile('/src/pages/index.clarus')).toBe('/')
  expect(routeFromFile('/src/pages/about.clarus')).toBe('/about')
  expect(routeFromFile('/src/pages/blog/index.clarus')).toBe('/blog')
})

const handler = createHandler({
  '/src/pages/index.clarus': async () => ({ render: () => '<h1>x</h1>' }),
  '/src/pages/app.clarus': async () => ({ render: () => '<cl-island c="c" src="/c" p="{}"></cl-island>' }),
})

test('static page ships no script', async () => {
  const res = await handler.fetch(new Request('http://x/'))
  expect(res.status).toBe(200)
  expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8')
  const html = await res.text()
  expect(html).toBe('<!doctype html><html><head><meta charset="utf-8"><title>clarusjs</title></head><body><h1>x</h1></body></html>')
})

test('page with islands ships exactly the loader script', async () => {
  const html = await (await handler.fetch(new Request('http://x/app'))).text()
  expect(html.match(/<script/g)).toHaveLength(1)
  expect(html).toContain('<script type="module" src="/cl-loader.js"></script>')
})

test('non-GET is 405 and unknown path is 404', async () => {
  expect((await handler.fetch(new Request('http://x/', { method: 'POST' }))).status).toBe(405)
  const missing = await handler.fetch(new Request('http://x/missing'))
  expect(missing.status).toBe(404)
  expect(missing.headers.get('content-type')).toContain('text/plain')
})

test('pages with islands make cl-island layout-neutral (display: contents)', async () => {
  const html = await (await handler.fetch(new Request('http://x/app'))).text()
  expect(html).toContain('<style>cl-island{display:contents}</style>')
  const plain = await (await handler.fetch(new Request('http://x/'))).text()
  expect(plain).not.toContain('<style>')
})
