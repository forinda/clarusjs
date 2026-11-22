// #197: development-only warnings never reach production assets (they are behind import.meta.env.DEV).
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createBuilder } from 'vite'
import { expect, test } from 'vitest'
import clarusjs from '../../src/vite/plugin.ts'

test('vite build: the @for duplicate-key warning is left out of production assets', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'clarus-devonly-'))
  const w = (path: string, text: string) => { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }
  w('src/components/list.tscl', '<script>\n  let items = state(["a", "b"])\n</script>\n<ul>@for (item of items; track item) {<li>{{ item }}</li>}</ul>\n')
  w('src/pages/index.tscl', "@import list from '../components/list.tscl'\n<list />\n")
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '../..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  const quiet = { info() {}, warn() {}, warnOnce() {}, error() {}, clearScreen() {}, hasErrorLogged: () => false, hasWarned: false }
  // As `vite build` runs: vitest sets NODE_ENV=test, which Vite would treat as development.
  const env = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  try {
    await (await createBuilder({ root, configFile: false, customLogger: quiet, plugins: [clarusjs()] })).buildApp()
  } finally {
    process.env.NODE_ENV = env
  }
  const dir = resolve(root, 'dist/client/assets')
  const js = (readdirSync(dir, { recursive: true }) as string[]).filter((f) => f.endsWith('.js')).map((f) => readFileSync(resolve(dir, f), 'utf8')).join('\n')
  expect(js).toContain('[r') // the @for runtime (its row marker) is in the build
  expect(js).not.toContain('duplicate key')
}, 60_000)
