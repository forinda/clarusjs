// The published package is the built dist/, not src/. Build it once and check it works on its own.
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, expect, test } from 'vitest'

const pkgDir = resolve(import.meta.dirname, '..')
const dist = resolve(pkgDir, 'dist')

beforeAll(() => {
  execSync('pnpm build', { cwd: pkgDir, stdio: 'pipe' })
}, 120_000)

test('every published export points at a built file with types', () => {
  const pkg = JSON.parse(readFileSync(`${pkgDir}/package.json`, 'utf8'))
  const exports = pkg.publishConfig.exports as Record<string, { types: string; default: string }>
  expect(Object.keys(exports).sort()).toEqual(Object.keys(pkg.exports).sort())
  for (const entry of Object.values(exports)) {
    expect(existsSync(`${pkgDir}/${entry.default}`)).toBe(true)
    expect(existsSync(`${pkgDir}/${entry.types}`)).toBe(true)
  }
})

test('built JS has no .ts import specifiers', () => {
  const plugin = readFileSync(`${dist}/vite/plugin.js`, 'utf8')
  const compiler = readFileSync(`${dist}/compiler/index.js`, 'utf8')
  expect(plugin + compiler).not.toMatch(/from ['"][^'"]+\.ts['"]/)
})

test('built compiler compiles a component', async () => {
  const { compile } = await import(`${dist}/compiler/index.js`)
  const out = compile('<script>let n = state(0)</script>\n<b (click)="n++">{{ n }}</b>', { file: 'c.clarus', target: 'client' })
  expect(out.code).toContain('export function attach')
})

test('built Vite plugin points at built runtime files that exist', async () => {
  const { default: clarusjs } = await import(`${dist}/vite/plugin.js`)
  const plugin = clarusjs()
  const aliases = plugin.config({}, { command: 'serve', mode: 'development' }).resolve.alias as { find: string; replacement: string }[]
  for (const a of aliases) {
    expect(a.replacement.startsWith(dist)).toBe(true)
    expect(existsSync(a.replacement)).toBe(true)
  }
  const loader = plugin.resolveId('/cl-loader.js')
  expect(loader).toBe(`${dist}/runtime/loader.js`)
  expect(existsSync(loader)).toBe(true)
  const entry = plugin.load('\0virtual:clarusjs/server-entry') as string
  expect(entry).toContain(`${dist}/server/handler.js`)
})
