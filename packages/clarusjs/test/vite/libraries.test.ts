// Component libraries (auto-imports from installed packages): the app lists them, each describes itself in its
// package.json, and the names go to .clarusjs/components.json for the editor.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { expect, test } from 'vitest'
import { componentNames, readComponentNames, readComponents, resolveLibraries } from '../../src/vite/libraries.ts'

function app(files: Record<string, string>): string {
  const root = mkdtempSync(resolve(tmpdir(), 'cl-libs-'))
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(resolve(root, file)), { recursive: true })
    writeFileSync(resolve(root, file), text)
  }
  return root
}
const lib = {
  'node_modules/@acme/ui/package.json': JSON.stringify({ name: '@acme/ui', exports: { './*': './src/*' }, clarusjs: { components: './src', prefix: 'acme' } }),
  'node_modules/@acme/ui/src/dialog.tscl': '<dialog><slot /></dialog>\n',
  'node_modules/@acme/ui/src/menu/item.tscl': '<li><slot /></li>\n',
  'node_modules/@acme/ui/src/helper.js': '',
}

test('a listed library: its package.json names the folder and prefix; the app may set its own prefix', () => {
  const root = app(lib)
  expect(resolveLibraries(root, ['@acme/ui'])).toEqual([{ name: '@acme/ui', prefix: 'acme', files: ['dialog.tscl', 'menu/item.tscl'] }])
  expect(resolveLibraries(root, [{ from: '@acme/ui', prefix: 'a' }])[0]!.prefix).toBe('a')
})

test('found from a nested app folder too (node_modules up the tree)', () => {
  const root = app({ ...lib, 'apps/site/package.json': '{}' })
  expect(resolveLibraries(resolve(root, 'apps/site'), ['@acme/ui'])[0]!.files).toHaveLength(2)
})

