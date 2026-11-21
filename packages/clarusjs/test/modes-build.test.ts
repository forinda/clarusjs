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

test('#32: adapter netlify writes a function that serves the server routes with the same handler', async () => {
  const file = resolve(root, '.netlify/v1/functions/clarusjs-server.mjs')
  expect(existsSync(file)).toBe(true)
  const fn = await import(`${pathToFileURL(file).href}?t=${Date.now()}`)
  // Static routes stay files: Netlify serves them first, and only the server routes reach the function.
  expect(fn.config).toEqual({ path: ['/account/:id', '/account/:id/', '/account/:id/index.frag.html'], preferStatic: true })
  const res = await fn.default(new Request('https://site.example/account/3', { headers: { 'user-agent': 'netlify/1' } }))
  expect(res.status).toBe(200)
  expect(await res.text()).toContain('<p>netlify/1</p>')
})

test('#32: the adapter config is checked', async () => {
  const { default: clarusjs } = await import('../src/vite/plugin.ts')
  expect(() => clarusjs({ adapter: 'vercel' as 'netlify' })).toThrow(`clarusjs: adapter "vercel" is not supported; use 'netlify'`)
})

test('#32: Netlify paths use URLPattern syntax, with literal text escaped', async () => {
  const { netlifyPaths } = await import('../src/vite/netlify.ts')
  expect(netlifyPaths('/')).toEqual(['/'])
  expect(netlifyPaths('/a/[id]/b')).toEqual(['/a/:id/b', '/a/:id/b/'])
  expect(netlifyPaths('/x/[$id]')).toEqual(['/x/:p0', '/x/:p0/'])
  expect(netlifyPaths('/v(2)*')).toEqual(['/v\\(2\\)\\*', '/v\\(2\\)\\*/'])
})

test('#33: client routes are prerendered as shells, with their data files and render modules', async () => {
  const shell = readFileSync(resolve(root, 'dist/client/app/one/index.html'), 'utf8')
  expect(shell).not.toContain('<h1>')
  const table = JSON.parse(/<script type="application\/json" id="cl-routes"[^>]*>(.*?)<\/script>/.exec(shell)![1]!) as { p: string; r: string }[]
  expect(table.map((t) => t.p)).toEqual(['/app', '/app/[id]'])
  const router = /<script type="module" src="([^"]+)"><\/script><\/head>/.exec(shell)![1]!
  expect(existsSync(resolve(root, 'dist/client', router.slice(1)))).toBe(true)
  // The render module renders the page in the browser from the data file.
  const { parse } = await import('../src/runtime/serialize.ts')
  const props = parse(readFileSync(resolve(root, 'dist/client/app/one/__data.json'), 'utf8')) as object
  expect(props).toEqual({ id: 'one', label: 'Item one' })
  const mod = await import(pathToFileURL(resolve(root, 'dist/client', table[1]!.r.slice(1))).href)
  expect(mod.render(props)).toContain('<h1>Item one</h1>')
  expect(JSON.parse(readFileSync(resolve(root, 'dist/client/app/__data.json'), 'utf8'))).toEqual({})
})

test('#33: the manifest marks client routes and leaves data files out', () => {
  const manifest = JSON.parse(readFileSync(resolve(root, 'dist/clarusjs-manifest.json'), 'utf8'))
  expect(Object.keys(manifest.routes).filter((r) => r.includes('__data'))).toEqual([])
  expect(manifest.routes['/app/one']).toMatchObject({ mode: 'client', html: 'app/one/index.html', loader: 'build' })
  expect(manifest.routes['/app/one'].js.files.some((f: string) => f.includes('render/'))).toBe(true)
})

// 1.1 KB: the router must leave the page's own history.pushState/replaceState alone (#167), which doesn't fit in
// 1 KB (it was at exactly 1024 bytes).
test('size budget: the client router stays within 1.1 KB gzip', async () => {
  const { gzipSync } = await import('node:zlib')
  const shell = readFileSync(resolve(root, 'dist/client/app/index.html'), 'utf8')
  const router = /<script type="module" src="([^"]+)"><\/script><\/head>/.exec(shell)![1]!
  const size = gzipSync(readFileSync(resolve(root, 'dist/client', router.slice(1))), { level: 9 }).length
  expect(size).toBeLessThanOrEqual(1126)
})

