// #113: links between pages and to #anchors are checked once every page is built.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { checkLinks } from '../src/vite/links.ts'

function site(pages: Record<string, string>, extra: Record<string, string> = {}) {
  const out = mkdtempSync(resolve(tmpdir(), 'clarus-links-'))
  const write = (path: string, text: string) => { mkdirSync(resolve(out, path, '..'), { recursive: true }); writeFileSync(resolve(out, path), text) }
  for (const [route, html] of Object.entries(pages)) write(route === '/' ? 'index.html' : `${route.slice(1)}/index.html`, html)
  for (const [path, text] of Object.entries(extra)) write(path, text)
  return out
}

test('links to existing pages, anchors, files, server routes and external URLs are fine', () => {
  const out = site({
    '/': '<a href="/guide/intro">a</a><a href="/guide/intro#install">b</a><a href="guide/intro/">c</a><a href="#top">d</a><h1 id="top">x</h1><a href="/logo.svg">e</a><a href="/account/7">f</a><a href="https://example.com/x">g</a><a href="mailto:a@b.c">h</a><a href="/guide/intro?x=1#install">i</a>',
    '/guide/intro': '<h2 id="install">Install</h2><a href="../../">up</a><a href="./">self</a>',
  }, { 'logo.svg': '<svg/>' })
  expect(checkLinks({ outDir: out, routes: ['/', '/guide/intro'], serverRoutes: ['/account/[id]'], clientRoutes: [], base: '/' })).toEqual([])
})

test('a missing page and a missing anchor are reported, with the closest match suggested', () => {
  const out = site({
    '/': '<a href="/guide/intor">a</a><a href="/guide/intro#instal">b</a><a href="#nowhere">c</a>',
    '/guide/intro': '<h2 id="install">Install</h2>',
  })
  expect(checkLinks({ outDir: out, routes: ['/', '/guide/intro'], serverRoutes: [], clientRoutes: [], base: '/' })).toEqual([
    { kind: 'pages', page: '/', href: '/guide/intor', message: 'no page at /guide/intor (did you mean /guide/intro?)' },
    { kind: 'anchors', page: '/', href: '/guide/intro#instal', message: 'no #instal on /guide/intro (did you mean #install?)' },
    { kind: 'anchors', page: '/', href: '#nowhere', message: 'no #nowhere on /' },
  ])
})

test('a base is respected; client routes have no anchors to check; links under the base only', () => {
  const out = site({ '/': '<a href="/docs/guide">a</a><a href="/docs/app/1#x">b</a><a href="/elsewhere">c</a>', '/guide': '<p>g</p>' })
  expect(checkLinks({ outDir: out, routes: ['/', '/guide', '/app/1'], serverRoutes: [], clientRoutes: ['/app/1'], base: '/docs/' })).toEqual([])
})

// A whole build: problems name the page's source file and line.
import { symlinkSync } from 'node:fs'
import { createBuilder } from 'vite'
import clarusjs, { type ClarusOptions } from '../src/vite/plugin.ts'

async function build(pages: Record<string, string>, options: ClarusOptions = {}) {
  const root = mkdtempSync(resolve(tmpdir(), 'clarus-links-build-'))
  for (const [path, text] of Object.entries(pages)) { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/clarusjs'), 'dir')
  const warnings: string[] = []
  const logger = { info() {}, warn: (m: string) => warnings.push(m), warnOnce() {}, error() {}, clearScreen() {}, hasErrorLogged: () => false, hasWarned: false }
  await (await createBuilder({ root, configFile: false, customLogger: logger, plugins: [clarusjs(options)] })).buildApp()
  return warnings
}

test('vite build: a missing page fails the build, naming the source file and line', async () => {
  const pages = { 'src/pages/index.tscl': '<h1>Home</h1>\n<p><a href="/guide">Guide</a></p>\n<a href="/gide">typo</a>\n', 'src/pages/guide.tscl': '<h1 id="top">Guide</h1>' }
  await expect(build(pages)).rejects.toThrow(/broken links:\n  src\/pages\/index\.tscl:3: no page at \/gide \(did you mean \/guide\?\)/)
}, 60_000)

test('vite build: a missing anchor is a warning; strict makes it an error; levels can be turned off', async () => {
  const pages = { 'src/pages/index.tscl': '<a href="/guide#tpo">x</a>', 'src/pages/guide.tscl': '<h1 id="top">Guide</h1>' }
  expect((await build(pages)).join('\n')).toMatch(/src\/pages\/index\.tscl:1: no #tpo on \/guide \(did you mean #top\?\)/)
  await expect(build(pages, { links: { strict: true } })).rejects.toThrow(/no #tpo on \/guide/)
  expect((await build(pages, { links: { anchors: 'off' } })).join('\n')).not.toContain('#tpo')
}, 60_000)

test('malformed escapes, directories and an absolute base', () => {
  const out = site({ '/': '<a href="/bad%zz">a</a><a href="#x%">b</a><a href="/guide">c</a>', '/guide/intro': '<p>i</p>' })
  const issues = checkLinks({ outDir: out, routes: ['/', '/guide/intro'], serverRoutes: [], clientRoutes: [], base: '/' })
  expect(issues.map((i) => i.message)).toEqual(['no page at /bad%zz', 'no #x% on /', 'no page at /guide'])
  const docs = site({ '/': '<a href="/docs/nope">a</a>' })
  expect(checkLinks({ outDir: docs, routes: ['/'], serverRoutes: [], clientRoutes: [], base: 'https://cdn.example.com/docs/' })).toHaveLength(1)
})

test('absolute links to the site itself are checked like internal ones', () => {
  const out = site({ '/': '<a href="https://example.com/docs/guide">a</a><a href="https://example.com/docs/nope#x">b</a><a href="https://example.com/other">c</a><a href="https://other.dev/docs/nope">d</a>', '/guide': '<p>g</p>' })
  const issues = checkLinks({ outDir: out, routes: ['/', '/guide'], serverRoutes: [], clientRoutes: [], base: '/docs/', site: 'https://example.com' })
  expect(issues.map((i) => i.message)).toEqual(['no page at /nope'])
})
