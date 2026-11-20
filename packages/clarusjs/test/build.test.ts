// `vite build` on an app using the plugin: client build, server build, then every page prerendered to static HTML.
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
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
  expect(existsSync(resolve(root, 'dist/server/index.js'))).toBe(true)
  expect(existsSync(resolve(client, 'site.css'))).toBe(true)
})

test('a page with an island loads the hashed loader, and the island points at its hashed chunk', () => {
  const html = read('index.html')
  const scripts = [...html.matchAll(/<script type="module" src="([^"]+)"><\/script>/g)].map((m) => m[1]!)
  expect(scripts).toHaveLength(1)
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
