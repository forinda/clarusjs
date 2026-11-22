// #228: the declarations clarusjs check writes (.clarusjs/views.d.ts, routes.d.ts) type-check on their own under strict
// options, for the test fixtures and the docs site: a malformed generated declaration fails here even when no check
// test reads it.
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { expect, test } from 'vitest'
import { routesDeclaration, viewsDeclaration } from '../../src/check/generate.ts'

const typescript = resolve(import.meta.dirname, '../../node_modules/typescript')
const projects = ['test/fixtures/site', 'test/fixtures/site-modes', 'test/fixtures/site-cjs', 'test/fixtures/mapper-app', '../docs'].map((p) => resolve(import.meta.dirname, '../..', p))

const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.') ? [] : walk(resolve(dir, e.name))) : [resolve(dir, e.name)]))

/** Strict tsc on `views` and `routes` written one level below `root` (like .clarusjs/): errors in those two files. */
function strictErrors(root: string, views: string, routes: string): string[] {
  const out = resolve(root, '.clarusjs-strict')
  mkdirSync(out, { recursive: true })
  try {
    writeFileSync(resolve(out, 'views.d.ts'), views)
    writeFileSync(resolve(out, 'routes.d.ts'), routes)
    writeFileSync(resolve(out, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { strict: true, noUnusedLocals: true, noUnusedParameters: true, noEmit: true, target: 'ES2023', module: 'ESNext', moduleResolution: 'Bundler', allowImportingTsExtensions: true, skipLibCheck: false, types: [] }, // skipLibCheck would skip the .d.ts files themselves
      files: ['views.d.ts', 'routes.d.ts'],
    }))
    const bin = JSON.parse(readFileSync(resolve(typescript, 'package.json'), 'utf8')).bin
    const tsc = resolve(typescript, typeof bin === 'string' ? bin : bin.tsc)
    const run = spawnSync(process.execPath, [tsc, '-p', out, '--pretty', 'false'], { cwd: out, encoding: 'utf8' })
    expect(run.stdout + run.stderr).not.toMatch(/error TS(6053|18003|5083)/) // the files and config were really read
    // Only what's wrong in the generated files: a source file they import is its own project's business.
    return run.stdout.split('\n').filter((l) => /^(views|routes)\.d\.ts\(/.test(l))
  } finally {
    rmSync(out, { recursive: true, force: true })
  }
}

test('the harness reports a malformed declaration (so the checks below can fail)', () => {
  const root = resolve(import.meta.dirname, '../fixtures/site')
  const bad = "declare namespace __cl_v0 {\n  type Unused = string\n  interface Inputs { title: Strin }\n}\ndeclare module 'clarusjs/views' {\n  interface Views { x: __cl_v0.Inputs }\n}\nexport {}\n"
  const errors = strictErrors(root, bad, routesDeclaration([]))
  expect(errors.join('\n')).toMatch(/Strin/)
})

test.each(projects.map((p) => [relative(resolve(import.meta.dirname, '../../..'), p), p]))('%s: views.d.ts and routes.d.ts pass strict tsc', (_, root) => {
  const files = walk(resolve(root, 'src')).map((f) => relative(root, f).replace(/\\/g, '/'))
  const views = files.filter((f) => f.endsWith('.tscl')).map((file) => ({ file, source: readFileSync(resolve(root, file), 'utf8') }))
  expect(views.length).toBeGreaterThan(0)
  expect(strictErrors(root, viewsDeclaration(views), routesDeclaration(files))).toEqual([])
}, 60_000)

test('views.d.ts: a type import from ~/ (src/) is written from .clarusjs/, so it resolves without a paths entry', () => {
  const out = viewsDeclaration([{ file: 'src/components/table.tscl', source: "@import type { Row } from '~/explained.ts'\n@input rows: Row[]\n<p>{{ rows.length }}</p>\n" }])
  expect(out).toContain('import("../src/explained.ts")')
  expect(out).not.toContain('~/')
})
