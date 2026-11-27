// #600: `clarusjs serve` / serve() from clarusjs/node runs a built site on any Node host: files with cache headers,
// server routes through the built handler, the headers the build wrote to _headers, and the 404 page.
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { get } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createBuilder, preview } from 'vite'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { serve } from '../../src/node/serve.ts'
import { headersFor, parseHeaders } from '../../src/vite/headers.ts'
import clarusjs, { type ClarusOptions } from '../../src/vite/plugin.ts'
import { unscoped } from '../helpers.ts'

function site(pages: Record<string, string>) {
  const root = mkdtempSync(resolve(tmpdir(), 'clarus-serve-'))
  for (const [path, text] of Object.entries(pages)) { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '../..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  return root
}
const quiet = { info() {}, warn() {}, warnOnce() {}, error() {}, clearScreen() {}, hasErrorLogged: () => false, hasWarned: false }
async function build(root: string, options: ClarusOptions, base = '/') {
  await (await createBuilder({ root, base, configFile: false, customLogger: quiet, plugins: [clarusjs(options)] })).buildApp()
}
const pages = {
  'src/pages/index.tscl': '<h1>Home</h1>\n<script>let n = state(0)</script>\n<button (click)="n++">{{ n }}</button>',
  'src/pages/time.tscl': '<h1>Rendered per request</h1>',
  'src/pages/api/ping.ts': "export function GET() { return Response.json({ pong: true }, { headers: { 'x-from': 'endpoint' } }) }",
  'src/pages/404.tscl': '<h1>Nothing here</h1>',
  'public/notes.txt': 'plain text',
}

describe('serve(): a built site', () => {
  let root: string
  let url: (path: string) => string
  let close: () => Promise<void>
  beforeAll(async () => {
    root = site(pages)
    await build(root, { routes: { '/time': 'server' }, compress: true, headers: { '/*': { 'X-Frame-Options': 'DENY' }, '/api/*': { 'Cache-Control': 'no-store' }, '/notes.txt': { 'X-Robots-Tag': 'noindex' }, '/time': { 'X-Rendered': 'per-request' } } })
    const server = await serve({ root, port: 0, host: '127.0.0.1' })
    const { port } = server.address() as AddressInfo
    url = (path) => `http://127.0.0.1:${port}${path}`
    close = () => new Promise((done) => server.close(() => done()))
  }, 120_000)
  afterAll(() => close?.())

  test('a page: HTML, revalidated (no-cache with an ETag), with the default and configured headers', async () => {
    const res = await fetch(url('/'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(res.headers.get('cache-control')).toBe('no-cache')
    expect(res.headers.get('etag')).toMatch(/^W\/".+"$/)
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
    expect(res.headers.get('x-frame-options')).toBe('DENY')
    expect(unscoped(await res.text())).toContain('<h1>Home</h1>')
    // Same ETag again: 304, no body.
    const again = await fetch(url('/'), { headers: { 'if-none-match': res.headers.get('etag')! } })
    expect(again.status).toBe(304)
    expect(await again.text()).toBe('')
  })

  test('hashed assets are immutable; precompressed copies answer when the client accepts them', async () => {
    const asset = readdirSync(resolve(root, 'dist/client/assets')).find((f) => f.endsWith('.js'))!
    const res = await fetch(url(`/assets/${asset}`), { headers: { 'accept-encoding': 'br' } })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/javascript; charset=utf-8')
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(res.headers.get('vary')).toBe('Accept-Encoding')
    expect(res.headers.get('content-encoding')).toBe('br')
    // fetch decodes it: the same text as the file.
    expect(await res.text()).toBe(readFileSync(resolve(root, 'dist/client/assets', asset), 'utf8'))
    const plain = await fetch(url('/notes.txt'), { headers: { 'accept-encoding': 'identity' } })
    expect(plain.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(plain.headers.get('content-encoding')).toBe(null)
    expect(await plain.text()).toBe('plain text')
  })

  test('a path written another way (//, ..) gets the headers of the file it serves', async () => {
    // fetch() normalizes dot segments; a raw request doesn't.
    const raw = (path: string) => new Promise<import('node:http').IncomingMessage>((done, fail) => get(url(path), done).on('error', fail))
    for (const path of ['//notes.txt', '/assets/../notes.txt', '/a/%2e%2e/notes.txt']) {
      const res = await raw(path)
      res.resume()
      expect(res.statusCode, path).toBe(200)
      expect(res.headers['x-robots-tag'], path).toBe('noindex')
    }
  })

  test('a server route written another way reaches the handler as the path it was checked as, with its headers', async () => {
    const raw = (path: string) => new Promise<{ status?: number; headers: import('node:http').IncomingHttpHeaders; body: string }>((done, fail) => get(url(path), (res) => {
      let body = ''
      res.on('data', (c) => (body += c)).on('end', () => done({ status: res.statusCode, headers: res.headers, body }))
    }).on('error', fail))
    for (const path of ['//api/ping', '/x/../api/ping', '/api/%2e/ping']) {
      const res = await raw(path)
      expect(res.status, path).toBe(200)
      expect(JSON.parse(res.body), path).toEqual({ pong: true })
      expect(res.headers['cache-control'], path).toBe('no-store')
    }
    // Encoded slashes that would make a different path once decoded: refused, not guessed at.
    expect((await raw('/x/..%2fapi/ping')).status).toBe(400)
  })

  test('server routes and endpoints go to the built handler, with the configured headers', async () => {
    const page = await fetch(url('/time'))
    expect(page.status).toBe(200)
    expect(unscoped(await page.text())).toContain('<h1>Rendered per request</h1>')
    expect(page.headers.get('x-frame-options')).toBe('DENY')
    // A rule's headers on its path's slash form too, which is answered the same.
    for (const path of ['/time', '/time/']) expect((await fetch(url(path))).headers.get('x-rendered'), path).toBe('per-request')
    const api = await fetch(url('/api/ping'))
    expect(await api.json()).toEqual({ pong: true })
    expect(api.headers.get('x-from')).toBe('endpoint')
    expect(api.headers.get('cache-control')).toBe('no-store')
  })

  test('anything else: the 404 page with status 404; HEAD has no body; a bad escape is 400; nothing outside dist/client', async () => {
    const res = await fetch(url('/missing'))
    expect(res.status).toBe(404)
    expect(await res.text()).toContain('Nothing here')
    const head = await fetch(url('/'), { method: 'HEAD' })
    expect(head.status).toBe(200)
    expect(await head.text()).toBe('')
    expect((await fetch(url('/%E0%A4%A'))).status).toBe(400)
    // Host files in any case: Windows and macOS file systems ignore it.
    for (const path of ['/%2e%2e/package.json', '/_headers', '/_HEADERS', '/_Headers', '/_worker.js/index.js', '/_WORKER.JS/index.js', '/_routes.json']) expect((await fetch(url(path))).status, path).toBe(404)
    expect((await fetch(url('/..%2fpackage.json'))).status).toBe(400)
  })
})

test('serve(): under a base, pages answer at it and nothing outside it', async () => {
  const root = site({ 'src/pages/index.tscl': '<h1>Docs home</h1>', 'src/pages/guide.tscl': '<h1>Guide</h1>' })
  await build(root, {}, '/docs/')
  const server = await serve({ root, port: 0, host: '127.0.0.1' })
  const { port } = server.address() as AddressInfo
  try {
    expect(await (await fetch(`http://127.0.0.1:${port}/docs/`)).text()).toContain('Docs home')
    expect(await (await fetch(`http://127.0.0.1:${port}/docs/guide`)).text()).toContain('Guide')
    expect((await fetch(`http://127.0.0.1:${port}/guide`)).status).toBe(404)
    // The base as sent, not decoded: /%64ocs/ isn't /docs/.
    expect((await fetch(`http://127.0.0.1:${port}/%64ocs/guide`)).status).toBe(404)
  } finally {
    await new Promise((done) => server.close(done))
  }
}, 120_000)

test('serve(): without a build, a clear error', async () => {
  await expect(serve({ root: mkdtempSync(resolve(tmpdir(), 'clarus-serve-empty-')), port: 0 })).rejects.toThrow(/no .*dist[\\/]client.*run vite build first/)
})

test('vite build writes _headers (after public/_headers, base-prefixed); headers: false writes none; bad input fails', async () => {
  const root = site({ 'src/pages/index.tscl': '<h1>Home</h1>', 'public/_headers': '/old/*\n  X-Robots-Tag: noindex\n' })
  await build(root, { headers: { '/blog/:slug': { 'X-Frame-Options': 'SAMEORIGIN' } } }, '/docs/')
  expect(readFileSync(resolve(root, 'dist/client/_headers'), 'utf8')).toBe(
    '/old/*\n  X-Robots-Tag: noindex\n' +
    '/docs/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n' +
    '/docs/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n' +
    '/docs/blog/:slug\n  X-Frame-Options: SAMEORIGIN\n',
  )
  const none = site({ 'src/pages/index.tscl': '<h1>Home</h1>' })
  await build(none, { headers: false })
  expect(readdirSync(resolve(none, 'dist/client'))).not.toContain('_headers')
  await expect(build(none, { headers: { 'blog/*': { 'X-A': 'b' } } })).rejects.toThrow("clarusjs: headers['blog/*']: patterns start with /")
  await expect(build(none, { headers: { '/*': { 'X-A': 'b\nX-B: c' } } })).rejects.toThrow("clarusjs: headers['/*']['X-A']: names and values are one line")
}, 120_000)

test('vite preview sends the _headers headers too', async () => {
  const root = site({ 'src/pages/index.tscl': '<h1>Home</h1>' })
  await build(root, { headers: { '/*': { 'X-Frame-Options': 'DENY' } } })
  const server = await preview({ root, configFile: false, logLevel: 'silent', preview: { port: 0 }, plugins: [clarusjs({ headers: { '/*': { 'X-Frame-Options': 'DENY' } } })] })
  try {
    const res = await fetch(server.resolvedUrls!.local[0]!)
    expect(res.headers.get('x-frame-options')).toBe('DENY')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
  } finally {
    await server.close()
  }
}, 120_000)

test('header rules ignore case, as the file systems that serve /ADMIN/x as admin/x do', () => {
  const rules = parseHeaders('/admin/*\n  X-Robots-Tag: noindex\n')
  expect(headersFor(rules, '/ADMIN/secret.html').get('x-robots-tag')).toBe('noindex')
})

test('serve(): an absolute base (a CDN URL) serves pages at its path', async () => {
  const root = site({ 'src/pages/index.tscl': '<h1>Docs home</h1>' })
  await build(root, {}, 'https://cdn.example.com/docs/')
  const server = await serve({ root, port: 0, host: '127.0.0.1' })
  const { port } = server.address() as AddressInfo
  try {
    expect(await (await fetch(`http://127.0.0.1:${port}/docs/`)).text()).toContain('Docs home')
  } finally {
    await new Promise((done) => server.close(done))
  }
}, 120_000)

test('serve(): a streamed response is sent as it comes (an open event stream), and an unreadable file is a 500, not a crash', async () => {
  const root = site({
    'src/pages/index.tscl': '<h1>Home</h1>',
    'src/pages/api/events.ts': `export function GET() {
  let n = 0
  const body = new ReadableStream({ pull(c) { if (n++ === 0) c.enqueue(new TextEncoder().encode('data: first\\n\\n')); else return new Promise(() => {}) } })
  return new Response(body, { headers: { 'content-type': 'text/event-stream' } })
}`,
    'public/secret.txt': 'x',
  })
  await build(root, {})
  const server = await serve({ root, port: 0, host: '127.0.0.1' })
  const { port } = server.address() as AddressInfo
  try {
    // The stream never ends: the first event arrives anyway.
    const controller = new AbortController()
    const res = await fetch(`http://127.0.0.1:${port}/api/events`, { signal: controller.signal })
    const { value } = await res.body!.getReader().read()
    expect(new TextDecoder().decode(value)).toBe('data: first\n\n')
    controller.abort()
    if (process.platform !== 'win32' && process.getuid?.() !== 0) {
      chmodSync(resolve(root, 'dist/client/secret.txt'), 0o000)
      expect((await fetch(`http://127.0.0.1:${port}/secret.txt`).catch(() => ({ status: 0 }))).status).toBe(500)
      // Still serving.
      expect((await fetch(`http://127.0.0.1:${port}/`)).status).toBe(200)
    }
  } finally {
    server.closeAllConnections()
    await new Promise((done) => server.close(done))
  }
}, 120_000)

test('serve(): a response setting several cookies sends every Set-Cookie header', async () => {
  const root = site({
    'src/pages/index.tscl': '<h1>Home</h1>',
    'src/pages/api/login.ts': `export function GET() {
  const headers = new Headers()
  headers.append('set-cookie', 'session=abc; HttpOnly; Path=/')
  headers.append('set-cookie', 'theme=dark; Path=/')
  return new Response('ok', { headers })
}`,
  })
  await build(root, {})
  const server = await serve({ root, port: 0, host: '127.0.0.1' })
  const { port } = server.address() as AddressInfo
  try {
    const cookies = await new Promise<string[] | undefined>((done, fail) => get(`http://127.0.0.1:${port}/api/login`, (res) => { res.resume(); done(res.headers['set-cookie']) }).on('error', fail))
    expect(cookies).toEqual(['session=abc; HttpOnly; Path=/', 'theme=dark; Path=/'])
  } finally {
    await new Promise((done) => server.close(done))
  }
}, 120_000)