test('review: Netlify parameter names never collide', async () => {
  const { netlifyPaths } = await import('../src/vite/netlify.ts')
  expect(netlifyPaths('/[p0]/[$id]')).toEqual(['/:p0/:p1', '/:p0/:p1/'])
  expect(netlifyPaths('/[$id]/[p0]')).toEqual(['/:p1/:p0', '/:p1/:p0/'])
  expect(netlifyPaths('/account/[id]')).toEqual(['/account/:id', '/account/:id/'])
})

test('review: an island with a bracketed file name inside a client page points at its real chunk', async () => {
  const shell = readFileSync(resolve(root, 'dist/client/app/index.html'), 'utf8')
  const table = JSON.parse(/<script type="application\/json" id="cl-routes"[^>]*>(.*?)<\/script>/.exec(shell)![1]!) as { p: string; r: string }[]
  const mod = await import(pathToFileURL(resolve(root, 'dist/client', table.find((t) => t.p === '/app')!.r.slice(1))).href)
  const src = /<cl-island c="\[tag\]" src="([^"]+)"/.exec(mod.render({}))![1]!
  expect(src).not.toContain('__CLARUS_CHUNK__')
  expect(existsSync(resolve(root, 'dist/client', src.slice(1)))).toBe(true)
})

test('review: client routes under a base list their browser paths', async () => {
  const { cpSync, mkdirSync, mkdtempSync, symlinkSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { default: clarusjs } = await import('../src/vite/plugin.ts')
  const dir = mkdtempSync(resolve(tmpdir(), 'clarusjs-client-base-'))
  cpSync(resolve(root, 'src'), resolve(dir, 'src'), { recursive: true })
  mkdirSync(resolve(dir, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(dir, 'node_modules/clarusjs'), 'dir')
  const config = { root: dir, configFile: false as const, base: '/docs/', logLevel: 'silent' as const, plugins: [clarusjs({ routes: { '/account/*': 'server', '/app/*': 'client' } })] }
  await (await createBuilder(config)).buildApp()
  const shell = readFileSync(resolve(dir, 'dist/client/app/one/index.html'), 'utf8')
  const table = JSON.parse(/id="cl-routes"[^>]*>(.*?)<\/script>/.exec(shell)![1]!) as { p: string; r: string }[]
  expect(table.map((t) => t.p)).toEqual(['/docs/app', '/docs/app/[id]'])
  expect(table.every((t) => t.r.startsWith('/docs/assets/'))).toBe(true)
  expect(existsSync(resolve(dir, 'dist/client/app/one/__data.json'))).toBe(true)
}, 120_000)

test('#35: with fragments on, static pages get index.frag.html; the manifest leaves fragments out', async () => {
  expect(readFileSync(resolve(root, 'dist/client/index.frag.html'), 'utf8')).toBe('<title>clarusjs</title><body><h1>Home</h1></body>')
  expect(readFileSync(resolve(root, 'dist/client/blog/hello/index.frag.html'), 'utf8')).toContain('<h1>Post hello</h1>')
  expect(existsSync(resolve(root, 'dist/client/app/one/index.frag.html'))).toBe(false) // client routes render in the browser
  const manifest = JSON.parse(readFileSync(resolve(root, 'dist/clarusjs-manifest.json'), 'utf8'))
  expect(Object.keys(manifest.routes).filter((r) => r.includes('frag'))).toEqual([])
  // A server route's fragment comes from the handler.
  const { default: handler } = await import(`${pathToFileURL(resolve(root, 'dist/server/index.mjs')).href}?t=${Date.now()}`)
  expect(await (await handler.fetch(new Request('http://x/account/7/index.frag.html'))).text()).toContain('<h1>Account 7</h1>')
})

test('#36: with fragments on, static pages load the navigation script, which stays within 1 KB gzip', async () => {
  const { gzipSync } = await import('node:zlib')
  const html = readFileSync(resolve(root, 'dist/client/index.html'), 'utf8')
  const nav = /<script type="module" src="(\/assets\/cl-nav-[^"]+)"><\/script>/.exec(html)?.[1]
  expect(nav).toBeDefined()
  expect(gzipSync(readFileSync(resolve(root, 'dist/client', nav!.slice(1))), { level: 9 }).length).toBeLessThanOrEqual(1024)
})
