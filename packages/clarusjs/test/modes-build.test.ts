// #29: a build with server routes: static routes are files, server routes render per request from dist/server.
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createBuilder, preview } from 'vite'
import { beforeAll, expect, test } from 'vitest'

const root = resolve(import.meta.dirname, 'fixtures/site-modes')
beforeAll(async () => {
  rmSync(resolve(root, 'dist'), { recursive: true, force: true })
  await (await createBuilder({ root, configFile: resolve(root, 'vite.config.ts'), logLevel: 'silent' })).buildApp()
}, 120_000)

test('static routes are prerendered; server routes are not', () => {
  expect(existsSync(resolve(root, 'dist/client/index.html'))).toBe(true)
  expect(existsSync(resolve(root, 'dist/client/account'))).toBe(false)
})

test('the built handler renders a server route per request, with load() reading the request', async () => {
  const { default: handler } = await import(`${pathToFileURL(resolve(root, 'dist/server/index.mjs')).href}?t=${Date.now()}`)
  const res = await handler.fetch(new Request('http://x/account/7', { headers: { 'user-agent': 'probe/1' } }))
  expect(res.status).toBe(200)
  const html = await res.text()
  expect(html).toContain('<h1>Account 7</h1>')
  expect(html).toContain('<p>probe/1</p>')
})

test('the manifest records each route\'s mode', () => {
  const manifest = JSON.parse(readFileSync(resolve(root, 'dist/clarusjs-manifest.json'), 'utf8'))
  expect(manifest.routes['/'].mode).toBe('static')
  expect(manifest.routes['/account/[id]']).toEqual({ mode: 'server', html: null, loader: 'request', islands: [], js: { files: [], gzip: 0, initialGzip: 0 }, css: [] })
})

test('vite preview serves server routes through the built handler', async () => {
  const server = await preview({ root, configFile: resolve(root, 'vite.config.ts'), logLevel: 'silent', preview: { port: 0 } })
  try {
    const { port } = server.httpServer.address() as { port: number }
    const res = await fetch(`http://localhost:${port}/account/9`, { headers: { 'user-agent': 'preview/1' } })
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('<p>preview/1</p>')
    expect(await (await fetch(`http://localhost:${port}/`)).text()).toContain('<h1>Home</h1>')
    expect((await fetch(`http://localhost:${port}/nope`)).status).toBe(404)
    // A static dynamic route only has the pages its entries() listed, as on a static host.
    expect(await (await fetch(`http://localhost:${port}/blog/hello`)).text()).toContain('<h1>Post hello</h1>')
    expect((await fetch(`http://localhost:${port}/blog/other`)).status).toBe(404)
    expect((await fetch(`http://localhost:${port}/account/%E0%A4%A`)).status).toBe(404) // malformed escape: not a crash
  } finally {
    await server.close()
  }
})
