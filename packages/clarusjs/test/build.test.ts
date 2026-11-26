// `vite build` on an app using the plugin: client build, server build, then every page prerendered to static HTML.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { createBuilder } from 'vite'
import { beforeAll, expect, test } from 'vitest'
import { routeToFile } from '../src/vite/build.ts'
import { unscoped } from './helpers.ts'

const root = resolve(import.meta.dirname, 'fixtures/site')
const client = resolve(root, 'dist/client')

async function build(dir: string) {
  rmSync(resolve(dir, 'dist'), { recursive: true, force: true })
  const builder = await createBuilder({ root: dir, configFile: resolve(dir, 'vite.config.ts'), logLevel: 'silent' })
  await builder.buildApp()
}

beforeAll(() => build(root), 120_000)

const read = (path: string) => readFileSync(resolve(client, path), 'utf8')

test('writes a static page per route, the server handler and public files', () => {
  expect(existsSync(resolve(client, 'index.html'))).toBe(true)
  expect(existsSync(resolve(client, 'about/team/index.html'))).toBe(true)
  expect(existsSync(resolve(root, 'dist/server/index.mjs'))).toBe(true)
  expect(existsSync(resolve(client, 'site.css'))).toBe(true)
})

test('a page with an island loads the hashed loader, and the island points at its hashed chunk', () => {
  const html = read('index.html')
  const scripts = [...html.matchAll(/<script type="module" src="([^"]+)"><\/script>/g)].map((m) => m[1]!)
  expect(scripts).toHaveLength(1)
  expect(html.match(/<cl-island c="panel"/g)).toHaveLength(1)
  expect(scripts[0]).toMatch(/^\/assets\/.+\.js$/)
  expect(existsSync(resolve(client, scripts[0]!.slice(1)))).toBe(true)
  const src = html.match(/<cl-island c="counter" src="([^"]+)"/)![1]!
  expect(src).toMatch(/^\/assets\/.+\.js$/)
  expect(read(src.slice(1))).toMatch(/attach/)
  expect(unscoped(html)).toContain('<h1>Home</h1>')
  expect(html).toContain('Hello, site!')
})

test('a page without islands has no script at all', () => {
  const html = read('about/team/index.html')
  expect(unscoped(html)).toContain('<h1>Team</h1>')
  expect(unscoped(html)).not.toContain('<script')
})

test('no server code or template source reaches the client assets', () => {
  const files = (readdirSync(resolve(client, 'assets'), { recursive: true }) as string[]).filter((f) => f.endsWith('.js'))
  expect(files.length).toBeGreaterThan(0)
  for (const file of files) {
    const js = read(`assets/${file}`)
    expect(js).not.toContain('__cl_escape')
    expect(js).not.toContain('@import')
    expect(js).not.toContain('Hello, ')
  }
})

test('#307: template whitespace is collapsed at build (not in <pre>)', () => {
  const team = read('about/team/index.html')
  expect(team).toMatch(/<section[^>]*id="ws"[^>]*>\n<p>\nIndented text\n<\/p>\n<pre>  kept    as written<\/pre>\n<\/section>/)
})

test('routeToFile maps routes to index.html files', () => {
  expect(routeToFile('/')).toBe('index.html')
  expect(routeToFile('/about/team')).toBe('about/team/index.html')
  // Static hosts look files up by the decoded path: /users/a%20b is served from users/a b/index.html.
  expect(routeToFile('/users/a%20b')).toBe('users/a b/index.html')
  expect(routeToFile('/caf%C3%A9')).toBe('café/index.html')
  expect(routeToFile('/100%')).toBe('100%/index.html') // not an escape: kept as written
})

test('a page that throws while prerendering fails the build, naming the route', async () => {
  // The failing page's file and error (the handler's log), then the route (#196: a failure answers 500).
  await expect(build(resolve(import.meta.dirname, 'fixtures/site-broken'))).rejects.toThrow(/src\/pages\/index\.tscl: render failed: boom\nprerender \/: status 500/)
}, 120_000)

