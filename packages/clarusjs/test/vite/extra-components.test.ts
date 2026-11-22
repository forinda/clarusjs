// Components other plugins name (api.clarusComponents): found like the ones under src/, so their styles and islands
// are built, wherever they are (a docs theme's replacement for one of its parts, #363).
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createBuilder, type Plugin } from 'vite'
import { expect, test } from 'vitest'
import clarusjs from '../../src/vite/plugin.ts'

test("a component another plugin names: its styles and client chunk are built, though no page imports it by path", async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'clarus-extra-'))
  const w = (path: string, text: string) => { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }
  w('src/pages/index.tscl', '<h1>Home</h1>\n')
  w('theme/badge.tscl', '<script>\n  let n = state(0)\n</script>\n<button type="button" (click)="n++">{{ n }}</button>\n<style scoped>\n  :scope { letter-spacing: 3.25px; }\n</style>\n')
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '../..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  // Nested, as Vite allows plugins to be (a plugin returning an array).
  const theme: Plugin = { name: 'theme', api: { clarusComponents: (appRoot: string) => [resolve(appRoot, 'theme/badge.tscl')] } }
  await (await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [[theme], clarusjs()] })).buildApp()
  const assets = resolve(root, 'dist/client/assets')
  const files = (readdirSync(assets, { recursive: true }) as string[]).filter((f) => statSync(resolve(assets, f)).isFile())
  expect(files.map((f) => readFileSync(resolve(assets, f), 'utf8')).join('\n')).toContain('3.25px')
  expect(files.some((f) => /(^|\/)badge-[\w-]+\.js$/.test(f))).toBe(true) // its island chunk
}, 120_000)