test('errors say what to do: not installed, or not a component library', () => {
  const root = app({ 'node_modules/plain/package.json': JSON.stringify({ name: 'plain' }) })
  expect(() => resolveLibraries(root, ['@acme/missing'])).toThrow(/"@acme\/missing" isn't installed/)
  expect(() => resolveLibraries(root, ['plain'])).toThrow(/"plain" doesn't describe its components: .*"clarusjs": \{ "components": "\.\/src", "prefix": "ui" \}/)
})

test('componentNames: yours and the libraries\', written to .clarusjs/components.json, which the editor reads', () => {
  const root = app({ ...lib, 'src/components/acme-dialog.tscl': '<div />\n', 'src/components/user-card.tscl': '<div />\n' })
  const names = componentNames(root, { libraries: ['@acme/ui'] })!
  expect(names['acme-dialog']).toBe('/src/components/acme-dialog.tscl') // yours win
  expect(names['acme-menu-item']).toBe('@acme/ui/menu/item.tscl')
  expect(names['user-card']).toBe('/src/components/user-card.tscl')
  expect(JSON.parse(readFileSync(resolve(root, '.clarusjs/components.json'), 'utf8'))).toEqual({ dirs: ['src/components', 'src/layouts'], names })
  expect(readComponentNames(root)).toEqual(names)
  expect(readComponentNames(app({}))).toBeUndefined()
})

test('#review: with automatic imports off, components.json lists none (an earlier run\'s names aren\'t left for the editor)', () => {
  const root = app({ ...lib, 'src/components/user-card.tscl': '<div />\n' })
  componentNames(root, { libraries: ['@acme/ui'] })
  expect(componentNames(root, { auto: false, libraries: ['@acme/ui'] })).toBeUndefined()
  expect(JSON.parse(readFileSync(resolve(root, '.clarusjs/components.json'), 'utf8'))).toEqual({ dirs: [], names: {} })
})

test('#review: the configured folders are written too, for the editor', () => {
  const root = app({ 'src/widgets/user-card.tscl': '<div />\n', 'src/components/old-card.tscl': '<div />\n' })
  expect(Object.keys(componentNames(root, { dirs: ['src/widgets'] })!)).toEqual(['user-card'])
  expect(readComponents(root)).toEqual({ dirs: ['src/widgets'], names: { 'user-card': '/src/widgets/user-card.tscl' } })
})

test('#review: components.json is replaced whole (a new file renamed over it), never rewritten in place', () => {
  const root = app({ 'src/components/user-card.tscl': '<div />\n' })
  componentNames(root)
  const file = resolve(root, '.clarusjs/components.json')
  const before = statSync(file).ino
  writeFileSync(resolve(root, 'src/components/user-list.tscl'), '<div />\n')
  componentNames(root)
  expect(statSync(file).ino).not.toBe(before)
  expect(readdirSync(resolve(root, '.clarusjs'))).toEqual(['components.json'])
})

test('a library component used only by name is built: its island chunk and its styles (no @import anywhere)', async () => {
  const { createBuilder } = await import('vite')
  const { readdirSync, statSync, symlinkSync } = await import('node:fs')
  const { default: clarusjs } = await import('../../src/vite/plugin.ts')
  const root = app({
    'node_modules/@acme/ui/package.json': JSON.stringify({ name: '@acme/ui', exports: { './*': './src/*' }, clarusjs: { components: './src', prefix: 'acme' } }),
    'node_modules/@acme/ui/src/count.tscl': "@import knob from '@acme/controls/knob.tscl'\n<script>\n  let n = state(0)\n</script>\n<button type=\"button\" (click)=\"n++\">{{ n }} <knob /></button>\n<style scoped>\n  :scope { letter-spacing: 4.75px; }\n</style>\n",
    // #review: the library's own dependency, installed only inside it (as pnpm does), resolved from the library's file.
    'node_modules/@acme/ui/node_modules/@acme/controls/package.json': JSON.stringify({ name: '@acme/controls', exports: { './*': './src/*' } }),
    'node_modules/@acme/ui/node_modules/@acme/controls/src/knob.tscl': '<script>\n  let on = state(false)\n</script>\n<i (click)="on = !on">o</i>\n<style scoped>\n  :scope { word-spacing: 3.25px; }\n</style>\n',
    'src/pages/index.tscl': '<main><acme-count /></main>\n',
  })
  symlinkSync(resolve(import.meta.dirname, '../..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  await (await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [clarusjs({ components: { libraries: ['@acme/ui'] } })] })).buildApp()
  const assets = resolve(root, 'dist/client/assets')
  const files = (readdirSync(assets, { recursive: true }) as string[]).filter((f) => statSync(resolve(assets, f)).isFile()).map((f) => f.replaceAll('\\', '/'))
  const text = files.map((f) => readFileSync(resolve(assets, f), 'utf8')).join('\n')
  expect(text).toContain('4.75px')
  expect(text).toContain('3.25px')
  expect(files.some((f) => /(^|\/)count-[\w-]+\.js$/.test(f))).toBe(true)
  expect(files.some((f) => /(^|\/)knob-[\w-]+\.js$/.test(f))).toBe(true)
  expect(readFileSync(resolve(root, 'dist/client/index.html'), 'utf8')).toMatch(/<cl-island c="count"[^>]*>/)
}, 120_000)

test('#review: a prefix that isn\'t kebab-case, and exports that don\'t map the components, are errors saying so', () => {
  const root = app({
    'node_modules/@acme/ui/package.json': JSON.stringify({ name: '@acme/ui', exports: { './*': './src/*' }, clarusjs: { components: './src', prefix: 'acme' } }),
    'node_modules/@acme/ui/src/dialog.tscl': '<dialog />\n',
    'node_modules/@acme/bad/package.json': JSON.stringify({ name: '@acme/bad', exports: { '.': './index.js' }, clarusjs: { components: './src', prefix: 'bad' } }),
    'node_modules/@acme/bad/src/dialog.tscl': '<dialog />\n',
  })
  expect(() => resolveLibraries(root, [{ from: '@acme/ui', prefix: 'UI' }])).toThrow(/prefix "UI" .*kebab-case/)
  expect(() => resolveLibraries(root, ['@acme/bad'])).toThrow(/"@acme\/bad\/dialog\.tscl" doesn't resolve to .*exports.*"\.\/\*": "\.\/src\/\*"/)
  expect(resolveLibraries(root, ['@acme/ui'])[0]!.files).toEqual(['dialog.tscl'])
})

test('#review: a components.json without names reads as nothing; an odd entry is dropped, the rest kept', () => {
  for (const text of ['{}', '{"names":null}', 'nope']) {
    const root = app({ '.clarusjs/components.json': text })
    expect(readComponentNames(root), text).toBeUndefined()
  }
  const root = app({ '.clarusjs/components.json': '{"dirs":[5],"names":{"a-b":5,"c-d":[],"ui-tabs":"@acme/ui/tabs.tscl","e-f":["/a.tscl","/b.tscl"]}}' })
  expect(readComponents(root)).toEqual({ names: { 'ui-tabs': '@acme/ui/tabs.tscl', 'e-f': ['/a.tscl', '/b.tscl'] } })
})