// #55
test('the Vite manifest is not published with the site', () => {
  expect(existsSync(resolve(client, '.vite'))).toBe(false)
  expect(existsSync(resolve(root, 'dist/clarusjs-manifest.json'))).toBe(true) // clarusjs's own, outside client/
})

/** GET with the path sent exactly as written (fetch would normalize %2e%2e and the like). */
async function rawGet(port: number, path: string): Promise<{ status: number; body: string }> {
  const { request } = await import('node:http')
  return new Promise((done, fail) => {
    request({ host: 'localhost', port, path }, (res) => {
      let body = ''
      res.on('data', (c) => (body += c)).on('end', () => done({ status: res.statusCode ?? 0, body }))
    }).on('error', fail).end()
  })
}

test("vite preview: a malformed URL is a 400 (no stack); a path can't reach a sibling of the output folder", async () => {
  const { preview } = await import('vite')
  const sibling = resolve(root, 'dist/clientx') // a name that starts with the output folder's
  mkdirSync(sibling, { recursive: true })
  writeFileSync(resolve(sibling, 'index.html'), '<p>outside the site</p>')
  const server = await preview({ root, configFile: resolve(root, 'vite.config.ts'), logLevel: 'silent', preview: { port: 0 } })
  try {
    const address = server.httpServer.address()
    const port = typeof address === 'object' && address ? address.port : 0
    const bad = await rawGet(port, '/%E0%A4%A')
    expect(bad.status).toBe(400)
    expect(bad.body).not.toMatch(/at .*\.(ts|js):\d+/)
    const escaped = await rawGet(port, '/%2e%2e/clientx/')
    expect(escaped.body).not.toContain('outside the site')
    expect(escaped.status).toBe(404) // not some page of the site the path was mis-sliced into
  } finally {
    await server.close()
    rmSync(sibling, { recursive: true, force: true })
  }
})

test('vite preview serves the built pages at their routes, with or without a trailing slash', async () => {
  const { preview } = await import('vite')
  const server = await preview({ root, configFile: resolve(root, 'vite.config.ts'), logLevel: 'silent', preview: { port: 0 } })
  try {
    const address = server.httpServer.address()
    const base = `http://localhost:${typeof address === 'object' && address ? address.port : 0}`
    for (const [path, text] of [['/', '<h1>Home</h1>'], ['/about/team', '<h1>Team</h1>'], ['/about/team/', '<h1>Team</h1>']] as const) {
      const res = await fetch(base + path)
      expect(res.status, path).toBe(200)
      expect(res.headers.get('content-type'), path).toContain('text/html')
      expect(unscoped(await res.text()), path).toContain(text)
    }
    expect((await fetch(`${base}/site.css`)).status).toBe(200)
    expect((await fetch(`${base}/missing`)).status).toBe(404)
  } finally {
    await server.close()
  }
})

test('an island that renders a nested island in the browser points it at the nested chunk\'s real URL', () => {
  const files = (readdirSync(resolve(client, 'assets'), { recursive: true }) as string[]).filter((f) => f.endsWith('.js'))
  const panel = files.find((f) => /panel-.+\.js$/.test(f))!
  const counter = files.find((f) => /counter-.+\.js$/.test(f))!
  const code = read(`assets/${panel}`)
  expect(code).toContain(`/assets/${counter.replace(/\\/g, '/')}`)
  expect(code).not.toContain('__CLARUS_CHUNK__')
})

// Size budgets: raising one is a deliberate change (see AGENTS.md), not a side effect.
const KB = 1024
const gz = (path: string) => gzipSync(readFileSync(path), { level: 9 }).length

test('size budget: the browser runtime every island shares stays within 5 KB gzip', () => {
  const files = (readdirSync(resolve(client, 'assets'), { recursive: true }) as string[]).filter((f) => f.endsWith('.js') && !f.startsWith('src'))
  const total = files.reduce((n, f) => n + gz(resolve(client, 'assets', f)), 0)
  expect(total, `runtime: ${files.join(', ')} = ${total} B gzip`).toBeLessThanOrEqual(5 * KB)
})

