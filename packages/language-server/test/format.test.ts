// #303: Format Document runs the project's own Prettier with @clarusjs/prettier-plugin, in a trusted workspace only.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { loadFormatter } from '../src/format.ts'

/** A project with fake node_modules/prettier (recording its calls) and, unless `plugin` is false, the plugin. */
function project({ plugin = true } = {}): string {
  const root = mkdtempSync(resolve(tmpdir(), 'cl-ls-format-'))
  writeFileSync(resolve(root, 'package.json'), '{"name":"app"}')
  writeFileSync(resolve(root, '.prettierrc'), '{"semi":false}')
  const prettier = resolve(root, 'node_modules/prettier')
  mkdirSync(prettier, { recursive: true })
  writeFileSync(resolve(prettier, 'package.json'), JSON.stringify({ name: 'prettier', type: 'module', exports: { '.': './index.js' } }))
  writeFileSync(resolve(prettier, 'index.js'), `globalThis.__clPrettier = (globalThis.__clPrettier ?? 0) + 1
export const resolveConfigFile = async (file) => globalThis.__clConfigFile ?? null
import { readFileSync } from 'node:fs'
export const resolveConfig = async (file, opts) => ({ ...JSON.parse(readFileSync(opts.config, 'utf8')), from: file, config: opts?.config, editorconfig: opts?.editorconfig, ...(globalThis.__clPlugins ? { plugins: globalThis.__clPlugins } : {}) })
export const getFileInfo = async (file, opts) => ({ ignored: globalThis.__clIgnored === true, ignorePath: opts?.ignorePath })
export const clearConfigCache = async () => { globalThis.__clCleared = (globalThis.__clCleared ?? 0) + 1 }
export const format = async (text, options) => JSON.stringify({ text, options })`)
  if (plugin) {
    const p = resolve(root, 'node_modules/@clarusjs/prettier-plugin')
    mkdirSync(p, { recursive: true })
    writeFileSync(resolve(p, 'package.json'), JSON.stringify({ name: '@clarusjs/prettier-plugin', type: 'module', exports: { '.': './index.js' } }))
    writeFileSync(resolve(p, 'index.js'), 'export const languages = []')
  }
  const other = resolve(root, 'node_modules/prettier-plugin-other')
  mkdirSync(other, { recursive: true })
  writeFileSync(resolve(other, 'package.json'), JSON.stringify({ name: 'prettier-plugin-other', type: 'module', exports: { '.': './index.js' } }))
  writeFileSync(resolve(other, 'index.js'), 'export const languages = []')
  return root
}

test('trusted, with prettier and the plugin: the project\'s Prettier, its config, the plugin and the tscl parser', async () => {
  const root = project()
  const format = await loadFormatter(root, true, () => {})
  const file = resolve(root, 'src/a.tscl')
  ;(globalThis as { __clConfigFile?: string }).__clConfigFile = resolve(root, '.prettierrc')
  const out = JSON.parse(await format!('<p>x</p>', file).finally(() => delete (globalThis as { __clConfigFile?: string }).__clConfigFile))
  expect(out.text).toBe('<p>x</p>')
  expect(out.options).toMatchObject({ semi: false, from: file, filepath: file, parser: 'tscl' })
  expect(out.options.plugins).toEqual([expect.stringContaining('@clarusjs/prettier-plugin')])
})

test('untrusted: no formatting, and the project\'s prettier is never imported', async () => {
  const before = (globalThis as { __clPrettier?: number }).__clPrettier
  expect(await loadFormatter(project(), false, () => {})).toBeUndefined()
  expect((globalThis as { __clPrettier?: number }).__clPrettier).toBe(before)
})

test('trusted, but no plugin (or no prettier): no formatting, and the log says why', async () => {
  const logs: string[] = []
  expect(await loadFormatter(project({ plugin: false }), true, (m) => logs.push(m))).toBeUndefined()
  const empty = mkdtempSync(resolve(tmpdir(), 'cl-ls-format-empty-'))
  expect(await loadFormatter(empty, true, (m) => logs.push(m))).toBeUndefined()
  expect(logs.join('\n')).toMatch(/@clarusjs\/prettier-plugin/)
  expect(logs.join('\n')).toMatch(/prettier/)
})

test('a Prettier config outside the trusted folder is never used (its plugins would run): no config then', async () => {
  const root = project()
  const format = await loadFormatter(root, true, () => {})
  const file = resolve(root, 'src/a.tscl')
  const g = globalThis as { __clConfigFile?: string }
  try {
    g.__clConfigFile = resolve(root, '..', '.prettierrc') // found above the folder
    const outside = JSON.parse(await format!('<p>x</p>', file))
    expect(outside.options.semi).toBeUndefined()
    expect(outside.options.plugins).toEqual([expect.stringContaining('@clarusjs/prettier-plugin')])
    g.__clConfigFile = resolve(root, '.prettierrc') // inside: used, from that file
    const inside = JSON.parse(await format!('<p>x</p>', file))
    expect(inside.options).toMatchObject({ semi: false, config: resolve(root, '.prettierrc') })
  } finally {
    delete g.__clConfigFile
  }
})

type G = { __clConfigFile?: string; __clPlugins?: string[]; __clIgnored?: boolean; __clCleared?: number }
const g = globalThis as G
const run = async (setup: Partial<G>) => {
  const root = project()
  const format = await loadFormatter(root, true, () => {})
  Object.assign(g, { __clConfigFile: resolve(root, '.prettierrc') }, setup)
  try {
    const out = await format!('<p>x</p>', resolve(root, 'src/a.tscl'))
    return { root, out: out === '<p>x</p>' ? undefined : JSON.parse(out) }
  } finally {
    delete g.__clConfigFile; delete g.__clPlugins; delete g.__clIgnored
  }
}

test('plugins named in the config resolve from the project (not the server\'s folder); the clarusjs plugin once', async () => {
  const { root, out } = await run({ __clPlugins: ['@clarusjs/prettier-plugin', 'prettier-plugin-other', './local.js'] })
  expect(out.options.plugins).toEqual([
    resolve(root, 'node_modules/prettier-plugin-other/index.js'),
    resolve(root, 'local.js'),
    resolve(root, 'node_modules/@clarusjs/prettier-plugin/index.js'),
  ])
})

test('as the CLI: .editorconfig counts, a file in .prettierignore is left alone, and config edits are seen', async () => {
  const before = g.__clCleared ?? 0
  const { out } = await run({})
  expect(out.options.editorconfig).toBe(true)
  expect((g.__clCleared ?? 0) - before).toBe(1)
  expect((await run({ __clIgnored: true })).out).toBeUndefined()
})

test('.editorconfig applies with no Prettier config (still never one from outside the folder)', async () => {
  const { out } = await run({ __clConfigFile: undefined })
  expect(out.options.editorconfig).toBe(true)
  expect(out.options.semi).toBeUndefined()
})
