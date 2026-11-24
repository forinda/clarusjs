// #458: automatic component imports in a real build: a page uses components by name, islands and styles included.
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createBuilder } from 'vite'
import { beforeAll, expect, test } from 'vitest'
import clarusjs from '../src/vite/plugin.ts'

let root: string
const warnings: string[] = []
const html = (route = '') => readFileSync(resolve(root, 'dist/client', route, 'index.html'), 'utf8')

beforeAll(async () => {
  root = mkdtempSync(resolve(tmpdir(), 'clarus-auto-'))
  const w = (path: string, text: string) => { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }
  w('src/components/forms/text-field.tscl', '@input label: string\n<label class="field">{{ label }} <input /></label>\n<style scoped>\n  :scope { color: rgb(1, 2, 3); }\n</style>\n')
  w('src/components/like-button.tscl', '<script>\n  let n = state(0)\n</script>\n<button (click)="n++">♥ {{ n }}</button>\n')
  w('src/components/Legacy.tscl', '<p>legacy</p>\n')
  w('src/pages/index.tscl', '<main>\n  <text-field [label]="\'Name\'" />\n  <forms-text-field [label]="\'Email\'" />\n  <like-button />\n  <my-widget></my-widget>\n</main>\n')
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  await (await createBuilder({
    root, configFile: false, plugins: [clarusjs()],
    customLogger: { info() {}, warn: (m: string) => warnings.push(m), warnOnce: (m: string) => warnings.push(m), error() {}, clearScreen() {}, hasErrorLogged: () => false, hasWarned: false } as never,
  })).buildApp()
}, 120_000)

test('a page uses components by their names: short and full, without @import', () => {
  const page = html()
  expect(page).toMatch(/<label class="field[^"]*">Name <input/)
  expect(page).toMatch(/<label class="field[^"]*">Email <input/)
  expect(page).toContain('<my-widget') // not a component: stays HTML
})

test('an automatic island ships and its styles are bundled', () => {
  const page = html()
  expect(page).toMatch(/<cl-island c="[^"]*like-button[^"]*"/)
  const css = readFileSync(resolve(root, 'dist/client', page.match(/href="\/([^"]+\.css)"/)![1]!), 'utf8')
  expect(css).toContain('.cl-c-text-field') // the component's scoped style
})

test('a file that isn\'t kebab-case is named in a warning', () => {
  expect(warnings.join('\n')).toMatch(/src\/components\/Legacy\.tscl.*kebab-case/)
})
