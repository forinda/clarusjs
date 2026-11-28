// Components and stylesheets from an installed package, laid out as pnpm installs it (node_modules/.pnpm/…, reached
// through a symlink): their built files must not land in a folder whose name starts with a dot. GitHub Pages' upload
// (actions/upload-pages-artifact) skips hidden folders, so a theme's stylesheet and islands went missing there.
import { mkdirSync, mkdtempSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createBuilder } from 'vite'
import { expect, test } from 'vitest'
import clarusjs from '../src/vite/plugin.ts'

test('files from a pnpm-installed package are emitted outside hidden folders, and the page still loads them', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'clarusjs-pkg-assets-'))
  const w = (path: string, text: string) => { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }
  const pkg = 'node_modules/.pnpm/acme-theme@1.0.0/node_modules/acme-theme'
  w(`${pkg}/package.json`, JSON.stringify({ name: 'acme-theme', version: '1.0.0', type: 'module', exports: { './*': './src/*' } }))
  w(`${pkg}/src/theme.css`, '.acme { color: rebeccapurple }')
  w(`${pkg}/src/counter.tscl`, "@import './theme.css'\n<script>\n  let n = state(0)\n</script>\n<button class=\"acme\" (click)=\"n++\">{{ n }}</button>")
  symlinkSync(resolve(root, pkg), resolve(root, 'node_modules/acme-theme'), 'junction')
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  w('src/pages/index.tscl', "@import counter from 'acme-theme/counter.tscl'\n<html><head><title>Home</title></head><body><counter /></body></html>")
  await (await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [clarusjs()] })).buildApp()
  const out = resolve(root, 'dist/client')
  const emitted = (readdirSync(out, { recursive: true }) as string[]).map((f) => f.split(/[\\/]/))
  expect(emitted.filter((parts) => parts.some((p) => p.startsWith('.'))).map((parts) => parts.join('/'))).toEqual([])
  // the page still links the stylesheet and loads the island, at their new names
  const html = (await import('node:fs')).readFileSync(resolve(out, 'index.html'), 'utf8')
  const sheet = /<link rel="stylesheet" href="\/([^"]+)"/.exec(html)?.[1]
  const island = /<cl-island[^>]* src="\/([^"]+)"/.exec(html)?.[1]
  expect(sheet && island).toBeTruthy()
  for (const file of [sheet!, island!]) expect(emitted.map((parts) => parts.join('/'))).toContain(file)
}, 120_000)

async function buildWith(files: Record<string, string>, links: Record<string, string> = {}, options: Parameters<typeof clarusjs>[0] = {}) {
  const root = mkdtempSync(resolve(tmpdir(), 'clarusjs-pkg-names-'))
  const w = (path: string, text: string) => { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }
  for (const [path, text] of Object.entries(files)) w(path, text)
  mkdirSync(resolve(root, 'node_modules'), { recursive: true })
  for (const [link, target] of Object.entries(links)) symlinkSync(resolve(root, target), resolve(root, link), 'junction')
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  return (await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [clarusjs(options)] })).buildApp()
}
const island = "<script>\n  let n = state(0)\n</script>\n<button (click)=\"n++\">{{ n }}</button>"

test('review (#662): two files that would be built under one name stop the build, naming both (a dot folder beside its _ twin)', async () => {
  await expect(buildWith({
    'src/components/.widgets/counter.tscl': island,
    'src/components/_widgets/counter.tscl': island,
    'src/pages/index.tscl': "@import a from '../components/.widgets/counter.tscl'\n@import b from '../components/_widgets/counter.tscl'\n<html><head><title>H</title></head><body><a /><b /></body></html>",
  })).rejects.toThrow(/src\/components\/\.widgets\/counter\.tscl and src\/components\/_widgets\/counter\.tscl .*same name/)
}, 120_000)

test('review (#662): two versions of one package with islands stop the build, naming both', async () => {
  const pkg = (v: string) => ({
    [`node_modules/.pnpm/acme@${v}/node_modules/acme/package.json`]: JSON.stringify({ name: 'acme', version: v, type: 'module', exports: { './*': './src/*' } }),
    [`node_modules/.pnpm/acme@${v}/node_modules/acme/src/counter.tscl`]: island,
  })
  await expect(buildWith({
    ...pkg('1.0.0'), ...pkg('2.0.0'),
    'node_modules/.pnpm/acme@2.0.0/node_modules/acme/src/uses-old.tscl': "@import old from 'acme-old/counter.tscl'\n<old />",
    'src/pages/index.tscl': "@import a from 'acme/counter.tscl'\n@import b from 'acme/uses-old.tscl'\n<html><head><title>H</title></head><body><a /><b /></body></html>",
  }, {
    'node_modules/acme': 'node_modules/.pnpm/acme@2.0.0/node_modules/acme',
    'node_modules/acme-old': 'node_modules/.pnpm/acme@1.0.0/node_modules/acme',
  })).rejects.toThrow(/acme@1\.0\.0.*and.*acme@2\.0\.0.*same name|acme@2\.0\.0.*and.*acme@1\.0\.0.*same name/)
}, 120_000)

test('review (#662): a component named like one of clarusjs\'s own entries (cl-nav, with fragments on) stops the build too', async () => {
  await expect(buildWith({
    'cl-nav.tscl': island,
    'src/pages/index.tscl': "@import nav from '../../cl-nav.tscl'\n<html><head><title>H</title></head><body><nav /></body></html>",
  }, {}, { fragments: true })).rejects.toThrow(/cl-nav\.tscl .*same name "cl-nav"/)
}, 120_000)

test('review (#662): a component at the app root named constructor builds (the entry names hold no inherited keys)', async () => {
  await expect(buildWith({
    'constructor.tscl': island,
    'src/pages/index.tscl': "@import thing from '../../constructor.tscl'\n<html><head><title>H</title></head><body><thing /></body></html>",
  })).resolves.toBeUndefined()
}, 120_000)
