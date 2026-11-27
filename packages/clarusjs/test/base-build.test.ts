// Vite's base, end to end: an app built under /docs/ (pages, a client route, a page using h(), a public file, an
// island of links) has every root-relative URL under the base, and so does the dev server; a link outside the base
// is a warning, not an error.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createBuilder, createServer } from 'vite'
import { expect, test, vi } from 'vitest'
import clarusjs from '../src/vite/plugin.ts'

vi.setConfig({ testTimeout: 120_000 })

function app(files: Record<string, string>) {
  const root = mkdtempSync(resolve(tmpdir(), 'clarusjs-base-app-'))
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(resolve(root, path, '..'), { recursive: true })
    writeFileSync(resolve(root, path), text)
  }
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  return root
}
const files = {
  'public/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
  'src/components/links.tscl': `<script>
  let items = state([{ url: '/about' }])
</script>
<ul>@for (i of items; track i.url) { <li><a [href]="i.url">{{ i.url }}</a></li> }</ul>`,
  'src/pages/index.tscl': `@import links from '../components/links.tscl'
<html><head><title>Home</title><link rel="icon" href="/logo.svg"></head><body>
<a href="/about">About</a> <img src="/logo.svg" alt="Logo"> <a href="/app/one">App</a> <a href="/made">Made</a>
<links /></body></html>`,
  'src/pages/about.tscl': '<html><head><title>About</title></head><body><a href="/">Home</a></body></html>',
  'src/pages/app/one.tscl': '<html><head><title>App</title></head><body><a href="/about">Back</a></body></html>',
  'src/pages/made.tscl': '@input made: any\n<html><head><title>Made</title></head><body>{{ made }}</body></html>',
  'src/pages/made.load.ts': "import { h } from 'clarusjs/views'\nexport async function load() { return { made: await h('a', { href: '/about' }, ['by h()']) } }\n",
}
const routes = { '/app/*': 'client' as const }
const rootRelative = (html: string) => [...html.matchAll(/\s(?:href|src)="(\/[^/"][^"]*|\/)"/g)].map((m) => m[1]!)

test('built under /docs/: every root-relative link and file in the HTML is under the base', async () => {
  const root = app(files)
  await (await createBuilder({ root, configFile: false, base: '/docs/', logLevel: 'silent', plugins: [clarusjs({ routes })] })).buildApp()
  const out = resolve(root, 'dist/client')
  const pages = (readdirSync(out, { recursive: true }) as string[]).filter((f) => f.endsWith('.html'))
  expect(pages.length).toBeGreaterThan(2)
  for (const page of pages) {
    const outside = rootRelative(readFileSync(resolve(out, page), 'utf8')).filter((u) => !u.startsWith('/docs/'))
    expect(outside, page).toEqual([])
  }
  const index = readFileSync(resolve(out, 'index.html'), 'utf8')
  expect(index).toContain('href="/docs/about"')
  expect(index).toContain('src="/docs/logo.svg"')
  expect(index).toContain('href="/docs/logo.svg"')
  expect(readFileSync(resolve(out, 'made/index.html'), 'utf8')).toContain('<a href="/docs/about">by h()</a>')
  expect(readFileSync(resolve(out, 'logo.svg'), 'utf8')).toContain('<svg')
})

test('the dev server under /docs/ serves pages whose links are under the base', async () => {
  const root = app(files)
  const server = await createServer({ root, configFile: false, base: '/docs/', logLevel: 'silent', plugins: [clarusjs({ routes })], server: { port: 0 } })
  await server.listen()
  try {
    const address = server.httpServer!.address()
    const origin = `http://localhost:${typeof address === 'object' && address ? address.port : 0}`
    const html = await (await fetch(`${origin}/docs/`)).text()
    expect(html).toContain('href="/docs/about"')
    expect(html).toContain('src="/docs/logo.svg"')
  } finally {
    await server.close()
  }
})

test('a same-origin link outside the base is a warning, not a failed build', async () => {
  const root = app({ ...files, 'src/pages/about.tscl': '<html><head><title>About</title></head><body><a href="https://example.com/other-repo/">Sibling</a></body></html>' })
  const warnings: string[] = []
  const logger = { info() {}, warn: (m: string) => warnings.push(m), warnOnce() {}, error() {}, clearScreen() {}, hasErrorLogged: () => false, hasWarned: false }
  await (await createBuilder({ root, configFile: false, base: '/docs/', customLogger: logger, plugins: [clarusjs({ routes, site: { url: 'https://example.com' } })] })).buildApp()
  expect(warnings.some((w) => /other-repo.*outside the base/.test(w))).toBe(true)
})

test('a route that starts with the base itself is a warning: its links can\'t be told from the base\'s own', async () => {
  const root = app(files)
  const warnings: string[] = []
  const logger = { info() {}, warn: (m: string) => warnings.push(m), warnOnce() {}, error() {}, clearScreen() {}, hasErrorLogged: () => false, hasWarned: false }
  await (await createBuilder({ root, configFile: false, base: '/about/', customLogger: logger, plugins: [clarusjs({ routes })] })).buildApp()
  expect(warnings.some((w) => /route \/about starts with the base \/about\//.test(w))).toBe(true)
})
