// #603: adapter 'vercel' writes the Build Output API (.vercel/output): static files, one Node function running the same
// fetch handler for server routes, and config.json routes. Checked against a small emulation of Vercel's routing
// (phases: routes before the filesystem, the filesystem with overrides, routes after it, then the error phase).
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createBuilder } from 'vite'
import { beforeAll, expect, test } from 'vitest'
import clarusjs from '../src/vite/plugin.ts'
import { unscoped } from './helpers.ts'

function site(files: Record<string, string>) {
  const root = mkdtempSync(resolve(tmpdir(), 'clarus-vercel-'))
  for (const [path, text] of Object.entries(files)) { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  return root
}
const quiet = { info() {}, warn() {}, warnOnce() {}, error() {}, clearScreen() {}, hasErrorLogged: () => false, hasWarned: false }

type Route = { src?: string; dest?: string; headers?: Record<string, string>; status?: number; continue?: boolean; handle?: string }
type Fn = { default: { fetch(r: Request): Promise<Response> } }

/** Vercel's routing, as the Build Output API documents it, enough for these routes. */
async function emulate(output: string, fn: Fn | undefined, url: string): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  const config = JSON.parse(readFileSync(resolve(output, 'config.json'), 'utf8')) as { routes: Route[]; overrides?: Record<string, { path: string }> }
  const byPath = new Map(Object.entries(config.overrides ?? {}).map(([file, o]) => [`/${o.path}`, file]))
  const headers: Record<string, string> = {}
  let { pathname, search } = new URL(url)
  let phase: string | undefined
  // An override serves its file at its path, and only there; any other file at its own path.
  const renamed = new Set(byPath.values())
  const file = (path: string) => {
    const name = byPath.get(path) ?? (renamed.has(path.slice(1)) ? undefined : path.slice(1))
    const at = name === undefined ? undefined : resolve(output, 'static', name)
    return at && existsSync(at) && statSync(at).isFile() ? at : undefined
  }
  for (const route of config.routes) {
    if (route.handle) {
      phase = route.handle
      if (phase === 'filesystem') { const f = file(pathname); if (f) return { status: 200, headers, body: readFileSync(f, 'utf8') } }
      if (phase === 'error') break
      continue
    }
    const m = new RegExp(route.src!).exec(pathname)
    if (!m) continue
    Object.assign(headers, route.headers ?? {})
    if (route.status && route.headers?.Location) return { status: route.status, headers, body: '' }
    if (route.dest) {
      const dest = new URL(route.dest.replace(/\$(\d)/g, (_, i: string) => m[Number(i)] ?? ''), 'https://site.example')
      if (phase === 'filesystem' && dest.pathname === '/clarusjs-server' && fn) {
        // A function gets the URL as requested, not the rewrite's (SvelteKit's catch-all function routes by it).
        const res = await fn.default.fetch(new Request(url, { headers: { 'user-agent': 'vercel/1' } }))
        return { status: res.status, headers: { ...headers, ...Object.fromEntries(res.headers) }, body: await res.text() }
      }
      pathname = dest.pathname
      if (dest.search) search = dest.search
      // Without continue, a rewrite ends routing: the file at its destination, or nothing.
      if (!route.continue) {
        const f = file(pathname)
        return f ? { status: 200, headers, body: readFileSync(f, 'utf8') } : { status: 404, headers, body: '' }
      }
    }
  }
  // The error phase: its route with a status and a static dest.
  const error = config.routes.slice(config.routes.findIndex((r) => r.handle === 'error') + 1).find((r) => r.status)
  return { status: error?.status ?? 404, headers, body: error?.dest ? readFileSync(resolve(output, 'static', error.dest.slice(1)), 'utf8') : '' }
}

let root: string
let output: string
let fn: Fn
let functionDir: string
beforeAll(async () => {
  root = site({
    'src/pages/index.tscl': '<h1>Home</h1>',
    'src/pages/about.tscl': '<h1>About</h1>',
    'src/pages/404.tscl': '<h1>Nothing here</h1>',
    'src/pages/account/[id].tscl': '@input id: string\n@input agent: string\n<h1>Account {{ id }}</h1>\n<p>{{ agent }}</p>',
    'src/pages/account/[id].load.ts': "export function load({ params, request }) { return { id: params.id, agent: request.headers.get('user-agent') } }",
    'src/pages/api/hello.ts': "export function GET({ request }) { return Response.json({ hello: new URL(request.url).searchParams.get('name') }) }",
  })
  await (await createBuilder({ root, configFile: false, customLogger: quiet, plugins: [clarusjs({
    adapter: 'vercel', routes: { '/account/*': 'server' }, redirects: { '/old': '/about' }, headers: { '/*': { 'X-Frame-Options': 'DENY' }, '/about': { 'X-Robots-Tag': 'noindex' } },
  })] })).buildApp()
  output = resolve(root, '.vercel/output')
  // The function on its own, away from the app's node_modules: as Vercel runs it, nothing to install.
  const alone = mkdtempSync(resolve(tmpdir(), 'clarus-vercel-fn-'))
  cpSync(resolve(output, 'functions/clarusjs-server.func'), alone, { recursive: true })
  fn = await import(pathToFileURL(resolve(alone, 'index.mjs')).href)
  functionDir = alone
}, 120_000)

