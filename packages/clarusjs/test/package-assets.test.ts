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
