// #25: the route manifest describes what each built page ships.
import { expect, test } from 'vitest'
import { describeRoute } from '../../src/vite/manifest.ts'

const chunks = {
  'src/runtime/loader.ts': { file: 'assets/cl-loader-a.js' },
  '_dom-b.js': { file: 'assets/dom-b.js' },
  'src/components/counter.clarus': { file: 'assets/counter-c.js', imports: ['_dom-b.js'] },
  'src/components/copy.clarus': { file: 'assets/copy-d.js', imports: ['_dom-b.js'] },
}
const sizes: Record<string, number> = { 'assets/cl-loader-a.js': 1000, 'assets/dom-b.js': 2000, 'assets/counter-c.js': 300, 'assets/copy-d.js': 200 }
const opts = { base: '/', chunks, size: (file: string) => sizes[file]! }

test('a page without islands ships no JavaScript', () => {
  const html = '<!doctype html><html><head><link rel="stylesheet" href="/site.css"></head><body><h1>Hi</h1></body></html>'
  expect(describeRoute('/about', html, opts)).toEqual({
    mode: 'static',
    html: 'about/index.html',
    loader: null,
    islands: [],
    js: { files: [], gzip: 0, initialGzip: 0 },
    css: ['/site.css'],
  })
})

test('islands are grouped by component and attach mode; shared chunks count once', () => {
  const html = '<body>' +
    '<cl-island c="counter" src="/assets/counter-c.js" p="{}"><button>0</button></cl-island>' +
    '<cl-island c="copy" src="/assets/copy-d.js" p="{}" a="interaction"><button>Copy</button></cl-island>' +
    '<cl-island c="copy" src="/assets/copy-d.js" p="{}" a="interaction"><button>Copy</button></cl-island>' +
    '<script type="module" src="/assets/cl-loader-a.js"></script></body>'
  const route = describeRoute('/', html, opts)
  expect(route.islands).toEqual([
    { component: 'counter', src: 'assets/counter-c.js', attach: 'load', count: 1, gzip: 300 },
    { component: 'copy', src: 'assets/copy-d.js', attach: 'interaction', count: 2, gzip: 200 },
  ])
  expect(route.js).toEqual({
    files: ['assets/cl-loader-a.js', 'assets/counter-c.js', 'assets/dom-b.js', 'assets/copy-d.js'],
    gzip: 3500, // every file once
    initialGzip: 3300, // loader + counter + the runtime it imports; copy loads on first use
  })
  expect(route.html).toBe('index.html')
})

test('a base path is stripped from URLs', () => {
  const html = '<cl-island c="counter" src="/docs/assets/counter-c.js" p="{}"></cl-island><script type="module" src="/docs/assets/cl-loader-a.js"></script>'
  const route = describeRoute('/', html, { ...opts, base: '/docs/' })
  expect(route.islands[0]!.src).toBe('assets/counter-c.js')
  expect(route.js.files).toEqual(['assets/cl-loader-a.js', 'assets/counter-c.js', 'assets/dom-b.js'])
})