// 7 KB (was 6.5): #465 (islands passing content to islands: owner() and slot ranges, context read in the browser, an
// island waiting for the nested islands holding its content) left the site at 6654 B of 6656, no room for the next
// feature. Before that, 6.5 KB (was 6): #301's @for $count/$first/$last and #241's field fixes.
test('size budget: all the JavaScript the fixture site ships stays within 7 KB gzip', () => {
  const files = (readdirSync(resolve(client, 'assets'), { recursive: true }) as string[]).filter((f) => f.endsWith('.js'))
  const total = files.reduce((n, f) => n + gz(resolve(client, 'assets', f)), 0)
  expect(total, `${total} B gzip`).toBeLessThanOrEqual(7 * KB)
})

test('no compiler or command-line code reaches the browser', () => {
  for (const f of (readdirSync(resolve(client, 'assets'), { recursive: true }) as string[]).filter((x) => x.endsWith('.js'))) {
    const js = read(`assets/${f}`)
    expect(js, f).not.toMatch(/acorn|commander|parseExpressionAt|ClarusError/)
  }
})

test('#25: writes dist/clarusjs-manifest.json describing every route', () => {
  const manifest = JSON.parse(readFileSync(resolve(root, 'dist/clarusjs-manifest.json'), 'utf8'))
  const gz = expect.any(Number)
  expect(Object.keys(manifest.routes)).toEqual(['/', '/about/team', '/explain', '/users/ada', '/users/grace%20hopper', '/users/linus'])
  expect(manifest.routes['/about/team']).toEqual({ mode: 'static', html: 'about/team/index.html', loader: null, islands: [], js: { files: [], gzip: 0, initialGzip: 0 }, css: [expect.stringMatching(/base-.+\.css$/), expect.stringMatching(/team-.+\.css$/), expect.stringMatching(/^\/assets\/cl-styles-.+\.css$/)] })
  const home = manifest.routes['/']
  expect(home.islands.map((i: { component: string; attach: string; count: number }) => [i.component, i.attach, i.count])).toEqual([['counter', 'load', 1], ['panel', 'load', 1]])
  expect(home.islands.every((i: { gzip: number; src: string }) => i.gzip > 0 && existsSync(resolve(client, i.src)))).toBe(true)
  expect(home.js).toEqual({ files: expect.any(Array), gzip: gz, initialGzip: gz })
  expect(home.js.gzip).toBeGreaterThan(home.islands[0].gzip)
  for (const f of home.js.files) expect(existsSync(resolve(client, f)), f).toBe(true)
})

test('#27: a page that reads the manifest is rendered again once it is written', () => {
  expect(unscoped(read('explain/index.html'))).toContain('<p id="home-islands">counter, panel</p>')
})

test('#30: a dynamic route is prerendered once per entry', () => {
  expect(unscoped(read('users/ada/index.html'))).toContain('<h1>User Ada</h1>')
  expect(unscoped(read('users/linus/index.html'))).toContain('<h1>User Linus</h1>')
  // A value with a space is written to the folder a static host will look in.
  expect(unscoped(read('users/grace hopper/index.html'))).toContain('<p>grace hopper</p>')
})

test('#30: a dynamic route without entries() fails the build, naming the file', async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'clarusjs-noentries-'))
  cpSync(root, dir, { recursive: true, filter: (src) => !src.includes('/dist') })
  rmSync(resolve(dir, 'src/pages/users/[id].load.ts'))
  mkdirSync(resolve(dir, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(dir, 'node_modules/clarusjs'), 'junction')
  const plugin = resolve(import.meta.dirname, '../src/vite/plugin.ts')
  // No bare 'vite' import: a temp folder outside the workspace has no node_modules to resolve it from.
  writeFileSync(resolve(dir, 'vite.config.ts'), `import clarusjs from ${JSON.stringify(plugin)}\nexport default { plugins: [clarusjs()] }\n`)
  await expect(build(dir)).rejects.toThrow('/users/[id] is a dynamic route: export entries() from src/pages/users/[id].load.ts')
}, 60_000)

