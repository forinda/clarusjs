// Regressions from the slice-1 branch review: non-ESM apps, base paths, a missing client manifest.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createBuilder, preview } from 'vite'
import { expect, onTestFinished, test } from 'vitest'
import clarusjs from '../src/vite/plugin.ts'
import { unscoped } from './helpers.ts'

const fixtures = resolve(import.meta.dirname, 'fixtures')

test('vite build works for an app whose package.json is not ESM', async () => {
  const root = resolve(fixtures, 'site-cjs')
  const builder = await createBuilder({ root, configFile: resolve(root, 'vite.config.ts'), logLevel: 'silent' })
  await builder.buildApp()
  const html = readFileSync(resolve(root, 'dist/client/index.html'), 'utf8')
  expect(unscoped(html)).toContain('<h1>CJS</h1>')
  expect(html).toMatch(/<cl-island c="counter" src="\/assets\//)
}, 120_000)

/** Copy the main fixture's src and public into a fresh temp app, built with an inline config. */
function tempApp() {
  const root = mkdtempSync(resolve(tmpdir(), 'clarusjs-base-'))
  cpSync(resolve(fixtures, 'site/src'), resolve(root, 'src'), { recursive: true })
  cpSync(resolve(fixtures, 'site/public'), resolve(root, 'public'), { recursive: true })
  // Like an app that installed clarusjs, so pages can import 'clarusjs/manifest'.
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  return root
}

test('with base /docs/, the build and vite preview both serve pages under the base', async () => {
  const root = tempApp()
  const config = { root, configFile: false as const, base: '/docs/', logLevel: 'silent' as const, plugins: [clarusjs()] }
  await (await createBuilder(config)).buildApp()
  const html = readFileSync(resolve(root, 'dist/client/index.html'), 'utf8')
  expect(html).toMatch(/<script type="module" src="\/docs\/assets\//)
  expect(html).toMatch(/<cl-island c="counter" src="\/docs\/assets\//)
  const server = await preview({ ...config, preview: { port: 0 } })
  try {
    const address = server.httpServer.address()
    const origin = `http://localhost:${typeof address === 'object' && address ? address.port : 0}`
    for (const path of ['/docs/', '/docs/about/team', '/docs/about/team/']) {
      const res = await fetch(origin + path)
      expect(res.status, path).toBe(200)
      expect(unscoped(await res.text()), path).toContain('<h1>')
    }
    expect((await fetch(`${origin}/docs/site.css`)).status).toBe(200)
  } finally {
    await server.close()
  }
}, 120_000)

test('a relative base is rejected with a clear error', async () => {
  const root = tempApp()
  await expect((async () => {
    await (await createBuilder({ root, configFile: false, base: './', logLevel: 'silent', plugins: [clarusjs()] })).buildApp()
  })()).rejects.toThrow(/relative base .* not supported/)
}, 120_000)

test('a server build without the client manifest fails instead of shipping dev URLs', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'clarusjs-nomanifest-'))
  const plugin = clarusjs() as any
  plugin.configResolved({ root, command: 'build', base: '/' })
  expect(existsSync(resolve(root, 'dist/client/.vite/manifest.json'))).toBe(false)
  expect(() => plugin.load.handler.call({}, '\0virtual:clarusjs/server-entry')).toThrow(/client manifest/)
})

test('building twice with the same builder uses the new island chunk and the new page HTML', async () => {
  const root = tempApp()
  const counterFile = resolve(root, 'src/components/counter.tscl')
  const builder = await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [clarusjs()] })
  await builder.buildApp()
  const first = readFileSync(resolve(root, 'dist/client/index.html'), 'utf8')
  // Change both the script (lands in the island chunk) and the static text (lands only in the page HTML).
  writeFileSync(counterFile, readFileSync(counterFile, 'utf8').replace('count * 2', 'count * 3').replace('Clicked', 'Pressed'))
  writeFileSync(resolve(root, 'src/pages/index.tscl'), readFileSync(resolve(root, 'src/pages/index.tscl'), 'utf8').replace('<h1>Home</h1>', '<h1>Home v2</h1>'))
  await builder.buildApp()
  const second = readFileSync(resolve(root, 'dist/client/index.html'), 'utf8')
  const src = (html: string) => html.match(/<cl-island c="counter" src="([^"]+)"/)![1]
  expect(src(second)).not.toBe(src(first))
  expect(existsSync(resolve(root, 'dist/client', src(second)!.slice(1)))).toBe(true)
  expect(unscoped(second)).toContain('<h1>Home v2</h1>')
  expect(second).toContain('Pressed')
}, 120_000)

