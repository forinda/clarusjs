// #192: static redirects: `redirects: { '/old': '/new' }` works on any static host, in dev and on Netlify.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createBuilder, createServer } from 'vite'
import { expect, test } from 'vitest'
import clarusjs, { type ClarusOptions } from '../../src/vite/plugin.ts'

function site(pages: Record<string, string>) {
  const root = mkdtempSync(resolve(tmpdir(), 'clarus-redirects-'))
  for (const [path, text] of Object.entries(pages)) { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '../..'), resolve(root, 'node_modules/clarusjs'), 'dir')
  return root
}
const quiet = { info() {}, warn() {}, warnOnce() {}, error() {}, clearScreen() {}, hasErrorLogged: () => false, hasWarned: false }
async function build(root: string, options: ClarusOptions, base = '/') {
  await (await createBuilder({ root, base, configFile: false, customLogger: quiet, plugins: [clarusjs(options)] })).buildApp()
  return (path: string) => readFileSync(resolve(root, 'dist/client', path), 'utf8')
}

test('vite build: each redirect gets a page that sends visitors on, and a _redirects line for hosts that read it', async () => {
  const root = site({ 'src/pages/new.tscl': '<h1>New</h1>', 'src/pages/index.tscl': '<a href="/old">old link</a> <a href="/docs/">docs</a>' })
  const read = await build(root, { redirects: { '/old': '/new', '/docs': 'https://example.com/docs?a=1&b=2' } })
  const old = read('old/index.html')
  expect(old).toContain('<meta http-equiv="refresh" content="0; url=/new">')
  expect(old).toContain('<link rel="canonical" href="/new">')
  expect(old).toContain('<meta name="robots" content="noindex">')
  expect(old).toContain('<a href="/new">/new</a>')
  expect(read('docs/index.html')).toContain('url=https://example.com/docs?a=1&amp;b=2')
  // Old links still pass the link check (the build above didn't fail), and hosts with _redirects answer 301.
  expect(read('_redirects')).toBe('/old /new 301\n/docs https://example.com/docs?a=1&b=2 301\n')
}, 60_000)

test('vite build: redirect targets get the base; a _redirects in public/ keeps its lines first', async () => {
  const root = site({ 'src/pages/new.tscl': '<h1>New</h1>', 'public/_redirects': '/a /b 302\n' })
  const read = await build(root, { redirects: { '/old': '/new' } }, '/docs/')
  expect(read('old/index.html')).toContain('url=/docs/new')
  expect(read('_redirects')).toBe('/a /b 302\n/docs/old /docs/new 301\n')
}, 60_000)

test('a redirect from a path that is a page, or not starting with /, is a build error', async () => {
  const root = site({ 'src/pages/new.tscl': '<h1>New</h1>' })
  await expect(build(root, { redirects: { '/new': '/elsewhere' } })).rejects.toThrow("clarusjs: redirects['/new']: /new is a page; remove the page or the redirect")
  await expect(build(root, { redirects: { 'old': '/new' } })).rejects.toThrow("clarusjs: redirects['old']: paths start with /")
  expect(existsSync(resolve(root, 'dist/client/new/index.html'))).toBe(false)
}, 60_000)

test('dev server: a redirected path answers 301 with Location', async () => {
  const root = site({ 'src/pages/new.tscl': '<h1>New</h1>' })
  const server = await createServer({ root, configFile: false, logLevel: 'silent', server: { port: 0 }, plugins: [clarusjs({ redirects: { '/old': '/new' } })] })
  await server.listen()
  try {
    const res = await fetch(new URL('/old/?x=1', server.resolvedUrls!.local[0]!), { redirect: 'manual' })
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('/new')
  } finally {
    await server.close()
  }
}, 60_000)