test('the output: config.json version 3, static files, and one self-contained Node function', () => {
  const config = JSON.parse(readFileSync(resolve(output, 'config.json'), 'utf8'))
  expect(config.version).toBe(3)
  expect(config.overrides['about/index.html']).toEqual({ path: 'about' })
  expect(existsSync(resolve(output, 'static/index.html'))).toBe(true)
  expect(existsSync(resolve(output, 'static/_headers'))).toBe(false) // turned into routes
  expect(existsSync(resolve(output, 'static/.vite'))).toBe(false) // the build's manifest isn't part of the site
  const func = resolve(output, 'functions/clarusjs-server.func')
  expect(JSON.parse(readFileSync(resolve(func, '.vc-config.json'), 'utf8'))).toEqual({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', supportsResponseStreaming: true })
  expect(JSON.parse(readFileSync(resolve(func, 'package.json'), 'utf8'))).toEqual({ type: 'module' })
  // Bundled: no import of an installed package is left.
  const code = readdirSync(func, { recursive: true }).map(String).filter((f) => f.endsWith('.mjs') || f.endsWith('.js')).map((f) => readFileSync(resolve(func, f), 'utf8')).join('\n')
  expect(code).not.toMatch(/^\s*(?:import|export)\b[^;'"]*?from\s*["'](?!node:|\.)[^"']+["']/m)
  expect(code).not.toMatch(/\bimport\(\s*["'](?!node:|\.)/)
  // Run by Node itself (vitest resolves imports its own way), from a folder with no node_modules above it.
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', "const { default: f } = await import('./index.mjs'); const r = await f.fetch(new Request('https://x/account/5')); console.log(r.status, (await r.text()).includes('Account 5'))"], { cwd: functionDir, encoding: 'utf8' })
  expect(run.stderr).toBe('')
  expect(run.stdout.trim()).toBe('200 true')
})

test('routes: static pages (with and without the slash), redirects, headers, server routes and endpoints, 404', async () => {
  const home = await emulate(output, fn, 'https://site.example/')
  expect(unscoped(home.body)).toContain('<h1>Home</h1>')
  expect(home.headers['X-Frame-Options']).toBe('DENY')
  expect(home.headers['X-Content-Type-Options']).toBe('nosniff')
  for (const path of ['/about', '/about/']) {
    const about = await emulate(output, fn, `https://site.example${path}`)
    expect(unscoped(about.body), path).toContain('<h1>About</h1>')
    // A rule's headers on both forms of its path, as the slash form is rewritten after them.
    expect(about.headers['X-Robots-Tag'], path).toBe('noindex')
  }
  const moved = await emulate(output, fn, 'https://site.example/old')
  expect(moved.status).toBe(301)
  expect(moved.headers.Location).toBe('/about')
  // A server route with the slash: the slash rewrite continues to the function's route.
  expect(unscoped((await emulate(output, fn, 'https://site.example/account/8/')).body)).toContain('<h1>Account 8</h1>')
  const account = await emulate(output, fn, 'https://site.example/account/7')
  expect(account.status).toBe(200)
  expect(unscoped(account.body)).toContain('<h1>Account 7</h1>')
  expect(unscoped(account.body)).toContain('<p>vercel/1</p>')
  expect(account.headers['X-Frame-Options']).toBe('DENY')
  expect(JSON.parse((await emulate(output, fn, 'https://site.example/api/hello?name=ada')).body)).toEqual({ hello: 'ada' })
  const missing = await emulate(output, fn, 'https://site.example/nope')
  expect(missing.status).toBe(404)
  expect(missing.body).toContain('Nothing here')
})

test('without server routes: static output and routes only, no function', async () => {
  const plain = site({ 'src/pages/index.tscl': '<h1>Home</h1>' })
  await (await createBuilder({ root: plain, configFile: false, customLogger: quiet, plugins: [clarusjs({ adapter: 'vercel' })] })).buildApp()
  expect(existsSync(resolve(plain, '.vercel/output/static/index.html'))).toBe(true)
  expect(existsSync(resolve(plain, '.vercel/output/functions'))).toBe(false)
  expect(JSON.parse(readFileSync(resolve(plain, '.vercel/output/config.json'), 'utf8')).routes.some((r: Route) => r.dest === '/clarusjs-server')).toBe(false)
}, 120_000)

test('under a base: static files and clean URLs under it', async () => {
  const docs = site({ 'src/pages/index.tscl': '<h1>Docs</h1>', 'src/pages/guide.tscl': '<h1>Guide</h1>' })
  await (await createBuilder({ root: docs, base: '/docs/', configFile: false, customLogger: quiet, plugins: [clarusjs({ adapter: 'vercel' })] })).buildApp()
  const out = resolve(docs, '.vercel/output')
  expect(JSON.parse(readFileSync(resolve(out, 'config.json'), 'utf8')).overrides).toEqual({ 'docs/index.html': { path: 'docs' }, 'docs/guide/index.html': { path: 'docs/guide' } })
  for (const path of ['/docs', '/docs/', '/docs/guide/']) expect((await emulate(out, undefined, `https://site.example${path}`)).status, path).toBe(200)
}, 120_000)

test('an absolute base (a CDN URL): static files and routes under its path', async () => {
  const cdn = site({ 'src/pages/index.tscl': '<h1>Docs</h1>' })
  await (await createBuilder({ root: cdn, base: 'https://cdn.example/docs/', configFile: false, customLogger: quiet, plugins: [clarusjs({ adapter: 'vercel' })] })).buildApp()
  const out = resolve(cdn, '.vercel/output')
  expect(JSON.parse(readFileSync(resolve(out, 'config.json'), 'utf8')).overrides).toEqual({ 'docs/index.html': { path: 'docs' } })
  expect(existsSync(resolve(out, 'static/docs/index.html'))).toBe(true)
}, 120_000)
