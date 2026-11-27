// #604: adapter 'cloudflare' writes a worker (dist/client/_worker.js/, Pages' advanced mode) calling the same fetch
// handler for server routes, _routes.json so static files are served first, and .assetsignore so the folder also works
// as a Worker's static assets. The worker runs under Miniflare (workerd) here, with ASSETS serving dist/client.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { Miniflare } from 'miniflare'
import { createBuilder } from 'vite'
import { afterAll, beforeAll, expect, test } from 'vitest'
import clarusjs from '../src/vite/plugin.ts'
import { unscoped } from './helpers.ts'

function site(files: Record<string, string>) {
  const root = mkdtempSync(resolve(tmpdir(), 'clarus-cloudflare-'))
  for (const [path, text] of Object.entries(files)) { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  return root
}
const quiet = { info() {}, warn() {}, warnOnce() {}, error() {}, clearScreen() {}, hasErrorLogged: () => false, hasWarned: false }

let root: string
let client: string
let mf: Miniflare
beforeAll(async () => {
  root = site({
    'src/pages/index.tscl': '<h1>Home</h1>',
    'src/pages/about.tscl': '<h1>About</h1>',
    'src/pages/account/[id].tscl': '@input id: string\n@input agent: string\n<h1>Account {{ id }}</h1>\n<p>{{ agent }}</p>',
    'src/pages/account/[id].load.ts': "export function load({ params, request }) { return { id: params.id, agent: request.headers.get('user-agent') } }",
    'src/pages/api/hello.ts': "export function GET({ request }) { return Response.json({ hello: new URL(request.url).searchParams.get('name'), greeting: process.env.GREETING }) }",
  })
  await (await createBuilder({ root, configFile: false, customLogger: quiet, plugins: [clarusjs({
    adapter: 'cloudflare', routes: { '/account/*': 'server' }, headers: { '/*': { 'X-Frame-Options': 'DENY' }, '/api/hello': { 'Cache-Control': 'no-store' } },
  })] })).buildApp()
  client = resolve(root, 'dist/client')
  // Static files from dist/client, as Cloudflare serves them (a page at <path>/index.html).
  const assets = (request: Request) => {
    const path = decodeURIComponent(new URL(request.url).pathname)
    for (const file of [path, `${path.replace(/\/?$/, '/')}index.html`]) {
      const at = resolve(client, `.${file}`)
      if (existsSync(at) && statSync(at).isFile()) return new Response(readFileSync(at), { headers: { 'content-type': at.endsWith('.html') ? 'text/html' : 'application/octet-stream' } })
    }
    return new Response('Not Found', { status: 404 })
  }
  mf = new Miniflare({
    modules: true,
    scriptPath: resolve(client, '_worker.js/index.js'),
    modulesRoot: resolve(client, '_worker.js'),
    modulesRules: [{ type: 'ESModule', include: ['**/*.js', '**/*.mjs'] }],
    compatibilityDate: '2025-09-01',
    compatibilityFlags: ['nodejs_compat'],
    bindings: { GREETING: 'from-cloudflare' },
    serviceBindings: { ASSETS: assets },
  })
}, 120_000)
afterAll(() => mf?.dispose())

test('the output: a worker folder, _routes.json naming the server routes, .assetsignore', () => {
  expect(existsSync(resolve(client, '_worker.js/index.js'))).toBe(true)
  expect(JSON.parse(readFileSync(resolve(client, '_routes.json'), 'utf8'))).toEqual({ version: 1, include: ['/account/*', '/api/hello', '/api/hello/'], exclude: [] })
  expect(readFileSync(resolve(client, '.assetsignore'), 'utf8')).toBe('_worker.js\n_routes.json\n')
})

test('server routes and endpoints run in workerd, with the _headers headers and process.env from the bindings', async () => {
  const page = await mf.dispatchFetch('https://site.example/account/7', { headers: { 'user-agent': 'workerd/1' } })
  expect(page.status).toBe(200)
  const html = unscoped(await page.text())
  expect(html).toContain('<h1>Account 7</h1>')
  expect(html).toContain('<p>workerd/1</p>')
  expect(page.headers.get('x-frame-options')).toBe('DENY')
  expect(page.headers.get('x-content-type-options')).toBe('nosniff')
  expect(await (await mf.dispatchFetch('https://site.example/api/hello?name=ada')).json()).toEqual({ hello: 'ada', greeting: 'from-cloudflare' })
  // The handler answers /api/hello/ as /api/hello: so do its headers.
  for (const path of ['/api/hello', '/api/hello/', '//api/hello', '/api/%68ello']) {
    const res = await mf.dispatchFetch(`https://site.example${path}`)
    if (res.status === 200) expect(res.headers.get('cache-control'), path).toBe('no-store')
  }
  // What decoding would turn into another path: refused (%2e%2e itself, URL parsing already resolves).
  for (const path of ['/api/..%2fhello', '/api%5chello']) expect((await mf.dispatchFetch(`https://site.example${path}`)).status, path).toBe(400)
})

test('anything else is a static file (the worker hands it to ASSETS)', async () => {
  expect(unscoped(await (await mf.dispatchFetch('https://site.example/about')).text())).toContain('<h1>About</h1>')
  expect((await mf.dispatchFetch('https://site.example/nope')).status).toBe(404)
})

test('without server routes: no worker', async () => {
  const plain = site({ 'src/pages/index.tscl': '<h1>Home</h1>' })
  await (await createBuilder({ root: plain, configFile: false, customLogger: quiet, plugins: [clarusjs({ adapter: 'cloudflare' })] })).buildApp()
  expect(existsSync(resolve(plain, 'dist/client/index.html'))).toBe(true)
  expect(existsSync(resolve(plain, 'dist/client/_worker.js'))).toBe(false)
  expect(existsSync(resolve(plain, 'dist/client/_routes.json'))).toBe(false)
}, 120_000)