test('#31: load() runs at build for each page, and the manifest says so', () => {
  expect(unscoped(read('users/ada/index.html'))).toContain('<p>ada</p>')
  const manifest = JSON.parse(readFileSync(resolve(root, 'dist/clarusjs-manifest.json'), 'utf8'))
  expect(manifest.routes['/users/ada'].loader).toBe('build')
  expect(manifest.routes['/'].loader).toBeNull()
})

test('security: prerender never writes outside the output folder', async () => {
  const { prerender } = await import('../src/vite/build.ts')
  const dir = mkdtempSync(resolve(tmpdir(), 'clarusjs-escape-'))
  const entry = resolve(dir, 'server.mjs')
  // A handler that claims a route escaping the output folder (as a decoded "..%5C.." segment could on Windows).
  writeFileSync(entry, `export default { routes: [], async paths() { return ['/ok', '/a/../../escape'] }, async fetch() { return new Response('x') } }`)
  await expect(prerender(entry, resolve(dir, 'out'), resolve(dir, 'm.json'))).rejects.toThrow(/prerender \/a\/\.\.\/\.\.\/escape: outside the output folder/)
  expect(existsSync(resolve(dir, 'escape'))).toBe(false)
})

test('#22: the built server exports render(), which renders any view by name', async () => {
  const { pathToFileURL } = await import('node:url')
  const server = await import(`${pathToFileURL(resolve(root, 'dist/server/index.mjs')).href}?t=${Date.now()}`)
  expect(await server.render('components/greeting', { name: 'views' })).toContain('Hello, views!')
  // The same registry is reachable through clarusjs/views from the app's own server code.
  const { render } = await import('../src/server/views.ts')
  expect(await render('components/greeting', { name: 'again' })).toContain('Hello, again!')
})

test('#39: component styles are bundled into one stylesheet that every page links', () => {
  const html = read('index.html')
  const href = /<link rel="stylesheet" href="(\/assets\/cl-styles-[^"]+\.css)">/.exec(html)?.[1]
  expect(href).toBeDefined()
  const css = read(href!.slice(1))
  expect(css).toMatch(/@scope ?\(\.cl-c-greeting-[a-z0-9]+\)/) // minified: spaces may go
  expect(css).toMatch(/rebeccapurple|#639\b/) // minified to its short hex
  // The greeting's top-level element carries the same scope id as the stylesheet.
  const id = /\.cl-c-(greeting-[a-z0-9]+)/.exec(css)![1]
  expect(html).toContain(`<p class="cl-c-${id}">Hello, site!</p>`)
  expect(read('about/team/index.html')).toContain(href!)
})

