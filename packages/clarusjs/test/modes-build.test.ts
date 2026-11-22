// #29: a build with server routes: static routes are files, server routes render per request from dist/server.
import { existsSync, readFileSync, rmSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createBuilder, preview } from 'vite'
import { beforeAll, expect, test } from 'vitest'
import { unscoped } from './helpers.ts'

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
  expect(unscoped(html)).toContain('<h1>Account 7</h1>')
  expect(unscoped(html)).toContain('<p>probe/1</p>')
})

test('the manifest records each route\'s mode', () => {
  const manifest = JSON.parse(readFileSync(resolve(root, 'dist/clarusjs-manifest.json'), 'utf8'))
  expect(manifest.routes['/'].mode).toBe('static')
  expect(manifest.routes['/account/[id]']).toEqual({ mode: 'server', html: null, loader: 'request', cookies: true, islands: [], js: { files: [], gzip: 0, initialGzip: 0 }, css: [] })
})

test('vite preview serves server routes through the built handler', async () => {
  const server = await preview({ root, configFile: resolve(root, 'vite.config.ts'), logLevel: 'silent', preview: { port: 0 } })
  try {
    const { port } = server.httpServer.address() as { port: number }
    const res = await fetch(`http://localhost:${port}/account/9`, { headers: { 'user-agent': 'preview/1' } })
    expect(res.status).toBe(200)
    expect(unscoped(await res.text())).toContain('<p>preview/1</p>')
    expect(unscoped(await (await fetch(`http://localhost:${port}/`)).text())).toContain('<h1>Home</h1>')
    expect((await fetch(`http://localhost:${port}/nope`)).status).toBe(404)
    // A static dynamic route only has the pages its entries() listed, as on a static host.
    expect(unscoped(await (await fetch(`http://localhost:${port}/blog/hello`)).text())).toContain('<h1>Post hello</h1>')
    expect((await fetch(`http://localhost:${port}/blog/other`)).status).toBe(404)
    expect((await fetch(`http://localhost:${port}/account/%E0%A4%A`)).status).toBe(400) // malformed escape: a 400, not a crash (#55)
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
  expect(unscoped(await res.text())).toContain('<p>netlify/1</p>')
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
  expect(unscoped(shell)).not.toContain('<h1>')
  const table = JSON.parse(/<script type="application\/json" id="cl-routes"[^>]*>(.*?)<\/script>/.exec(shell)![1]!) as { p: string; r: string }[]
  expect(table.map((t) => t.p)).toEqual(['/app', '/app/[id]'])
  const router = /<script type="module" src="([^"]+)"><\/script><\/head>/.exec(shell)![1]!
  expect(existsSync(resolve(root, 'dist/client', router.slice(1)))).toBe(true)
  // The render module renders the page in the browser from the data file.
  const { parse } = await import('../src/runtime/serialize.ts')
  const props = parse(readFileSync(resolve(root, 'dist/client/app/one/__data.json'), 'utf8')) as object
  expect(props).toEqual({ id: 'one', label: 'Item one' })
  const mod = await import(pathToFileURL(resolve(root, 'dist/client', table[1]!.r.slice(1))).href)
  expect(unscoped(mod.render(props))).toContain('<h1>Item one</h1>')
  expect(JSON.parse(readFileSync(resolve(root, 'dist/client/app/__data.json'), 'utf8'))).toEqual({})
})

test('#33: the manifest marks client routes and leaves data files out', () => {
  const manifest = JSON.parse(readFileSync(resolve(root, 'dist/clarusjs-manifest.json'), 'utf8'))
  expect(Object.keys(manifest.routes).filter((r) => r.includes('__data'))).toEqual([])
  expect(manifest.routes['/app/one']).toMatchObject({ mode: 'client', html: 'app/one/index.html', loader: 'build' })
  expect(manifest.routes['/app/one'].js.files.some((f: string) => f.includes('render/'))).toBe(true)
})

// 1.45 KB: review fixes on #186 (cleanup when a navigation is cancelled, failures reported before the fallback load,
// islands attached before afterSwap). 1.4 KB until then: a client route that fails its first render shows the site's
// 404 or 500 page (#196). 1.35 KB before, for
// aborting a navigation (#193); 1.2 KB for the transitions of #182; 1.1 KB before; 1 KB before #167.
test('size budget: the client router stays within 1.45 KB gzip', async () => {
  const { gzipSync } = await import('node:zlib')
  const shell = readFileSync(resolve(root, 'dist/client/app/index.html'), 'utf8')
  const router = /<script type="module" src="([^"]+)"><\/script><\/head>/.exec(shell)![1]!
  const size = gzipSync(readFileSync(resolve(root, 'dist/client', router.slice(1))), { level: 9 }).length
  expect(size).toBeLessThanOrEqual(1485)
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
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(dir, 'node_modules/clarusjs'), 'junction')
  const config = { root: dir, configFile: false as const, base: '/docs/', logLevel: 'silent' as const, plugins: [clarusjs({ routes: { '/account/*': 'server', '/app/*': 'client' } })] }
  await (await createBuilder(config)).buildApp()
  const shell = readFileSync(resolve(dir, 'dist/client/app/one/index.html'), 'utf8')
  const table = JSON.parse(/id="cl-routes"[^>]*>(.*?)<\/script>/.exec(shell)![1]!) as { p: string; r: string }[]
  expect(table.map((t) => t.p)).toEqual(['/docs/app', '/docs/app/[id]'])
  expect(table.every((t) => t.r.startsWith('/docs/assets/'))).toBe(true)
  expect(existsSync(resolve(dir, 'dist/client/app/one/__data.json'))).toBe(true)
}, 120_000)

