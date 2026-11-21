// #142: clarusjs check reads the page sources and Vite aliases from the app's own Vite config.
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { loadProject } from '../../src/cli/project.ts'

function app(config: string | null): string {
  const root = mkdtempSync(resolve(tmpdir(), 'clarus-project-'))
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '../..'), resolve(root, 'node_modules/clarusjs'), 'dir')
  writeFileSync(resolve(root, 'package.json'), '{ "type": "module" }')
  if (config) writeFileSync(resolve(root, 'vite.config.ts'), config)
  return root
}

test('the clarusjs plugin\'s sources and resolve.alias, from vite.config.ts (plugins nested in arrays too)', async () => {
  const root = app([
    "import clarusjs from 'clarusjs/vite'",
    "const page = { extension: '.page', toTscl: (code) => code }",
    "export default { resolve: { alias: { '@ui': '/abs/ui' } }, plugins: [[clarusjs({ sources: [page] })]] }",
    '',
  ].join('\n'))
  const project = await loadProject(root)
  expect(project.sources.map((s) => s.extension)).toEqual(['.page'])
  expect(project.viteAliases).toEqual({ '@ui': '/abs/ui' })
})

test('without a Vite config, or without the plugin in it: no sources', async () => {
  expect(await loadProject(app(null))).toEqual({ sources: [], viteAliases: undefined })
  expect((await loadProject(app('export default { plugins: [] }\n'))).sources).toEqual([])
})