test('#40: a page links the stylesheets it imports, processed and hashed by Vite, before the component styles', () => {
  const team = read('about/team/index.html')
  const hrefs = [...team.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]!)
  expect(hrefs).toHaveLength(3)
  expect(hrefs[0]).toMatch(/^\/assets\/.*base-[\w-]+\.css$/)
  expect(hrefs[1]).toMatch(/^\/assets\/.*team-[\w-]+\.css$/)
  expect(hrefs[2]).toMatch(/^\/assets\/cl-styles-/)
  expect(read(hrefs[0]!.slice(1))).toMatch(/\.team\{color:(rgb\(1,\s?2,\s?3\)|#010203)\}/) // minified by Vite
  // The home page doesn't import them.
  expect(read('index.html')).not.toContain('base-')
})

// 3.5 KB: the final review's fixes (errors with no field, waiting for the newest async check, per-row touched state,
// message elements that belong to one field) took it to 3.1 KB. 3 KB before: core about 2 KB, with steps and submit.
// Loaded only by islands with [engine], so pages without forms pay nothing (checked below).
// 2.5 KB (was 1.5): the keyed result cache (#287: keys, freshness, invalidate, setData, prefetch, dropping unused
// entries) goes into the same entry, which is at 1.49 KB without it.
// 4 KB: #431 (request() for any response type, bodies, timeout, abort(), callbacks and configure()) takes the whole
// module from 2,535 B to 3,190 B, and #429's action() adds ~0.4 KB. An island pays only for what it imports: the
// common resource + json is checked on its own below (2,070 B before #431, 2,689 B with it).
test('size budget: clarusjs/fetch stays within 4 KB gzip on its own, and a site without it ships none of it', async () => {
  const { build: viteBuild } = await import('vite')
  const out = (await viteBuild({
    configFile: false, logLevel: 'silent',
    build: { write: false, minify: true, lib: { entry: resolve(import.meta.dirname, '../src/fetch/index.ts'), formats: ['es'], fileName: 'fetch' }, rollupOptions: { external: [/\/runtime\//] } },
  })) as { output: { type: string; code?: string }[] }[]
  const code = out[0]!.output.find((o) => o.type === 'chunk')!.code!
  const size = gzipSync(code, { level: 9 }).length
  expect(size, `clarusjs/fetch: ${size} B gzip`).toBeLessThanOrEqual(4 * KB)
  // The fixture site doesn't fetch: none of it is in its assets.
  const assets = (readdirSync(resolve(client, 'assets'), { recursive: true }) as string[]).filter((f) => f.endsWith('.js'))
  for (const f of assets) for (const marker of ['batch: no answer for', 'onStart']) expect(readFileSync(resolve(client, 'assets', f), 'utf8'), `${f}: ${marker}`).not.toContain(marker)
}, 60_000)

test('size budget: an island importing resource and json from clarusjs/fetch pays at most 3 KB gzip for them', async () => {
  const { build: viteBuild } = await import('vite')
  const dir = mkdtempSync(resolve(tmpdir(), 'clarusjs-fetch-'))
  const entry = resolve(dir, 'island.js')
  writeFileSync(entry, `export { resource, json } from ${JSON.stringify(resolve(import.meta.dirname, '../src/fetch/index.ts'))}\n`)
  const out = (await viteBuild({
    configFile: false, logLevel: 'silent',
    build: { write: false, minify: true, lib: { entry, formats: ['es'], fileName: 'island' }, rollupOptions: { external: [/\/runtime\//] } },
  })) as { output: { type: string; code?: string }[] }[]
  const size = gzipSync(out[0]!.output.find((o) => o.type === 'chunk')!.code!, { level: 9 }).length
  expect(size, `resource + json: ${size} B gzip`).toBeLessThanOrEqual(3 * KB)
}, 60_000)

// 4 KB: clarusjs/forms is at 3,582 B of 3,584 after #585 (one pass over the fields per change, dirty, shown); its
// review fixes (dirty telling arrays from objects, slot counts kept per refresh for long lists) take it to 3,609 B.
test('size budget: clarusjs/forms stays within 4 KB gzip on its own, and a site without forms ships none of it', async () => {
  const { build: viteBuild } = await import('vite')
  const out = (await viteBuild({
    configFile: false, logLevel: 'silent',
    build: { write: false, minify: true, lib: { entry: resolve(import.meta.dirname, '../src/forms/index.ts'), formats: ['es'], fileName: 'forms' }, rollupOptions: { external: [/\/runtime\//] } },
  })) as { output: { type: string; code?: string }[] }[]
  const code = out[0]!.output.find((o) => o.type === 'chunk')!.code!
  const size = gzipSync(code, { level: 9 }).length
  expect(size, `clarusjs/forms: ${size} B gzip`).toBeLessThanOrEqual(4 * KB)
  // The fixture site has no [engine]: none of the engine is in its assets.
  const assets = (readdirSync(resolve(client, 'assets'), { recursive: true }) as string[]).filter((f) => f.endsWith('.js'))
  // Engine-only text: its message ids, the steps marker, and the schema failure notice.
  for (const f of assets) for (const marker of ['cl-msg-', 'data-cl-steps', 'the form schema failed']) expect(readFileSync(resolve(client, 'assets', f), 'utf8'), `${f}: ${marker}`).not.toContain(marker)
}, 60_000)
