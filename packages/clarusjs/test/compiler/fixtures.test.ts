// #226: the compiler's exact output, as fixture folders. Each folder under test/compiler/fixtures/ holds input.tscl
// and what it compiles to: server.js, client.js, and check.txt (clarusjs check's diagnostics, `line:col code message`).
// The input is compiled as src/components/<folder>.tscl. To accept a change in output, run
//   UPDATE=1 pnpm --filter clarusjs exec vitest run test/compiler/fixtures.test.ts
// and review the diff of the expected files in the PR.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { check } from '../../src/cli/check.ts'
import { compile } from '../../src/compiler/index.ts'

const dir = resolve(import.meta.dirname, 'fixtures')
const typescript = resolve(import.meta.dirname, '../../node_modules/typescript')
const update = process.env.UPDATE === '1'

/** `expected` matches the file `path`; with UPDATE=1 the file is (re)written instead. */
function matches(path: string, actual: string): void {
  if (update || !existsSync(path)) {
    if (!update) throw new Error(`${path} is missing: run with UPDATE=1 to write it`)
    writeFileSync(path, actual)
    return
  }
  expect(actual, path).toBe(readFileSync(path, 'utf8'))
}

/** clarusjs check on a project holding just this component: its diagnostics, one per line. */
function diagnostics(name: string, source: string): string {
  const root = mkdtempSync(resolve(tmpdir(), 'clarusjs-fixture-'))
  mkdirSync(resolve(root, 'src/components'), { recursive: true })
  writeFileSync(resolve(root, `src/components/${name}.tscl`), source)
  return check({ root, typescript }).diagnostics.map((d) => `${d.line}:${d.column} ${d.code} ${d.message}\n`).join('')
}

const cases = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)

test('there are fixtures', () => {
  expect(cases.length).toBeGreaterThan(0)
})

test.each(cases)('%s', (name) => {
  const source = readFileSync(resolve(dir, name, 'input.tscl'), 'utf8')
  const file = `src/components/${name}.tscl`
  matches(resolve(dir, name, 'server.js'), compile(source, { file, target: 'server', clientUrl: `/${file}?import` }).code)
  matches(resolve(dir, name, 'client.js'), compile(source, { file, target: 'client' }).code)
  matches(resolve(dir, name, 'check.txt'), diagnostics(name, source))
}, 60_000)
