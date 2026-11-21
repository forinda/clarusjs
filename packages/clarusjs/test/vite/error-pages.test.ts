// #196: the dev server shows a failing page's error with its stack; a build writes 500.html next to 404.html.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createBuilder, createServer } from 'vite'
import { expect, test } from 'vitest'
import clarusjs from '../../src/vite/plugin.ts'

function site(pages: Record<string, string>) {
  const root = mkdtempSync(resolve(tmpdir(), 'clarus-errors-'))
  for (const [path, text] of Object.entries(pages)) { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '../..'), resolve(root, 'node_modules/clarusjs'), 'dir')
  return root
}
const errorPage = '@input status: number = 500\n<html><head><title>Error</title></head><body><h1>Broken ({{ status }})</h1><a href="/">Home</a></body></html>\n'

test('dev server: a page whose load() throws shows the error itself, with status 500', async () => {
  const root = site({ 'src/pages/index.tscl': '<p>x</p>', 'src/pages/index.load.ts': "export function load() { throw new Error('db is down') }\n", 'src/pages/500.tscl': errorPage })
  const server = await createServer({ root, configFile: false, logLevel: 'silent', server: { port: 0 }, plugins: [clarusjs()] })
  await server.listen()
  try {
    const res = await fetch(new URL('/', server.resolvedUrls!.local[0]!), { headers: { accept: 'text/html' } })
    expect(res.status).toBe(500)
    const body = await res.text()
    expect(body).toContain('db is down')
    expect(body).not.toContain('Broken (500)') // the 500 page is for visitors; development shows the error
  } finally {
    await server.close()
  }
}, 60_000)

test('vite build: the 500 page is also written as 500.html, with links from the site root, and left out of the sitemap', async () => {
  const root = site({ 'src/pages/index.tscl': '<p>x</p>', 'src/pages/500.tscl': errorPage })
  const quiet = { info() {}, warn() {}, warnOnce() {}, error() {}, clearScreen() {}, hasErrorLogged: () => false, hasWarned: false }
  await (await createBuilder({ root, configFile: false, customLogger: quiet, plugins: [clarusjs({ site: { url: 'https://example.com' } })] })).buildApp()
  const html = readFileSync(resolve(root, 'dist/client/500.html'), 'utf8')
  expect(html).toContain('<h1>Broken (500)</h1>')
  expect(existsSync(resolve(root, 'dist/client/500/index.html'))).toBe(true)
  expect(readFileSync(resolve(root, 'dist/client/sitemap.xml'), 'utf8')).not.toContain('/500') // an error page, not content
}, 60_000)
