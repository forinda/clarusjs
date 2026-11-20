// Review of #144: head completion edge cases.
import { expect, test } from 'vitest'
import { createHandler } from '../../src/server/handler.ts'

const get = async (h: ReturnType<typeof createHandler>, path = '/') => (await h.fetch(new Request(`http://x${path}`))).text()
const headOf = (html: string) => /<head>([\s\S]*)<\/head>/.exec(html)![1]!
const page = (render: string, options: Parameters<typeof createHandler>[1] = {}) => createHandler({ '/src/pages/index.tscl': async () => ({ render: () => render }) }, options)

test('commented tags stay comments: not moved from <cl-head>, not counted as set, not replaced', async () => {
  const h = page('<html><head><title>T</title><!-- <meta name="description" content="old"> --></head><body><cl-head><!-- <meta name="robots" content="noindex"> --><meta name="description" content="new"></cl-head></body></html>', {
    head: { tags: [['meta', { name: 'theme-color', content: '#fff' }]] },
  })
  const head = headOf(await get(h))
  expect(head).toContain('<!-- <meta name="description" content="old"> -->') // the comment is untouched
  expect(head).toContain('<meta name="description" content="new">')
  expect(head).not.toMatch(/<meta name="robots"[^>]*>(?!\s*-->)/) // no active noindex
  const commented = page('<html><head><title>T</title><!-- <meta name="theme-color" content="#000"> --></head><body></body></html>', { head: { tags: [['meta', { name: 'theme-color', content: '#fff' }]] } })
  expect(headOf(await get(commented))).toContain('<meta name="theme-color" content="#fff">') // a comment doesn't set the key
})

test('a document with <html> but no <head> gets one, so page tags are not lost', async () => {
  const html = await get(page('<html><body><cl-head><meta name="description" content="d"></cl-head><p>x</p></body></html>'))
  expect(html).toContain('<head><meta name="description" content="d"></head>')
  expect(html).toContain('<body><p>x</p></body>')
})

test('site tags win over generated social defaults; a site og:image is not mistaken for the page image', async () => {
  const h = page('<html><head><title>T</title></head><body></body></html>', {
    site: { url: 'https://example.com' }, head: { tags: [['meta', { property: 'og:type', content: 'article' }], ['meta', { property: 'og:image', content: 'https://cdn.example.com/card.png' }]] },
  })
  const head = headOf(await get(h))
  expect(head).toContain('<meta property="og:type" content="article">')
  expect(head).not.toContain('content="website"')
  expect(head.match(/property="og:image"/g)).toHaveLength(1)
  expect(head).toContain('<meta name="twitter:card" content="summary_large_image">')
})

test('a relative page og:url is made absolute like og:image', async () => {
  const h = page('<html><head><title>T</title></head><body><cl-head><meta property="og:url" content="/article"></cl-head></body></html>', { site: { url: 'https://example.com' } })
  expect(headOf(await get(h))).toContain('<meta property="og:url" content="https://example.com/article">')
})

test('the client route shell gets canonical and social tags too, and a head error is a located 500, not a crash', async () => {
  const pages = { '/src/pages/app.tscl': async () => ({ render: () => '<p>a</p>' }) }
  const client = { modes: { '/app': 'client' as const }, client: { '/app': '/app.js' } }
  expect(await get(createHandler(pages, { ...client, site: { url: 'https://example.com' } }), '/app')).toContain('<link rel="canonical" href="https://example.com/app">')
  const broken = createHandler(pages, { ...client, head: { tags: [['meta', { property: 'og:image', content: '/card.png' }]] } })
  expect((await broken.fetch(new Request('http://x/app'))).status).toBe(500)
})