test('#35: with fragments on, static pages get index.frag.html; the manifest leaves fragments out', async () => {
  expect(unscoped(readFileSync(resolve(root, 'dist/client/index.frag.html'), 'utf8'))).toBe('<title>clarusjs</title><body><h1>Home</h1></body>')
  expect(unscoped(readFileSync(resolve(root, 'dist/client/blog/hello/index.frag.html'), 'utf8'))).toContain('<h1>Post hello</h1>')
  expect(existsSync(resolve(root, 'dist/client/app/one/index.frag.html'))).toBe(false) // client routes render in the browser
  const manifest = JSON.parse(readFileSync(resolve(root, 'dist/clarusjs-manifest.json'), 'utf8'))
  expect(Object.keys(manifest.routes).filter((r) => r.includes('frag'))).toEqual([])
  // A server route's fragment comes from the handler.
  const { default: handler } = await import(`${pathToFileURL(resolve(root, 'dist/server/index.mjs')).href}?t=${Date.now()}`)
  expect(unscoped(await (await handler.fetch(new Request('http://x/account/7/index.frag.html'))).text())).toContain('<h1>Account 7</h1>')
})

test('#179: the router and the fragment navigator each carry the navigation guard, never a shared chunk', async () => {
  const { readdirSync } = await import('node:fs')
  const assets = readdirSync(resolve(root, 'dist/client/assets')).filter((f) => f.endsWith('.js'))
  expect(assets.filter((f) => f.startsWith('navigate'))).toEqual([]) // a page loads one of them: a shared chunk is only a cost
  for (const name of ['cl-router', 'cl-nav']) {
    const code = readFileSync(resolve(root, 'dist/client/assets', assets.find((f) => f.startsWith(name))!), 'utf8')
    expect(code, name).toContain('canIntercept')
  }
})

test('#180: clarusjs/navigation ships only with islands that import it', async () => {
  const { readdirSync } = await import('node:fs')
  const dir = resolve(root, 'dist/client/assets')
  const js = readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => readFileSync(resolve(dir, f), 'utf8'))
  expect(js.some((code) => code.includes('currententrychange'))).toBe(false) // this site never imports it
})

// 1.2 KB: review fixes on #186 (see the router's budget). 1.15 KB before: aborting a navigation (#193) stops its fragment request and can hold the URL until the page is ready (1 KB
// until then).
test('#36: with fragments on, static pages load the navigation script, which stays within 1.2 KB gzip', async () => {
  const { gzipSync } = await import('node:zlib')
  const html = readFileSync(resolve(root, 'dist/client/index.html'), 'utf8')
  const nav = /<script type="module" src="(\/assets\/cl-nav-[^"]+)"><\/script>/.exec(html)?.[1]
  expect(nav).toBeDefined()
  expect(gzipSync(readFileSync(resolve(root, 'dist/client', nav!.slice(1))), { level: 9 }).length).toBeLessThanOrEqual(1229)
})

test('#307: collapseWhitespace: false keeps template text as written at build', () => {
  const html = readFileSync(resolve(root, 'dist/client/spacing/index.html'), 'utf8')
  expect(html).toContain('<p>\n        Indented    text\n    </p>')
})

test('#98: compress writes .br and .gz next to the text files of dist/client, each the same content', async () => {
  const { brotliDecompressSync, gunzipSync } = await import('node:zlib')
  const { readdirSync } = await import('node:fs')
  const client = resolve(root, 'dist/client')
  const html = readFileSync(resolve(client, 'index.html'))
  expect(gunzipSync(readFileSync(resolve(client, 'index.html.gz'))).equals(html)).toBe(true)
  expect(brotliDecompressSync(readFileSync(resolve(client, 'index.html.br'))).equals(html)).toBe(true)
  const files = readdirSync(client, { recursive: true }) as string[]
  const js = files.find((f) => f.endsWith('.js'))!
  expect(files).toContain(js + '.br')
  // Only text files, and only when compressing makes them smaller; never a compressed file of a compressed file.
  expect(files.some((f) => /\.(br|gz)\.(br|gz)$/.test(f))).toBe(false)
  for (const f of files.filter((f) => /\.(br|gz)$/.test(f))) {
    expect(f).toMatch(/\.(html|js|css|svg|json|xml)\.(br|gz)$/)
    expect(statSync(resolve(client, f)).size).toBeLessThan(statSync(resolve(client, f.replace(/\.(br|gz)$/, ''))).size)
  }
})

test('#93: src/server.ts handle() resolves the session for every load(); Set-Cookie reaches the answer', async () => {
  const { default: app } = await import(pathToFileURL(resolve(root, 'dist/server/index.mjs')).href + '?t=' + Date.now())
  const signedIn = await app.fetch(new Request('https://x.test/account/1', { headers: { cookie: 'session=42' } }))
  expect(unscoped(await signedIn.text())).toContain('<p id="user">user 42</p>')
  expect(signedIn.headers.get('set-cookie')).toBe('last-account=seen; Path=/; HttpOnly; SameSite=Lax; Secure')
  const anonymous = await app.fetch(new Request('https://x.test/account/1'))
  expect(unscoped(await anonymous.text())).toContain('<p id="user">nobody</p>')
})

test('#94: the manifest and clarusjs explain say which server routes read cookies', async () => {
  const manifest = JSON.parse(readFileSync(resolve(root, 'dist/clarusjs-manifest.json'), 'utf8'))
  expect(manifest.routes['/account/[id]'].cookies).toBe(true)
  const { explain } = await import('../src/cli/explain.ts')
  expect(explain({ root, route: '/account/[id]' }).text).toContain('load() runs on every request, and reads cookies')
})
