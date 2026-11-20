// #118: a 404 page from src/pages/404.tscl, with links that work at any depth.
import { expect, test } from 'vitest'
import { createHandler } from '../../src/server/handler.ts'

const page404 = '<html><head><title>Not found</title><link rel="stylesheet" href="styles/x.css"></head><body><a href="guide/intro">guide</a> <a href="./">home</a> <a href="/abs">abs</a> <a href="#top">top</a> <a href="https://x.dev/a">ext</a><img src="img/a.png"></body></html>'

test('an unknown page path gets the 404 page with status 404, its relative links resolved from the site root', async () => {
  const h = createHandler({
    '/src/pages/index.tscl': async () => ({ render: () => '<h1>Home</h1>' }),
    '/src/pages/404.tscl': async () => ({ render: () => page404 }),
  }, { base: '/docs/' })
  const res = await h.fetch(new Request('http://x/a/b/c'))
  expect(res.status).toBe(404)
  expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8')
  const html = await res.text()
  expect(html).toContain('<a href="/docs/guide/intro">guide</a> <a href="/docs/">home</a> <a href="/abs">abs</a> <a href="#top">top</a> <a href="https://x.dev/a">ext</a><img src="/docs/img/a.png">')
  expect(html).toContain('<link rel="stylesheet" href="/docs/styles/x.css">')
  expect(html).toContain('<title>Not found</title>')
})

test('without a 404 page, and for data or fragment requests, the 404 stays plain', async () => {
  const plain = createHandler({ '/src/pages/index.tscl': async () => ({ render: () => '<h1>Home</h1>' }) })
  expect(await (await plain.fetch(new Request('http://x/nope'))).text()).toBe('Not Found')
  const h = createHandler({
    '/src/pages/index.tscl': async () => ({ render: () => '<h1>Home</h1>' }),
    '/src/pages/404.tscl': async () => ({ render: () => page404 }),
  }, { fragments: true })
  for (const path of ['/nope/__data.json', '/nope/index.frag.html']) {
    const res = await h.fetch(new Request(`http://x${path}`))
    expect(res.status).toBe(404)
    expect(await res.text()).toBe('Not Found')
  }
})
