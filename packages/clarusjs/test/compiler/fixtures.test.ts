// #226: the compiler's exact output, as fixture folders. Each folder under test/compiler/fixtures/ holds input.tscl
// and what it compiles to: server.js, client.js, and check.txt (clarusjs check's diagnostics, `line:col code message`).
// The input is compiled as src/components/<folder>.tscl; a `components/` folder beside it holds other components it
// uses by name (#458), as src/components/<path>.tscl. To accept a change in output, run
//   UPDATE=1 pnpm --filter clarusjs exec vitest run test/compiler/fixtures.test.ts
// and review the diff of the expected files in the PR.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { check } from '../../src/cli/check.ts'
import { compile } from '../../src/compiler/index.ts'
import { COMPONENT_DIRS, componentIndex } from '../../src/compiler/components.ts'
import { resolveIcon } from '../../src/icons.ts'

const dir = resolve(import.meta.dirname, 'fixtures')
const typescript = resolve(import.meta.dirname, '../../node_modules/typescript')
const update = process.env.UPDATE === '1'
/** A small icon set (@iconify-json/test) installed in `root`, for fixtures that use <icon>. */
function iconSet(root: string): void {
  const set = resolve(root, 'node_modules/@iconify-json/test')
  mkdirSync(set, { recursive: true })
  writeFileSync(resolve(set, 'package.json'), JSON.stringify({ name: '@iconify-json/test', exports: { './icons.json': './icons.json' } }))
  writeFileSync(resolve(set, 'icons.json'), JSON.stringify({ prefix: 'test', width: 24, height: 24, icons: { rocket: { body: '<path d="M4 20 20 4"/>' } } }))
  if (!existsSync(resolve(root, 'package.json'))) writeFileSync(resolve(root, 'package.json'), '{}')
}
const icons = mkdtempSync(resolve(tmpdir(), 'clarusjs-fixture-icons-'))
iconSet(icons)
const icon = (name: string) => resolveIcon(name, resolve(icons, 'src/components/x.tscl'))

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
  for (const [path, text] of Object.entries(others(name))) {
    mkdirSync(resolve(root, path, '..'), { recursive: true })
    writeFileSync(resolve(root, path), text)
  }
  iconSet(root)
  // As an app has it: clarusjs installed (@transition's options are typed from clarusjs/motion).
  symlinkSync(resolve(import.meta.dirname, '../..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  writeFileSync(resolve(root, `src/components/${name}.tscl`), source)
  return check({ root, typescript }).diagnostics.map((d) => `${d.line}:${d.column} ${d.code} ${d.message}\n`).join('')
}

/** The fixture's other components (#458), by their path in the project. */
function others(name: string): Record<string, string> {
  const folder = resolve(dir, name, 'components')
  if (!existsSync(folder)) return {}
  const files = (readdirSync(folder, { recursive: true }) as string[]).filter((f) => f.endsWith('.tscl'))
  return Object.fromEntries(files.map((f) => [`src/components/${f.split('\\').join('/')}`, readFileSync(resolve(folder, f), 'utf8')]))
}

const cases = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)

test('there are fixtures', () => {
  expect(cases.length).toBeGreaterThan(0)
})

test.each(cases)('%s', (name) => {
  const source = readFileSync(resolve(dir, name, 'input.tscl'), 'utf8')
  const file = `src/components/${name}.tscl`
  const components = componentIndex(Object.keys(others(name)), COMPONENT_DIRS).names
  matches(resolve(dir, name, 'server.js'), compile(source, { file, target: 'server', clientUrl: `/${file}?import`, icon, components }).code)
  matches(resolve(dir, name, 'client.js'), compile(source, { file, target: 'client', icon, components }).code)
  matches(resolve(dir, name, 'check.txt'), diagnostics(name, source))
}, 60_000)
