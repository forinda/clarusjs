// Component libraries (auto-imports from installed packages): the app lists them, each describes itself in its
// package.json, and the names go to .clarusjs/components.json for the editor.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { expect, test } from 'vitest'
import { componentNames, readComponentNames, resolveLibraries } from '../../src/vite/libraries.ts'

function app(files: Record<string, string>): string {
  const root = mkdtempSync(resolve(tmpdir(), 'cl-libs-'))
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(resolve(root, file)), { recursive: true })
    writeFileSync(resolve(root, file), text)
  }
  return root
}
const lib = {
  'node_modules/@acme/ui/package.json': JSON.stringify({ name: '@acme/ui', clarusjs: { components: './src', prefix: 'acme' } }),
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
  expect(JSON.parse(readFileSync(resolve(root, '.clarusjs/components.json'), 'utf8'))).toEqual({ names })
  expect(readComponentNames(root)).toEqual(names)
  expect(componentNames(root, { auto: false })).toBeUndefined()
  expect(readComponentNames(app({}))).toBeUndefined()
})
