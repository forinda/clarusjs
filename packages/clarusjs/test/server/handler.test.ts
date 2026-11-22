import { describe, expect, test } from 'vitest'
import { createHandler, routeFromFile } from '../../src/server/handler.ts'

test('routeFromFile maps page files to paths', () => {
  expect(routeFromFile('/src/pages/index.tscl')).toBe('/')
  expect(routeFromFile('/src/pages/about.tscl')).toBe('/about')
  expect(routeFromFile('/src/pages/blog/index.tscl')).toBe('/blog')
})

const handler = createHandler({
  '/src/pages/index.tscl': async () => ({ render: () => '<h1>x</h1>' }),
  '/src/pages/app.tscl': async () => ({ render: () => '<cl-island c="c" src="/c" p="{}"></cl-island>' }),
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
  const page = (html: string) => createHandler({ '/src/pages/index.tscl': async () => ({ render: () => html }) }, { loaderUrl: '/assets/loader.js' })
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

  // #56
  test('a BOM or a comment before the doctype: still one doctype', async () => {
    for (const before of ['\uFEFF', '<!-- built by clarusjs -->\n', '\uFEFF<!-- a -->\n']) {
      const html = before + '<!doctype html>' + doc('<title>T</title>', '<p>x</p>')
      const out = await get(html)
      expect(out.match(/<!doctype/gi), JSON.stringify(before)).toHaveLength(1)
      expect(out).toBe(html.replace(/^\uFEFF/, '')) // the BOM is dropped: the response declares UTF-8
    }
  })

  test('<html> inside an inline script is not a document: the page still gets the shell', async () => {
    const out = await get('<script inline>document.write("<html><body></body></html>")</script><p>x</p>')
    expect(out.startsWith('<!doctype html><html><head><meta charset="utf-8"><title>clarusjs</title></head><body>')).toBe(true)
    expect(out).toContain('<body><script>document.write("<html><body></body></html>")</script><p>x</p></body></html>'.replace('<script>', '<script inline>'))
  })

  test('</body> or </head> inside a script: the loader and style still go in the real ones', async () => {
    const out = await get(doc('<script inline>const s = "</head>"</script>', island + '<script inline>const t = "</body>"</script>'))
    expect(out).toContain('const s = "</head>"</script><style>cl-island{display:contents}</style></head>')
    expect(out).toContain('const t = "</body>"</script><script type="module" src="/assets/loader.js"></script></body>')
  })

  test('uppercase tags are handled', async () => {
    const out = await get(`<HTML><HEAD></HEAD><BODY>${island}</BODY></HTML>`)
    expect(out).toContain('<style>cl-island{display:contents}</style></HEAD>')
    expect(out).toContain('<script type="module" src="/assets/loader.js"></script></BODY>')
  })

  test('missing <head>: one is created for the style; missing </body>: the script is appended', async () => {
    const out = await get(`<html>${island}`)
    expect(out.startsWith('<!doctype html><html><head><style>cl-island{display:contents}</style></head>')).toBe(true)
    expect(out.endsWith('<script type="module" src="/assets/loader.js"></script>')).toBe(true)
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

test('a trailing slash reaches the same page in dev as in the built site', async () => {
  const res = await handler.fetch(new Request('http://x/app/'))
  expect(res.status).toBe(200)
  expect(await res.text()).toContain('<cl-island')
})

test('a </body> inside a trailing comment does not capture the loader', async () => {
  const island = '<cl-island c="c" src="/c" p="{}"></cl-island>'
  const h = createHandler({ '/src/pages/index.tscl': async () => ({ render: () => `<html><head></head><body>${island}</body></html><!-- old </body> -->` }) })
  const out = await (await h.fetch(new Request('http://x/'))).text()
  expect(out).toContain(`${island}<script type="module" src="/cl-loader.js"></script></body></html><!-- old </body> -->`)
})

test('</head> inside a comment does not capture the island style', async () => {
  const island = '<cl-island c="c" src="/c" p="{}"></cl-island>'
  const h = createHandler({ '/src/pages/index.tscl': async () => ({ render: () => `<html><head><!-- </head> --><title>t</title></head><body>${island}</body></html>` }) })
  const out = await (await h.fetch(new Request('http://x/'))).text()
  expect(out).toContain('<title>t</title><style>cl-island{display:contents}</style></head>')
})

test('#39: with a stylesheet, every page links it in <head>', async () => {
  const h = createHandler({ '/src/pages/index.tscl': async () => ({ render: () => '<html><head><title>t</title></head><body><p>x</p></body></html>' }), '/src/pages/bare.tscl': async () => ({ render: () => '<p>x</p>' }) }, { stylesUrl: '/s.css' })
  for (const path of ['/', '/bare']) {
    const html = await (await h.fetch(new Request(`http://x${path}`))).text()
    expect(html).toMatch(/<head>.*<link rel="stylesheet" href="\/s\.css">.*<\/head>/)
  }
})
