// #161: components imported from a package work like components in src/: islands get chunks, styles are bundled.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createBuilder, createServer } from 'vite'
import { beforeAll, expect, test } from 'vitest'
import clarusjs from '../../src/vite/plugin.ts'

let root = ''
const w = (path: string, text: string) => { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }

beforeAll(() => {
  root = mkdtempSync(resolve(tmpdir(), 'clarus-pkg-'))
  // A published package: a real folder in node_modules (not a workspace link), shipping .tscl files.
  w('node_modules/fake-theme/package.json', JSON.stringify({ name: 'fake-theme', version: '1.0.0', type: 'module', exports: { './*': './*' } }))
  w('node_modules/fake-theme/frame.css', '.frame { padding: 7px; }\n')
  w('node_modules/fake-theme/frame.tscl', "@import toggle from './toggle.tscl'\n@import './frame.css'\n<div class=\"frame\"><toggle /><slot /></div>\n<style scoped>\n  :scope { border: 2px solid teal; }\n</style>\n")
  w('node_modules/fake-theme/toggle.tscl', "<script>\n  let on = state(false)\n</script>\n<button (click)=\"on = !on\">{{ on ? 'on' : 'off' }}</button>\n<style scoped>\n  :scope { color: crimson; }\n</style>\n")
  w('src/pages/index.tscl', "@import frame from 'fake-theme/frame.tscl'\n<frame><h1>Hi</h1></frame>\n")
  symlinkSync(resolve(import.meta.dirname, '../..'), resolve(root, 'node_modules/clarusjs'), 'junction')
})

test('build: the package island gets a chunk the page points at, and package styles are bundled', async () => {
  await (await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [clarusjs()] })).buildApp()
  const html = readFileSync(resolve(root, 'dist/client/index.html'), 'utf8')
  const src = /<cl-island c="toggle" src="([^"]+)"/.exec(html)?.[1]
  expect(src).toMatch(/^\/assets\/.+\.js$/)
  expect(existsSync(resolve(root, 'dist/client', src!.slice(1)))).toBe(true)
  expect(html).toContain('<h1>Hi</h1>')
  const assets = resolve(root, 'dist/client/assets')
  const css = (readdirSync(assets) as string[]).filter((f) => f.startsWith('cl-styles')).map((f) => readFileSync(resolve(assets, f), 'utf8')).join('')
  expect(css).toMatch(/border:2px solid teal/)
  expect(css).toMatch(/color:(crimson|#dc143c)/)
  // The package component's own stylesheet (@import './frame.css') is linked by the page that uses it.
  const links = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]!)
  const linked = links.map((href) => readFileSync(resolve(root, 'dist/client', href.slice(1)), 'utf8')).join('')
  expect(linked).toContain('padding:7px')
}, 120_000)

test('dev: the page renders, and the package island\'s module is served', async () => {
  const server = await createServer({ root, configFile: false, logLevel: 'silent', server: { port: 0 }, plugins: [clarusjs()] })
  await server.listen()
  try {
    const base = server.resolvedUrls!.local[0]!
    const html = await (await fetch(base)).text()
    const src = /<cl-island c="toggle" src="([^"]+)"/.exec(html)?.[1]
    expect(src).toBeDefined()
    const mod = await fetch(new URL(src!, base))
    expect(mod.status).toBe(200)
    expect(await mod.text()).toContain('export function attach')
  } finally {
    await server.close()
  }
}, 60_000)

test('packageOf: the package from the last node_modules segment (pnpm layout, scoped names)', async () => {
  const { packageOf } = await import('../../src/vite/plugin.ts')
  expect(packageOf('/app/node_modules/.pnpm/@clarusjs+theme-docs@1.0.0/node_modules/@clarusjs/theme-docs/layout.tscl')).toBe('@clarusjs/theme-docs')
  expect(packageOf('/app/node_modules/fake-theme/frame.tscl')).toBe('fake-theme')
  expect(packageOf('/app/src/pages/index.tscl')).toBeUndefined()
})
