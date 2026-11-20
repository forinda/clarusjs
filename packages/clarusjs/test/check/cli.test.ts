// #21: `clarusjs check` type-checks a project's .tscl files and reports file.tscl:line:col.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
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
    'src/components/badge.tscl': '@input label: string\n<b>{{ label }}</b>\n',
    'src/pages/index.tscl': `@import badge from '../components/badge.tscl'\n<badge [label]="'hi'" />\n`,
  })
  const result = check({ root, typescript })
  expect(result.diagnostics).toEqual([])
  expect(result.exitCode).toBe(0)
})

test('errors are reported per template position, with a text and a JSON form', () => {
  const root = project({
    'src/domain/user.ts': 'export interface User { name: string }\n',
    'src/pages/index.tscl': `@import type { User } from '../domain/user'\n@input user: User\n<h1>{{ user.nmae }}</h1>\n`,
  })
  const result = check({ root, typescript })
  expect(result.exitCode).toBe(1)
  expect(result.diagnostics).toEqual([
    { file: 'src/pages/index.tscl', line: 3, column: 13, code: 'TS2339', message: expect.stringContaining("Property 'nmae' does not exist") },
  ])
  expect(result.text).toMatch(/^src\/pages\/index\.tscl:3:13 error TS2339: Property 'nmae' does not exist/m)
  expect(JSON.parse(result.json)).toEqual(result.diagnostics)
})

test('template syntax errors are reported the same way', () => {
  const root = project({ 'src/pages/index.tscl': '<p>a</p>\n<div>\n  <span>\n' })
  const result = check({ root, typescript })
  expect(result.exitCode).toBe(1)
  expect(result.diagnostics).toEqual([expect.objectContaining({ file: 'src/pages/index.tscl', line: 3, column: 3, code: 'clarus', message: expect.stringContaining('unclosed <span>') })])
})

test('errors in plain .ts files of the project are reported too', () => {
  const root = project({
    'src/stores/n.ts': 'export const n: number = "x"\n',
    'src/pages/index.tscl': '<p>ok</p>\n',
  })
  const result = check({ root, typescript })
  expect(result.diagnostics).toEqual([expect.objectContaining({ file: 'src/stores/n.ts', line: 1, column: 14, code: 'TS2322' })])
})

test('untyped parameters in island scripts are fine (scripts are JavaScript)', () => {
  const root = project({
    'src/components/c.tscl': `<script>\n  let xs = state([1])\n  function remove(x) { xs = xs.filter((i) => i !== x) }\n</script>\n<b (click)="remove(1)">{{ xs.length }}</b>\n`,
  })
  expect(check({ root, typescript }).diagnostics).toEqual([])
})

test('a project tsconfig is extended', () => {
  const root = project({
    'tsconfig.json': JSON.stringify({ compilerOptions: { strict: true, noUncheckedIndexedAccess: true } }),
    'src/pages/index.tscl': '@input xs: string[]\n<p>{{ xs[0].length }}</p>\n',
  })
  expect(check({ root, typescript }).diagnostics).toEqual([expect.objectContaining({ file: 'src/pages/index.tscl', line: 2, column: 7 })])
})

test('the command line runs check, with --json and an exit code', async () => {
  const { spawnSync } = await import('node:child_process')
  const root = project({ 'src/pages/index.tscl': '@input n: number\n<p>{{ n.foo }}</p>\n' })
  const cli = resolve(import.meta.dirname, '../../src/cli/index.ts')
  const run = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', cli, 'check', root, '--json'], { encoding: 'utf8' })
  expect(run.status).toBe(1)
  expect(JSON.parse(run.stdout)).toEqual([expect.objectContaining({ file: 'src/pages/index.tscl', line: 2, column: 9, code: 'TS2339' })])
  const help = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', cli, '--help'], { encoding: 'utf8' })
  expect(help.stdout).toMatch(/check \[options\] \[dir\]/)
})

test('#23: the type-checking guide shows the real output for its example', () => {
  const guide = readFileSync(resolve(import.meta.dirname, '../../../docs/src/pages/guide/type-checking.tscl'), 'utf8')
  const sample = guide.match(/\{\{-- src\/pages\/index\.tscl --\}\}\n([\s\S]*?)<\/code>/)![1]!
  const shown = guide.match(/\$ pnpm check\n([\s\S]*?)<\/code>/)![1]!
  const root = project({ 'src/nav.ts': `export const nav = [{ title: 'Intro', href: '/intro' }]\n`, 'src/pages/index.tscl': `${sample}\n` })
  const result = check({ root, typescript })
  expect(shown).toBe(`${result.text}\n\n${result.diagnostics.length} error`)
})

