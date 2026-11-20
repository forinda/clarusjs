// `vite build` on an app using the plugin: client build, server build, then every page prerendered to static HTML.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { createBuilder } from 'vite'
import { beforeAll, expect, test } from 'vitest'
import { routeToFile } from '../src/vite/build.ts'

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
  expect(html).toContain('<h1>Home</h1>')
  expect(html).toContain('Hello, site!')
})

test('a page without islands has no script at all', () => {
  const html = read('about/team/index.html')
  expect(html).toContain('<h1>Team</h1>')
  expect(html).not.toContain('<script')
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

test('routeToFile maps routes to index.html files', () => {
  expect(routeToFile('/')).toBe('index.html')
  expect(routeToFile('/about/team')).toBe('about/team/index.html')
})

test('a page that throws while prerendering fails the build, naming the route', async () => {
  await expect(build(resolve(import.meta.dirname, 'fixtures/site-broken'))).rejects.toThrow(/prerender \/: .*boom/)
}, 120_000)

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
      expect(await res.text(), path).toContain(text)
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

test('size budget: all the JavaScript the fixture site ships stays within 6 KB gzip', () => {
  const files = (readdirSync(resolve(client, 'assets'), { recursive: true }) as string[]).filter((f) => f.endsWith('.js'))
  const total = files.reduce((n, f) => n + gz(resolve(client, 'assets', f)), 0)
  expect(total, `${total} B gzip`).toBeLessThanOrEqual(6 * KB)
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
  expect(Object.keys(manifest.routes)).toEqual(['/', '/about/team', '/explain', '/users/ada', '/users/linus'])
  expect(manifest.routes['/about/team']).toEqual({ mode: 'static', html: 'about/team/index.html', loader: null, islands: [], js: { files: [], gzip: 0, initialGzip: 0 }, css: [] })
  const home = manifest.routes['/']
  expect(home.islands.map((i: { component: string; attach: string; count: number }) => [i.component, i.attach, i.count])).toEqual([['counter', 'load', 1], ['panel', 'load', 1]])
  expect(home.islands.every((i: { gzip: number; src: string }) => i.gzip > 0 && existsSync(resolve(client, i.src)))).toBe(true)
  expect(home.js).toEqual({ files: expect.any(Array), gzip: gz, initialGzip: gz })
  expect(home.js.gzip).toBeGreaterThan(home.islands[0].gzip)
  for (const f of home.js.files) expect(existsSync(resolve(client, f)), f).toBe(true)
})

test('#27: a page that reads the manifest is rendered again once it is written', () => {
  expect(read('explain/index.html')).toContain('<p id="home-islands">counter, panel</p>')
})

test('#30: a dynamic route is prerendered once per entry', () => {
  expect(read('users/ada/index.html')).toContain('<h1>User ada</h1>')
  expect(read('users/linus/index.html')).toContain('<h1>User linus</h1>')
})

test('#30: a dynamic route without entries() fails the build, naming the file', async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'clarusjs-noentries-'))
  cpSync(root, dir, { recursive: true, filter: (src) => !src.includes('/dist') })
  rmSync(resolve(dir, 'src/pages/users/[id].load.ts'))
  mkdirSync(resolve(dir, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(dir, 'node_modules/clarusjs'), 'dir')
  const plugin = resolve(import.meta.dirname, '../src/vite/plugin.ts')
  writeFileSync(resolve(dir, 'vite.config.ts'), `import { defineConfig } from 'vite'\nimport clarusjs from ${JSON.stringify(plugin)}\nexport default defineConfig({ plugins: [clarusjs()] })\n`)
  await expect(build(dir)).rejects.toThrow('/users/[id] is a dynamic route: export entries() from src/pages/users/[id].load.ts')
}, 60_000)
