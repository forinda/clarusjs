// #26: `clarusjs explain [route]` prints where each part of a route runs, from dist/clarusjs-manifest.json.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { expect, test } from 'vitest'
import { explain } from '../../src/cli/explain.ts'
import type { Manifest } from '../../src/vite/manifest.ts'

const manifest: Manifest = {
  version: 1,
  routes: {
    '/': {
      mode: 'static', html: 'index.html', loader: null,
      islands: [
        { component: 'counter', src: 'assets/counter.js', attach: 'load', count: 1, gzip: 300 },
        { component: 'copy', src: 'assets/copy.js', attach: 'interaction', count: 3, gzip: 400 },
      ],
      js: { files: ['assets/loader.js', 'assets/counter.js', 'assets/dom.js', 'assets/copy.js'], gzip: 4710, initialGzip: 4300 },
      css: ['/docs.css'],
    },
    '/about': { mode: 'static', html: 'about/index.html', loader: null, islands: [], js: { files: [], gzip: 0, initialGzip: 0 }, css: [] },
  },
}
function project(): string {
  const root = mkdtempSync(resolve(tmpdir(), 'clarus-explain-'))
  mkdirSync(resolve(root, 'dist'))
  writeFileSync(resolve(root, 'dist/clarusjs-manifest.json'), JSON.stringify(manifest))
  return root
}

test('explains one route in plain words', () => {
  const result = explain({ root: project(), route: '/' })
  expect(result.exitCode).toBe(0)
  expect(result.text).toBe([
    '/',
    '  Rendered    at build time, to dist/client/index.html',
    '  Data        no loader',
    '  Islands     counter (0.3 KB, on page load)',
    '              copy ×3 (0.4 KB, on first interaction)',
    '  JavaScript  4.2 KB on page load, 4.6 KB in all (gzip, 4 files)',
    '  CSS         /docs.css',
  ].join('\n'))
  expect(JSON.parse(result.json)).toEqual({ route: '/', ...manifest.routes['/'] })
})

test('a route without islands ships no JavaScript; a trailing slash is fine', () => {
  const result = explain({ root: project(), route: '/about/' })
  expect(result.text).toBe([
    '/about',
    '  Rendered    at build time, to dist/client/about/index.html',
    '  Data        no loader',
    '  Islands     none',
    '  JavaScript  none',
    '  CSS         none',
  ].join('\n'))
})

test('without a route, lists every route', () => {
  const result = explain({ root: project() })
  expect(result.text).toBe([
    'Route   Islands  JS on load  JS in all',
    '/       4        4.2 KB      4.6 KB',
    '/about  0        0 KB        0 KB',
  ].join('\n'))
  expect(JSON.parse(result.json)).toEqual(manifest.routes)
})

test('an unknown route or a missing build is an error that says what to do', () => {
  const unknown = explain({ root: project(), route: '/nope' })
  expect(unknown.exitCode).toBe(1)
  expect(unknown.text).toBe('No route /nope. Routes: /, /about')
  const empty = explain({ root: mkdtempSync(resolve(tmpdir(), 'clarus-explain-')) })
  expect(empty.exitCode).toBe(1)
  expect(empty.text).toMatch(/^No dist\/clarusjs-manifest\.json: run vite build first/)
})

test('the command line runs explain', () => {
  const root = project()
  const cli = resolve(import.meta.dirname, '../../src/cli/index.ts')
  const run = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', cli, 'explain', '/about', '--root', root], { encoding: 'utf8' })
  expect(run.status).toBe(0)
  expect(run.stdout).toContain('  JavaScript  none')
  const json = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', cli, 'explain', '/', '--root', root, '--json'], { encoding: 'utf8' })
  expect(JSON.parse(json.stdout).islands).toHaveLength(2)
})

test('#31: a route whose load() ran at build says so', () => {
  const root = project()
  const withLoader = { ...manifest, routes: { '/about': { ...manifest.routes['/about']!, loader: 'build' as const } } }
  writeFileSync(resolve(root, 'dist/clarusjs-manifest.json'), JSON.stringify(withLoader))
  expect(explain({ root, route: '/about' }).text).toContain('  Data        load() ran once, at build time')
})

test('#29: a server route is explained as rendered per request', () => {
  const root = project()
  const server = { mode: 'server' as const, html: null, loader: 'request' as const, islands: [], js: { files: [], gzip: 0, initialGzip: 0 }, css: [] }
  writeFileSync(resolve(root, 'dist/clarusjs-manifest.json'), JSON.stringify({ version: 1, routes: { '/account/[id]': server } }))
  expect(explain({ root, route: '/account/[id]' }).text).toBe([
    '/account/[id]',
    '  Rendered    on every request, by dist/server/index.mjs',
    '  Data        load() runs on every request',
    '  Islands     decided per request',
  ].join('\n'))
  expect(explain({ root }).text).toContain('/account/[id]  -        per request')
})

test('#33: a client route is explained as rendered in the browser', () => {
  const root = project()
  const app = { mode: 'client' as const, html: 'app/index.html', loader: 'build' as const, islands: [], js: { files: ['assets/r.js'], gzip: 900, initialGzip: 900 }, css: [] }
  writeFileSync(resolve(root, 'dist/clarusjs-manifest.json'), JSON.stringify({ version: 1, routes: { '/app': app } }))
  const text = explain({ root, route: '/app' }).text
  expect(text).toContain('  Rendered    in the browser, by the router (shell: dist/client/app/index.html)')
  expect(text).toContain('  Data        load() ran once, at build time; fetched as __data.json')
})
