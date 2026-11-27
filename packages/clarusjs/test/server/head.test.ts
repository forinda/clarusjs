// #115: titles, descriptions and <head> tags per page and site-wide.
import { expect, test } from 'vitest'
import { createHandler } from '../../src/server/handler.ts'
import type { HeadTag } from '../../src/server/head.ts'

const doc = (head: string, body = '') => `<html><head><meta charset="utf-8">${head}</head><body>${body}</body></html>`
const get = async (h: ReturnType<typeof createHandler>, path = '/') => (await h.fetch(new Request(`http://x${path}`))).text()
const headOf = (html: string) => /<head>([\s\S]*)<\/head>/.exec(html)![1]!

test('titleTemplate wraps the page title; site tags are added to every page', async () => {
  const h = createHandler({ '/src/pages/index.tscl': async () => ({ render: () => doc('<title>Guide &amp; more</title>') }) }, {
    head: { titleTemplate: '%s · Site', tags: [['meta', { name: 'theme-color', content: '#fff' }], ['link', { rel: 'icon', href: '/i.svg' }]] },
  })
  expect(headOf(await get(h))).toBe('<meta charset="utf-8"><title>Guide &amp; more · Site</title><meta name="theme-color" content="#fff"><link rel="icon" href="/i.svg">')
})

test('<cl-head> moves into <head>: its title is used as written, and page tags win over site tags', async () => {
  const page = doc('<title>Layout</title><meta name="description" content="layout">', '<cl-head><title>Exact</title><meta name="description" content="page"><meta property="og:type" content="article"></cl-head><p>body</p>')
  const h = createHandler({ '/src/pages/index.tscl': async () => ({ render: () => page }) }, {
    head: { titleTemplate: '%s · Site', tags: [['meta', { name: 'description', content: 'site' }], ['meta', { name: 'robots', content: 'index' }]] },
  })
  const html = await get(h)
  expect(headOf(html)).toBe('<meta charset="utf-8"><title>Exact</title><meta name="description" content="page"><meta property="og:type" content="article"><meta name="robots" content="index">')
  expect(html).toContain('<body><p>body</p></body>')
})

test('a page without its own document gets the same treatment', async () => {
  const h = createHandler({ '/src/pages/index.tscl': async () => ({ render: () => '<cl-head><meta name="description" content="d"></cl-head><h1>x</h1>' }) }, { head: { titleTemplate: '%s · Site' } })
  expect(await get(h)).toBe('<!doctype html><html><head><meta charset="utf-8"><title>clarusjs · Site</title><meta name="description" content="d"></head><body><h1>x</h1></body></html>')
})

test('transformHead gets the head and the page, and returns the new head', async () => {
  const h = createHandler({ '/src/pages/about.tscl': async () => ({ render: () => doc('<title>About</title>') }) }, {
    head: { transform: (head, page) => `${head}<meta name="route" content="${page.route}">` },
  })
  expect(headOf(await get(h, '/about'))).toBe('<meta charset="utf-8"><title>About</title><meta name="route" content="/about">')
})

test('site tag values are escaped; fragments carry the final title', async () => {
  const h = createHandler({ '/src/pages/index.tscl': async () => ({ render: () => doc('<title>Home</title>', '<cl-head><title>Exact "x"</title></cl-head><main>m</main>') }) }, {
    fragments: true, head: { tags: [['meta', { name: 'x', content: '"><script>' }]] },
  })
  expect(headOf(await get(h))).toContain('<meta name="x" content="&quot;&gt;&lt;script&gt;">')
  expect(await get(h, '/index.frag.html')).toMatch(/^<title>Exact "x"<\/title>/)
})

test('a client route shell carries the title template for the router, and gets site tags', async () => {
  const h = createHandler({ '/src/pages/app.tscl': async () => ({ render: () => '<h1>a</h1>' }) }, {
    modes: { '/app': 'client' }, client: { '/app': '/app.js' },
    head: { titleTemplate: '%s · "Site"', tags: [['meta', { name: 'theme-color', content: '#fff' }]] },
  })
  const html = await get(h, '/app')
  expect(html).toContain('<script type="application/json" id="cl-routes" data-title="%s · &quot;Site&quot;" data-base="/">')
  expect(html).toContain('<meta name="theme-color" content="#fff">')
})

test('site scripts such as gtag: external with boolean attributes, inline content as written, on every page', async () => {
  const gtag: HeadTag[] = [
    ['script', { async: true, src: 'https://www.googletagmanager.com/gtag/js?id=G-X1' }, ''],
    ['script', {}, "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-X1')"],
  ]
  const h = createHandler({
    '/src/pages/index.tscl': async () => ({ render: () => doc('<title>a</title>') }),
    '/src/pages/app.tscl': async () => ({ render: () => '<p>b</p>' }),
  }, { modes: { '/app': 'client' }, client: { '/app': '/app.js' }, head: { tags: gtag } })
  for (const path of ['/', '/app']) {
    const html = await get(h, path)
    expect(html).toContain('<script async src="https://www.googletagmanager.com/gtag/js?id=G-X1"></script>')
    expect(html).toContain("<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-X1')</script>")
  }
})

test('site-wide JSON-LD: one script per object, as safe JSON', async () => {
  const h = createHandler({ '/src/pages/index.tscl': async () => ({ render: () => doc('<title>a</title>') }) }, {
    head: { jsonLd: { '@context': 'https://schema.org', '@type': 'WebSite', name: 'x</script>' } },
  })
  expect(headOf(await get(h))).toContain('<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"x\\u003c/script\\u003e"}</script>')
})

test('$ in titles and page tags is kept as written', async () => {
  const h = createHandler({ '/src/pages/index.tscl': async () => ({ render: () => doc('<title>Save $& more</title><meta name="d" content="a">', '<cl-head><meta name="d" content="$1 off"></cl-head>') }) }, { head: { titleTemplate: '%s · $$' } })
  expect(headOf(await get(h))).toBe('<meta charset="utf-8"><title>Save $& more · $$</title><meta name="d" content="$1 off">')
})

test('a <cl-head> title marked data-cl-template gets the site template, like the document\'s own title', async () => {
  const h = createHandler({ '/src/pages/index.tscl': async () => ({ render: () => '<cl-head><title data-cl-template>Pricing</title></cl-head><h1>x</h1>' }) }, { head: { titleTemplate: '%s · Site' } })
  expect(headOf(await get(h))).toBe('<meta charset="utf-8"><title>Pricing · Site</title>')
})