test('#31: what load() returns is checked against the page inputs', () => {
  const page = '@input name: string\n@input count: number = 0\n<p>{{ name }} {{ count }}</p>\n'
  const ok = project({
    'src/pages/users/[id].tscl': page,
    'src/pages/users/[id].load.ts': 'export async function load({ params }: { params: Record<string, string> }) {\n  return { name: params.id ?? "" }\n}\n',
  })
  expect(check({ root: ok, typescript }).diagnostics).toEqual([])
  const bad = project({
    'src/pages/users/[id].tscl': page,
    'src/pages/users/[id].load.ts': 'export function load() {\n  return { name: 42 }\n}\n',
  })
  expect(check({ root: bad, typescript }).diagnostics).toEqual([
    { file: 'src/pages/users/[id].tscl', line: 1, column: 1, code: 'TS2322', message: expect.stringMatching(/^load\(\) returns a value that doesn.t fit this page.s inputs: .*not assignable/s) },
  ])
})

test('#22: render() is typed against each view\'s inputs through the generated views.d.ts', () => {
  const root = project({
    'src/components/pill.tscl': '@input text: string\n@input tone: "info" | "tip" = "info"\n<b>{{ text }}</b>\n',
    'src/server/mail.ts': [
      "import { render } from 'clarusjs/views'",
      "export const ok = render('components/pill', { text: 'hi', tone: 'tip' })",
      "export const wrongProp = render('components/pill', { text: 1 })",
      "export const unknown = render('components/pil', {})",
      '',
    ].join('\n'),
  })
  // Like an app that installed clarusjs.
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '../..'), resolve(root, 'node_modules/clarusjs'), 'dir')
  const result = check({ root, typescript })
  expect(existsSync(resolve(root, '.clarusjs/views.d.ts'))).toBe(true)
  expect(result.diagnostics.map((d) => `${d.file}:${d.line} ${d.code}`)).toEqual(['src/server/mail.ts:3 TS2322', 'src/server/mail.ts:4 TS2345'])
})

test('review: views.d.ts is declarations only, so an app tsconfig can include it (noImplicitAny on, relative type imports)', async () => {
  const { spawnSync } = await import('node:child_process')
  const root = project({
    'src/domain/user.ts': 'export interface User { name: string }\n',
    // A JavaScript script with an untyped parameter, and an input typed through a relative @import type.
    'src/components/card.tscl': "@import type { User } from '../domain/user'\n@input user: User\n<script>\n  let n = state(0)\n  function bump(x) { n = n + x }\n</script>\n<b (click)=\"bump(1)\">{{ user.name }} {{ n }}</b>\n",
    'src/server/mail.ts': "import { render } from 'clarusjs/views'\nexport const ok = render('components/card', { user: { name: 'Ada' } })\nexport const bad = render('components/card', { user: { nam: 'Ada' } })\n",
    'tsconfig.json': JSON.stringify({ compilerOptions: { strict: true, noImplicitAny: true, noEmit: true, target: 'ES2023', module: 'ESNext', moduleResolution: 'Bundler', allowImportingTsExtensions: true, skipLibCheck: true }, include: ['src', '.clarusjs/views.d.ts'] }),
  })
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '../..'), resolve(root, 'node_modules/clarusjs'), 'dir')
  check({ root, typescript })
  const registry = readFileSync(resolve(root, '.clarusjs/views.d.ts'), 'utf8')
  expect(registry).not.toContain('virtual/')
  // The app's own tsc, with its own strict settings: only the deliberate mistake is reported.
  const bin = JSON.parse(readFileSync(resolve(typescript, 'package.json'), 'utf8')).bin
  const tsc = resolve(typescript, typeof bin === 'string' ? bin : bin.tsc)
  const run = spawnSync(process.execPath, [tsc, '-p', root, '--pretty', 'false'], { cwd: root, encoding: 'utf8' })
  const errors = run.stdout.split('\n').filter((l) => l.includes('error TS'))
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatch(/^src\/server\/mail\.ts\(3,.*'nam' does not exist/)
})
