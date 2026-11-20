// #40: each page links the stylesheets it imports (and its components import), before the component styles.
import { expect, test } from 'vitest'
import { createHandler, toFragment } from '../../src/server/handler.ts'

const doc = '<html><head><title>T</title></head><body><main data-cl-swap>x</main></body></html>'
const page = async () => ({ render: () => doc })
const h = () => createHandler(
  { '/src/pages/index.tscl': page, '/src/pages/plain.tscl': page, '/src/pages/app/[id].tscl': page },
  {
    stylesUrl: '/cl-styles.css',
    css: { '/': ['/a.css', '/b.css'], '/app/[id]': ['/app.css'] },
    modes: { '/app/*': 'client' }, client: { '/app/[id]': '/r.js' }, fragments: true,
  },
)

test('a page links its own stylesheets, then the component styles; a page without imports links only those', async () => {
  const html = await (await h().fetch(new Request('http://x/'))).text()
  expect(html).toContain('<link rel="stylesheet" href="/a.css"><link rel="stylesheet" href="/b.css"><link rel="stylesheet" href="/cl-styles.css">')
  const plain = await (await h().fetch(new Request('http://x/plain'))).text()
  expect(plain.match(/rel="stylesheet"/g)).toHaveLength(1)
})

test("a client route's shell links every client page's stylesheets (the router keeps the head)", async () => {
  const shell = await (await h().fetch(new Request('http://x/app/1'))).text()
  expect(shell).toContain('<link rel="stylesheet" href="/app.css"><link rel="stylesheet" href="/cl-styles.css">')
})

test("a fragment carries the page's stylesheet links, so fragment navigation can load what is missing", async () => {
  expect(await (await h().fetch(new Request('http://x/index.frag.html'))).text())
    .toBe('<title>T</title><link rel="stylesheet" href="/a.css"><link rel="stylesheet" href="/b.css"><link rel="stylesheet" href="/cl-styles.css"><main data-cl-swap>x</main>')
  expect(toFragment(doc)).toBe('<title>T</title><main data-cl-swap>x</main>') // the pure function is unchanged
})
