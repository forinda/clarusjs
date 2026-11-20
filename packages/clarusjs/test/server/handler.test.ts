import { describe, expect, test } from 'vitest'
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

describe('full-document pages', () => {
  const island = '<cl-island c="c" src="/c" p="{}"></cl-island>'
  const doc = (head: string, body: string) => `<html><head>${head}</head><body>${body}</body></html>`
  const page = (html: string) => createHandler({ '/src/pages/index.clarus': async () => ({ render: () => html }) }, { loaderUrl: '/assets/loader.js' })
  const get = async (html: string) => (await page(html).fetch(new Request('http://x/'))).text()

  test('a page that renders <html> gets one doctype and no default shell', async () => {
    const out = await get(doc('<title>Docs</title>', '<h1>x</h1>'))
    expect(out).toBe('<!doctype html>' + doc('<title>Docs</title>', '<h1>x</h1>'))
  })

  test('an existing doctype is not duplicated', async () => {
    const html = '<!DOCTYPE html>\n' + doc('', '<p>x</p>')
    expect(await get(html)).toBe(html)
  })

  test('islands: style goes before </head>, loader before </body>', async () => {
    const out = await get(doc('<title>Docs</title>', island))
    expect(out).toBe('<!doctype html>' + doc('<title>Docs</title><style>cl-island{display:contents}</style>',
      island + '<script type="module" src="/assets/loader.js"></script>'))
  })

  test('uppercase tags are handled', async () => {
    const out = await get(`<HTML><HEAD></HEAD><BODY>${island}</BODY></HTML>`)
    expect(out).toContain('<style>cl-island{display:contents}</style></HEAD>')
    expect(out).toContain('<script type="module" src="/assets/loader.js"></script></BODY>')
  })

  test('missing </head> or </body>: the pieces are appended', async () => {
    const out = await get(`<html>${island}`)
    expect(out.startsWith('<!doctype html><html>')).toBe(true)
    expect(out.endsWith('<style>cl-island{display:contents}</style><script type="module" src="/assets/loader.js"></script>')).toBe(true)
  })

  test('no islands: nothing is injected', async () => {
    const out = await get(doc('<title>Docs</title>', '<p>static</p>'))
    expect(out).not.toContain('<script')
    expect(out).not.toContain('<style>')
  })

  test('a page that is not a document still gets the default shell', async () => {
    expect(await get('<p>x</p>')).toBe('<!doctype html><html><head><meta charset="utf-8"><title>clarusjs</title></head><body><p>x</p></body></html>')
  })
})
