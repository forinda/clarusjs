// #21: `clarusjs check` type-checks a project's .clarus files and reports file.clarus:line:col.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { expect, test } from 'vitest'
import { check } from '../../src/cli/check.ts'

function project(files: Record<string, string>): string {
  const root = mkdtempSync(resolve(tmpdir(), 'clarus-cli-'))
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(resolve(root, file)), { recursive: true })
    writeFileSync(resolve(root, file), text)
  }
  return root
}
const typescript = resolve(import.meta.dirname, '../../node_modules/typescript')

test('a clean project passes', () => {
  const root = project({
    'src/components/badge.clarus': '@input label: string\n<b>{{ label }}</b>\n',
    'src/pages/index.clarus': `@import badge from '../components/badge.clarus'\n<badge [label]="'hi'" />\n`,
  })
  const result = check({ root, typescript })
  expect(result.diagnostics).toEqual([])
  expect(result.exitCode).toBe(0)
})

test('errors are reported per template position, with a text and a JSON form', () => {
  const root = project({
    'src/domain/user.ts': 'export interface User { name: string }\n',
    'src/pages/index.clarus': `@import type { User } from '../domain/user'\n@input user: User\n<h1>{{ user.nmae }}</h1>\n`,
  })
  const result = check({ root, typescript })
  expect(result.exitCode).toBe(1)
  expect(result.diagnostics).toEqual([
    { file: 'src/pages/index.clarus', line: 3, column: 13, code: 'TS2339', message: expect.stringContaining("Property 'nmae' does not exist") },
  ])
  expect(result.text).toMatch(/^src\/pages\/index\.clarus:3:13 error TS2339: Property 'nmae' does not exist/m)
  expect(JSON.parse(result.json)).toEqual(result.diagnostics)
})

test('template syntax errors are reported the same way', () => {
  const root = project({ 'src/pages/index.clarus': '<p>a</p>\n<div>\n  <span>\n' })
  const result = check({ root, typescript })
  expect(result.exitCode).toBe(1)
  expect(result.diagnostics).toEqual([expect.objectContaining({ file: 'src/pages/index.clarus', line: 3, column: 3, code: 'clarus', message: expect.stringContaining('unclosed <span>') })])
})

test('errors in plain .ts files of the project are reported too', () => {
  const root = project({
    'src/stores/n.ts': 'export const n: number = "x"\n',
    'src/pages/index.clarus': '<p>ok</p>\n',
  })
  const result = check({ root, typescript })
  expect(result.diagnostics).toEqual([expect.objectContaining({ file: 'src/stores/n.ts', line: 1, column: 14, code: 'TS2322' })])
})

test('untyped parameters in island scripts are fine (scripts are JavaScript)', () => {
  const root = project({
    'src/components/c.clarus': `<script>\n  let xs = state([1])\n  function remove(x) { xs = xs.filter((i) => i !== x) }\n</script>\n<b (click)="remove(1)">{{ xs.length }}</b>\n`,
  })
  expect(check({ root, typescript }).diagnostics).toEqual([])
})

test('a project tsconfig is extended', () => {
  const root = project({
    'tsconfig.json': JSON.stringify({ compilerOptions: { strict: true, noUncheckedIndexedAccess: true } }),
    'src/pages/index.clarus': '@input xs: string[]\n<p>{{ xs[0].length }}</p>\n',
  })
  expect(check({ root, typescript }).diagnostics).toEqual([expect.objectContaining({ file: 'src/pages/index.clarus', line: 2, column: 7 })])
})
