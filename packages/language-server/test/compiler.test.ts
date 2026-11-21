// Which compiler the server runs: the project's own clarusjs in a trusted workspace (when it has both compile and
// parse), else the one bundled with the server; never a mix, and never the project's code without trust.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { loadCompiler } from '../src/compiler.ts'

/** A project whose node_modules/clarusjs/compiler.js is `code`. */
function project(code: string): string {
  const root = mkdtempSync(resolve(tmpdir(), 'cl-ls-compiler-'))
  writeFileSync(resolve(root, 'package.json'), '{"name":"app"}')
  const pkg = resolve(root, 'node_modules/clarusjs')
  mkdirSync(pkg, { recursive: true })
  writeFileSync(resolve(pkg, 'package.json'), JSON.stringify({ name: 'clarusjs', type: 'module', exports: { './compiler': './compiler.js' } }))
  writeFileSync(resolve(pkg, 'compiler.js'), code)
  return root
}

test('trusted, and the project\'s compiler has compile and parse: the project\'s', async () => {
  const root = project('export const compile = () => ({ code: "project" }); export const parse = () => ({}); export class ClarusError extends Error {}')
  const logs: string[] = []
  const c = await loadCompiler(root, true, (m) => logs.push(m))
  expect(c.source).toBe('project')
  expect(c.compile('', { file: 'a.tscl', target: 'client' }).code).toBe('project')
  expect(logs.join('\n')).toMatch(/project/)
})

test('untrusted: the bundled compiler, and the project\'s module is never imported', async () => {
  const root = project('globalThis.__clImported = true; export const compile = () => {}; export const parse = () => {}; export class ClarusError extends Error {}')
  const c = await loadCompiler(root, false, () => {})
  expect(c.source).toBe('bundled')
  expect((globalThis as { __clImported?: boolean }).__clImported).toBeUndefined()
})

test('trusted, but too old (no parse) or missing: the bundled compiler for both, logged', async () => {
  const logs: string[] = []
  expect((await loadCompiler(project('export const compile = () => {}; export class ClarusError extends Error {}'), true, (m) => logs.push(m))).source).toBe('bundled')
  expect(logs.join('\n')).toMatch(/bundled/)
  const empty = mkdtempSync(resolve(tmpdir(), 'cl-ls-empty-'))
  expect((await loadCompiler(empty, true, () => {})).source).toBe('bundled')
})
