// #362: the contract a theme implements. LayoutInputs is what a site's layout passes; the theme's layout.tscl takes
// exactly that; and the minimal theme in the "Writing a theme" guide builds and type-checks as a site's theme.
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createBuilder } from 'vite'
import { expect, test } from 'vitest'
import { parse } from 'clarusjs/compiler'
import clarusjs from 'clarusjs/vite'
import { check } from '../node_modules/clarusjs/src/cli/check.ts'
import type { LayoutInputs } from '../src/nav.ts'

test("LayoutInputs is layout.tscl's inputs: the same names, optional where the layout has a default", () => {
  // Every key of the type, so a change to the type shows up here (TypeScript) and in the comparison (the layout).
  const all: { [K in keyof Required<LayoutInputs>]: boolean } = { config: true, title: true, description: false, path: false, source: false, url: false, headings: false, app: false }
  const inputs = parse(readFileSync(resolve(import.meta.dirname, '../src/layout.tscl'), 'utf8'), 'layout.tscl').inputs
  expect(Object.fromEntries(inputs.map((i) => [i.name, i.default === undefined]))).toEqual(all)
})

const guide = readFileSync(resolve(import.meta.dirname, '../../docs/src/pages/guide/writing-a-theme.md'), 'utf8')
/** The code block that starts with this file's {{-- path --}} comment. */
const block = (path: string) => {
  const found = [...guide.matchAll(/```tscl\n\{\{-- ([^ ]+) --\}\}\n([\s\S]*?)```/g)].find((m) => m[1] === path)
  if (!found) throw new Error(`no code block for ${path} in the guide`)
  return found[2]!
}

test("the guide's minimal theme builds as a site's theme, with the theme's slots and sidebar data", async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'theme-contract-'))
  const w = (path: string, text: string) => { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }
  mkdirSync(resolve(root, 'node_modules/@clarusjs'), { recursive: true })
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/@clarusjs/theme-docs'), 'junction')
  symlinkSync(resolve(import.meta.dirname, '../node_modules/clarusjs'), resolve(root, 'node_modules/clarusjs'), 'junction')
  symlinkSync(resolve(import.meta.dirname, '../node_modules/clarusjs/node_modules/typescript'), resolve(root, 'node_modules/typescript'), 'junction')
  // The theme as its own package (node_modules/acme-theme), and a site using it the way it uses the docs theme.
  w('node_modules/acme-theme/package.json', JSON.stringify({ name: 'acme-theme', type: 'module', exports: { './*': './*' } }))
  w('node_modules/acme-theme/layout.tscl', block('acme-theme/layout.tscl'))
  w('src/config.ts', "import type { ThemeConfig } from '@clarusjs/theme-docs/nav.ts'\nexport const config: ThemeConfig = { brand: { text: 'acme' }, sections: [{ key: 'guide', title: 'Guide', href: '/guide/start', groups: [{ title: 'Basics', items: [{ title: 'Start', href: '/guide/start' }] }] }], footer: 'Acme footer' }\n")
  w('src/layouts/docs.tscl', block('src/layouts/docs.tscl'))
  w('src/pages/index.tscl', "@import docs from '../layouts/docs.tscl'\n<docs [title]=\"'Home'\"><h1>Home</h1></docs>\n")
  w('src/pages/guide/start.tscl', "@import docs from '../../layouts/docs.tscl'\n<docs [title]=\"'Start'\" [path]=\"'/guide/start'\" [headings]=\"[{ id: 'one', text: 'One', level: 2 }]\"><h1>Start</h1><h2 id=\"one\">One</h2></docs>\n")
  w('tsconfig.json', JSON.stringify({ compilerOptions: { strict: true, target: 'ES2023', module: 'ESNext', moduleResolution: 'Bundler', lib: ['ES2023', 'DOM'], allowImportingTsExtensions: true, noEmit: true, skipLibCheck: true } }))
  await (await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [clarusjs()] })).buildApp()
  const html = readFileSync(resolve(root, 'dist/client/guide/start/index.html'), 'utf8').replace(/ class="cl-c-[\w-]+"/g, '').replace(/ cl-c-[\w-]+(?=[" ])/g, '')
  expect(html).toContain('<title>Start · acme</title>')
  expect(html).toMatch(/<a href="\/guide\/start" aria-current="page">Start<\/a>/)
  expect(html).toContain('<a href="#one">One</a>')
  expect(html).toContain('<p>Acme footer</p>')
  // And it type-checks: the site passes what LayoutInputs says, the theme takes it.
  expect(check({ root, typescript: resolve(import.meta.dirname, '../node_modules/clarusjs/node_modules/typescript') }).diagnostics.filter((d) => d.severity === 'error')).toEqual([])
}, 180_000)