test('#54: vite build --watch rebuilds a changed island with a fresh hash, and the page points at it', async () => {
  const root = tempApp()
  const counterFile = resolve(root, 'src/components/counter.tscl')
  const page = () => { try { return readFileSync(resolve(root, 'dist/client/index.html'), 'utf8') } catch { return '' } }
  const src = (html: string) => /<cl-island c="counter" src="([^"]+)"/.exec(html)?.[1]
  const builder = await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [clarusjs()], build: { watch: {} } })
  const watchers: { close(): Promise<void> }[] = []
  try {
    const result = (await builder.buildApp()) as unknown
    for (const w of [result].flat()) if (w && typeof (w as { close?: unknown }).close === 'function') watchers.push(w as { close(): Promise<void> })
    const own = (builder as unknown as { clarusjsWatcher?: { close(): Promise<void> } }).clarusjsWatcher
    expect(own).toBeTruthy() // the build watches
    watchers.push(own!)
    // The first build is written.
    for (let i = 0; i < 150 && !src(page()); i++) await new Promise((r) => setTimeout(r, 100))
    const first = src(page())
    expect(first).toBeTruthy()
    writeFileSync(counterFile, readFileSync(counterFile, 'utf8').replace('count * 2', 'count * 5'))
    let second: string | undefined
    for (let i = 0; i < 300 && (!second || second === first); i++) { await new Promise((r) => setTimeout(r, 100)); second = src(page()) }
    expect(second).not.toBe(first)
    expect(existsSync(resolve(root, 'dist/client', second!.slice(1)))).toBe(true)
    expect(readFileSync(resolve(root, 'dist/client', second!.slice(1)), 'utf8')).toMatch(/\*\s*5\b/) // the new code (minified)
  } finally {
    await Promise.all(watchers.map((w) => w.close().catch(() => {})))
  }
}, 120_000)

test('#94: a static page whose load() reads cookies fails the build, naming the route and the fix', async () => {
  const root = tempApp()
  writeFileSync(resolve(root, 'src/pages/me.tscl'), '@input theme: string = ""\n<p>{{ theme }}</p>\n')
  writeFileSync(resolve(root, 'src/pages/me.load.ts'), "export function load({ cookies }) { return { theme: cookies.get('theme') ?? 'light' } }\n")
  await expect((async () => (await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [clarusjs()] })).buildApp())()).rejects.toThrow(/\/me reads cookies, but static routes are built once for everyone: make it 'server'/)
}, 120_000)

test('#54: a project reached through a symlink (or a Windows short name) builds: islands and stylesheets are found', async () => {
  const real = tempApp()
  writeFileSync(resolve(real, 'src/pages/styled.tscl'), "@import '../styles/base.css'\n<h1>Styled</h1>\n")
  const link = resolve(tmpdir(), `clarusjs-link-${Date.now()}`)
  symlinkSync(real, link, 'junction')
  onTestFinished(() => rmSync(link, { force: true })) // the link only: the setup removes the temp app (#436)
  await (await createBuilder({ root: link, configFile: false, logLevel: 'silent', plugins: [clarusjs()] })).buildApp()
  const home = readFileSync(resolve(real, 'dist/client/index.html'), 'utf8')
  const src = /<cl-island c="counter" src="([^"]+)"/.exec(home)![1]!
  expect(existsSync(resolve(real, 'dist/client', src.slice(1)))).toBe(true)
  expect(readFileSync(resolve(real, 'dist/client/styled/index.html'), 'utf8')).toMatch(/<link rel="stylesheet" href="\/assets\/[^"]*base[^"]*\.css">/)
}, 120_000)

test('#97: component loaders run at build for the pages that use them (through other components too), islands included', async () => {
  const root = tempApp()
  const w = (file: string, text: string) => writeFileSync(resolve(root, file), text)
  w('src/components/latest.tscl', '@input version: string = "?"\n<p class="latest">Latest {{ version }}</p>\n')
  w('src/components/latest.load.ts', "export async function load() { await new Promise((r) => setTimeout(r, 20)); return { version: '1.2.3' } }\n")
  w('src/components/box.tscl', "@import latest from './latest.tscl'\n<section><latest /></section>\n")
  w('src/components/counter.load.ts', 'export function load() { return { start: 5 } }\n')
  w('src/pages/loaded.tscl', "@import box from '../components/box.tscl'\n@import counter from '../components/counter.tscl'\n<box />\n<counter />\n")
  await (await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [clarusjs()] })).buildApp()
  const html = unscoped(readFileSync(resolve(root, 'dist/client/loaded/index.html'), 'utf8'))
  expect(html).toContain('<p class="latest">Latest 1.2.3</p>')
  expect(html).toMatch(/<cl-island c="counter"[^>]*p="\{&quot;start&quot;:5\}"/) // the island's props carry the loaded input
  // The home page passes start="1" to its counter: the parent's prop wins over the loaded one.
  expect(unscoped(readFileSync(resolve(root, 'dist/client/index.html'), 'utf8'))).toMatch(/p="\{&quot;start&quot;:1\}"/)
}, 120_000)

test('vite preview resolves a page route that contains a dot', async () => {
  const root = tempApp()
  writeFileSync(resolve(root, 'src/pages/release.v1.tscl'), '<h1>Release 1</h1>')
  const config = { root, configFile: false as const, logLevel: 'silent' as const, plugins: [clarusjs()] }
  await (await createBuilder(config)).buildApp()
  const server = await preview({ ...config, preview: { port: 0 } })
  try {
    const address = server.httpServer.address()
    const origin = `http://localhost:${typeof address === 'object' && address ? address.port : 0}`
    const res = await fetch(`${origin}/release.v1`)
    expect(res.status).toBe(200)
    expect(unscoped(await res.text())).toContain('<h1>Release 1</h1>')
    expect((await fetch(`${origin}/site.css`)).status).toBe(200)
  } finally {
    await server.close()
  }
}, 120_000)
