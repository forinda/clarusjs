// Search: sections from built pages, a sharded index (never one big file), and queries that load only what they need.
import { expect, test } from 'vitest'
import { resolve } from 'node:path'
import { buildIndex, sectionsOf } from '../src/vite.js'
import { search, tokens } from '../src/search.js'

const page = (main: string, head = '') => `<!doctype html><html><head><title>T</title>${head}</head><body><nav class="sidebar">Sidebar words</nav><main class="content" id="content" tabindex="-1">${main}</main></body></html>`

const html = page(`<p class="crumb">Guide › Templates</p>
<details class="toc-inline"><summary>On this page</summary><ul><li><a href="#one">One</a></li></ul></details>
<h1 id="holes" tabindex="-1">Holes &amp; more</h1><p class="lead"><code>&#123;&#123; }}</code> holes print values.</p>
<script>ignored()</script><style>.x{}</style>
<h2 id="one" tabindex="-1">First <em>part</em> <a class="header-anchor" href="#one" aria-label="Permalink">#</a></h2><p>Escaped &lt;b&gt; text<!--[0-->.<!--]--></p>
<h3 id="two">Second</h3><p>Café rows</p><h2>No id</h2><p>still second</p>
<footer class="page-footer"><a class="edit" href="#">Edit this page</a></footer>`)

test('a page splits at its h2/h3 (with ids) into sections; theme chrome, scripts and markup are left out', () => {
  expect(sectionsOf(html, '/guide/holes')).toEqual([
    { u: '/guide/holes', p: 'Holes & more', h: 'Holes & more', t: '{{ }} holes print values.' },
    { u: '/guide/holes#one', p: 'Holes & more', h: 'First part', t: 'Escaped <b> text.' },
    { u: '/guide/holes#two', p: 'Holes & more', h: 'Second', t: 'Café rows No id still second' },
  ])
})

test('pages without content, noindex pages and data-search="false" pages are not indexed', () => {
  expect(sectionsOf('<html><body><div id="app"></div></body></html>', '/tour/1')).toEqual([])
  expect(sectionsOf(page('<h1>X</h1>', '<meta name="robots" content="noindex">'), '/x')).toEqual([])
  expect(sectionsOf(page('<h1 data-search="false">X</h1>'), '/x')).toEqual([])
})

test('tokens: lowercase words, accents folded, one-letter words dropped', () => {
  expect(tokens('Café, <b>Ñame</b> a x2 ISLANDS')).toEqual(['cafe', 'name', 'x2', 'islands'])
})

test('the index is many small files: terms sharded by their first two letters, sections in chunks', () => {
  const sections = Array.from({ length: 70 }, (_, i) => ({ u: `/p${i}`, p: 'Page', h: 'Page', t: i === 3 ? 'signals and islands' : 'filler' }))
  const files = buildIndex(sections)
  expect([...files.keys()].sort()).toEqual(['s-0.json', 's-1.json', 't-an.json', 't-fi.json', 't-is.json', 't-pa.json', 't-si.json'])
  expect(JSON.parse(files.get('s-1.json')!)).toHaveLength(6)
  expect(JSON.parse(files.get('t-is.json')!)).toEqual({ islands: [3, 1] })
})

test('search: every word must match (the last as a prefix), headings rank first, only needed files load', async () => {
  const files = buildIndex([
    { u: '/a', p: 'State', h: 'State', t: 'Signals hold island state.' },
    { u: '/b', p: 'Islands', h: 'Islands', t: 'An island has state and signals.' },
    { u: '/c', p: 'Lists', h: 'Lists', t: 'Rows of items.' },
  ])
  const loaded: string[] = []
  const load = async (name: string) => { loaded.push(name); return JSON.parse(files.get(name)!) }
  const results = await search('island sta', load)
  expect(results.map((r) => r.u)).toEqual(['/a', '/b'])
  expect(results[0]).toEqual({ u: '/a', p: 'State', h: 'State', t: 'Signals hold island state.' })
  expect(loaded.sort()).toEqual(['s-0.json', 't-is.json', 't-st.json'])
  expect(await search('island rows', load)).toEqual([])
  // A word repeated all over a long text doesn't outrank it in a heading: the text counts at most 3 times.
  const long = buildIndex([{ u: '/notes', p: 'Notes', h: 'Notes', t: 'island '.repeat(40) }, { u: '/i', p: 'Islands', h: 'Island', t: 'x' }])
  expect((await search('island', async (f) => JSON.parse(long.get(f)!))).map((r) => r.u)).toEqual(['/i', '/notes'])
  expect(await search('x', load)).toEqual([])
})

test('loads in Vite dev (the module runner), where the base comes from import.meta.env', async () => {
  const { createServer, isRunnableDevEnvironment } = await import('vite')
  const server = await createServer({ root: resolve(import.meta.dirname, '..'), configFile: false, logLevel: 'silent', base: '/docs/', server: { middlewareMode: true, ws: false } })
  try {
    const env = server.environments.ssr
    if (!isRunnableDevEnvironment(env)) throw new Error('no runner')
    const search = await env.runner.import<{ base: string }>('/src/search.js')
    expect(search.base).toBe('/docs/')
  } finally {
    await server.close()
  }
})

test("#360: the layout's parts carry a scope class; they stay out of the index all the same", () => {
  const html = page('<h1 id="start">Start</h1><details class="toc-inline cl-c-contents-1"><summary>On this page</summary><a href="#one">One</a></details><p>Body.</p><footer class="page-footer cl-c-page-footer-2"><a class="next" href="/x">Next page</a></footer>')
  expect(sectionsOf(html, '/start')).toEqual([{ u: '/start', p: 'Start', h: 'Start', t: 'Body.' }])
})

test('a class that only starts like one of them (crumb-note, custom-page-footer) stays in the index', () => {
  const html = page('<h1 id="start">Start</h1><p class="crumb-note">Keep me.</p><footer class="custom-page-footer">And me.</footer>')
  expect(sectionsOf(html, '/start')[0]!.t).toBe('Keep me. And me.')
})
