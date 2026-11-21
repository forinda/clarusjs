// #42: page sources. A source turns files with another extension into .tscl text, compiled like any page.
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createBuilder } from 'vite'
import { expect, test } from 'vitest'
import clarusjs, { type Source } from '../src/vite/plugin.ts'
import { routeFromFile } from '../src/server/handler.ts'
import { unscoped } from './helpers.ts'

// A toy source: the file's text becomes a paragraph inside the layout, with its route passed along.
const note: Source = {
  extension: '.note',
  toTscl: (code, file, { route }) => `@import layout from '${'../'.repeat(file.replace(/\\/g, '/').split('/src/pages/')[1]!.split('/').length)}layouts/main.tscl'\n<layout [path]="'${route}'"><p>${code.trim()}</p></layout>\n`,
}

test('routes come from any page source extension', () => {
  expect(routeFromFile('/src/pages/guide/intro.md')).toBe('/guide/intro')
  expect(routeFromFile('/src/pages/index.md')).toBe('/')
  expect(routeFromFile('/src/pages/blog/[slug].note')).toBe('/blog/[slug]')
})

test('a build renders pages from a source next to .tscl pages, with layouts, components and styles', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'clarusjs-sources-'))
  const w = (path: string, text: string) => { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }
  w('src/layouts/main.tscl', '@input path: string = "/"\n<main data-path="{{ path }}"><slot /></main>\n<style scoped>\n  :scope { color: red; }\n</style>\n')
  w('src/pages/index.tscl', '<h1>Home</h1>')
  w('src/pages/guide/intro.note', 'Hello from a note.\n')
  // A file with a source extension outside src/pages (a part to include) is not a page or a component.
  w('src/parts/fragment.note', 'never compiled')
  // A file with the same extension imported as text (?raw), and one outside src/, are left to Vite.
  w('notes/outside.note', 'raw text')
  w('src/pages/raw.tscl', "@import text from '../../notes/outside.note?raw'\n<pre>{{ text }}</pre>")
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/clarusjs'), 'dir')
  await (await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [clarusjs({ sources: [note] })] })).buildApp()
  const html = readFileSync(resolve(root, 'dist/client/guide/intro/index.html'), 'utf8')
  expect(html).toMatch(/<main data-path="\/guide\/intro" class="cl-c-main-[a-z0-9]+"><p>Hello from a note\.<\/p><\/main>/)
  expect(html).toMatch(/<link rel="stylesheet" href="\/assets\/cl-styles-/)
  expect(unscoped(readFileSync(resolve(root, 'dist/client/index.html'), 'utf8'))).toContain('<h1>Home</h1>')
  expect(unscoped(readFileSync(resolve(root, 'dist/client/raw/index.html'), 'utf8'))).toContain('<pre>raw text</pre>')
  const manifest = JSON.parse(readFileSync(resolve(root, 'dist/clarusjs-manifest.json'), 'utf8'))
  expect(Object.keys(manifest.routes).sort()).toEqual(['/', '/guide/intro', '/raw'])
  const server = readFileSync(resolve(root, 'dist/server/index.mjs'), 'utf8')
  expect(server).not.toContain('fragment.note')
}, 120_000)

test('a source extension must start with a dot and not be .tscl', () => {
  expect(() => clarusjs({ sources: [{ extension: 'md', toTscl: () => '' }] })).toThrow(`clarusjs: a source extension must look like ".md", got "md"`)
  expect(() => clarusjs({ sources: [{ extension: '.tscl', toTscl: () => '' }] })).toThrow(/\.tscl/)
})

test('a source whose extension Vite treats as an asset (.txt) still gets the file text, not a URL module', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'clarusjs-sources-asset-'))
  const w = (path: string, text: string) => { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }
  w('src/pages/readme.txt', 'Plain text page.\n')
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/clarusjs'), 'dir')
  const txt: Source = { extension: '.txt', toTscl: (code) => `<p>${code.trim()}</p>` }
  await (await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [clarusjs({ sources: [txt] })] })).buildApp()
  expect(unscoped(readFileSync(resolve(root, 'dist/client/readme/index.html'), 'utf8'))).toContain('<p>Plain text page.</p>')
}, 120_000)
