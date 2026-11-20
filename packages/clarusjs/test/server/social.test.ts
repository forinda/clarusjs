// #116: canonical URLs and social cards from site.url.
import { expect, test } from 'vitest'
import { createHandler } from '../../src/server/handler.ts'

const doc = (head: string, body = '') => `<html><head><meta charset="utf-8">${head}</head><body>${body}</body></html>`
const headOf = async (h: ReturnType<typeof createHandler>, path = '/') => /<head>([\s\S]*)<\/head>/.exec(await (await h.fetch(new Request(`http://x${path}`))).text())![1]!

test('with site.url every page gets a canonical URL and social tags, from its title (without the template) and description', async () => {
  const h = createHandler({ '/src/pages/guide/intro.tscl': async () => ({ render: () => doc('<title>Intro &amp; "more"</title><meta name="description" content="About it">') }) }, {
    base: '/docs/', head: { titleTemplate: '%s · Site' }, site: { url: 'https://example.com', name: 'Site', image: '/og.png' },
  })
  const head = await headOf(h, '/guide/intro')
  expect(head).toContain('<title>Intro &amp; "more" · Site</title>')
  expect(head).toContain('<link rel="canonical" href="https://example.com/docs/guide/intro">')
  expect(head).toContain('<meta property="og:title" content="Intro &amp; &quot;more&quot;">')
  expect(head).toContain('<meta property="og:description" content="About it">')
  expect(head).toContain('<meta property="og:url" content="https://example.com/docs/guide/intro">')
  expect(head).toContain('<meta property="og:type" content="website">')
  expect(head).toContain('<meta property="og:site_name" content="Site">')
  expect(head).toContain('<meta property="og:image" content="https://example.com/docs/og.png">')
  expect(head).toContain('<meta name="twitter:card" content="summary_large_image">')
})

test('page tags win; a relative page image is made absolute; no image means a summary card', async () => {
  const h = createHandler({
    '/src/pages/index.tscl': async () => ({ render: () => doc('<title>Home</title>', '<cl-head><meta property="og:type" content="article"><meta property="og:image" content="img/a.png"></cl-head>') }),
    '/src/pages/plain.tscl': async () => ({ render: () => doc('<title>Plain</title>') }),
  }, { site: { url: 'https://example.com/' } })
  const home = await headOf(h)
  expect(home).toContain('<meta property="og:type" content="article">')
  expect(home).not.toContain('content="website"')
  expect(home).toContain('<meta property="og:image" content="https://example.com/img/a.png">')
  expect(home).toContain('<link rel="canonical" href="https://example.com/">')
  expect(await headOf(h, '/plain')).toContain('<meta name="twitter:card" content="summary">')
})

test('without site.url nothing is added, but a relative og:image is an error instead of a broken card', async () => {
  const h = createHandler({
    '/src/pages/index.tscl': async () => ({ render: () => doc('<title>Home</title>') }),
    '/src/pages/card.tscl': async () => ({ render: () => doc('<title>Card</title>', '<cl-head><meta property="og:image" content="/a.png"></cl-head>') }),
  })
  expect(await headOf(h)).not.toContain('canonical')
  const res = await h.fetch(new Request('http://x/card'))
  expect(res.status).toBe(500)
})

test('the canonical URL is the same with or without a trailing slash', async () => {
  const h = createHandler({ '/src/pages/a.tscl': async () => ({ render: () => doc('<title>A</title>') }) }, { site: { url: 'https://example.com' } })
  expect(await headOf(h, '/a/')).toContain('<link rel="canonical" href="https://example.com/a">')
})
