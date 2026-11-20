// #35: fragment responses. <path>/index.frag.html is the page's title plus its swap region (data-cl-swap, else body).
import { expect, test } from 'vitest'
import { createHandler, toFragment } from '../../src/server/handler.ts'
import { routeToFile } from '../../src/vite/build.ts'

const doc = (body: string, title = 'T') => `<html><head><title>${title}</title><link rel="stylesheet" href="/a.css"></head><body>${body}</body></html>`

test('toFragment: the title plus the data-cl-swap element, or the body', () => {
  expect(toFragment(doc('<header>h</header><main data-cl-swap><main>inner</main><p>x</p></main><footer>f</footer>'))).toBe('<title>T</title><main data-cl-swap><main>inner</main><p>x</p></main>')
  expect(toFragment(doc('<h1>Hi</h1>'))).toBe('<title>T</title><body><h1>Hi</h1></body>')
  expect(toFragment('<h1>Bare</h1>')).toBe('<title>clarusjs</title><body><h1>Bare</h1></body>')
  // A marker inside a comment is not the region.
  expect(toFragment(doc('<!-- <div data-cl-swap> --><div data-cl-swap>real</div>'))).toBe('<title>T</title><div data-cl-swap>real</div>')
})

const page = (html: string) => async () => ({ render: () => html })
const handler = (fragments = true) => createHandler(
  { '/src/pages/index.tscl': page(doc('<h1>Home</h1>', 'Home')), '/src/pages/account/[id].tscl': page(doc('<h1>Acct</h1>')), '/src/pages/app.tscl': page('x') },
  { fragments, modes: { '/account/*': 'server', '/app': 'client' }, client: { '/app': '/r.js' } },
)

test('with fragments on, <path>/index.frag.html answers with the fragment, for static and server routes', async () => {
  const res = await handler().fetch(new Request('http://x/index.frag.html'))
  expect(res.status).toBe(200)
  expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8')
  expect(await res.text()).toBe('<title>Home</title><body><h1>Home</h1></body>')
  expect(await (await handler().fetch(new Request('http://x/account/7/index.frag.html'))).text()).toBe('<title>T</title><body><h1>Acct</h1></body>')
  expect(handler().isServerPath('/account/7/index.frag.html')).toBe(true)
  expect((await handler().fetch(new Request('http://x/app/index.frag.html'))).status).toBe(404) // client routes render in the browser
  expect((await handler(false).fetch(new Request('http://x/index.frag.html'))).status).toBe(404) // off by default
})

test('prerendering writes each static page fragment next to it', async () => {
  expect(await handler().paths()).toEqual(['/', '/app', '/app/__data.json', '/index.frag.html'])
  expect(routeToFile('/index.frag.html')).toBe('index.frag.html')
  expect(routeToFile('/guide/x/index.frag.html')).toBe('guide/x/index.frag.html')
})

test('#36: with fragments on, every static and server page loads the navigation script and the island style', async () => {
  const h = createHandler({ '/src/pages/index.tscl': page(doc('<h1>Home</h1>')) }, { fragments: true, navUrl: '/nav.js' })
  const html = await (await h.fetch(new Request('http://x/'))).text()
  expect(html).toContain('<script type="module" src="/nav.js"></script>')
  expect(html).toContain('<style>cl-island{display:contents}</style>')
  const off = await (await createHandler({ '/src/pages/index.tscl': page(doc('<h1>Home</h1>')) }).fetch(new Request('http://x/'))).text()
  expect(off).not.toContain('<script')
})
