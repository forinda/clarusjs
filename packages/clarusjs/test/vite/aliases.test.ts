// #102: path aliases: built-in ~/ → src/, tsconfig/jsconfig paths and Vite's string aliases, resolved the same way
// everywhere (dev, build, prerender, clarusjs check).
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { normalize, resolve } from 'node:path'
import { expect, test } from 'vitest'
import { projectAliases, resolveAlias } from '../../src/vite/aliases.ts'

function project(files: Record<string, string>): string {
  const root = mkdtempSync(resolve(tmpdir(), 'clarus-alias-'))
  for (const [path, text] of Object.entries(files)) { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }
  return root
}

test('~/ is src/, always', () => {
  const root = project({})
  const aliases = projectAliases(root)
  expect(resolveAlias('~/components/card.tscl', aliases)).toBe(resolve(root, 'src/components/card.tscl'))
  expect(resolveAlias('./card.tscl', aliases)).toBeUndefined()
  expect(resolveAlias('@clarusjs/theme-docs/layout.tscl', aliases)).toBeUndefined()
})

test('tsconfig paths (with comments and trailing commas, from baseUrl or the config folder); jsconfig too', () => {
  const ts = project({ 'tsconfig.json': '{\n  // aliases\n  "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["./src/*"], "#data": ["src/data/index.ts"], }, },\n}\n' })
  const aliases = projectAliases(ts)
  expect(resolveAlias('@/lib/x.ts', aliases)).toBe(resolve(ts, 'src/lib/x.ts'))
  expect(resolveAlias('#data', aliases)).toBe(resolve(ts, 'src/data/index.ts'))
  expect(resolveAlias('#data/other', aliases)).toBeUndefined() // an exact paths key matches only itself
  const js = project({ 'jsconfig.json': '{ "compilerOptions": { "paths": { "$lib/*": ["lib/*"] } } }' })
  expect(resolveAlias('$lib/a.js', projectAliases(js))).toBe(resolve(js, 'lib/a.js'))
})

test('Vite resolve.alias: string finds, as an object or a list (a regex find is left to Vite)', () => {
  const root = project({})
  const fromObject = projectAliases(root, { '@ui': resolve(root, 'ui') })
  expect(resolveAlias('@ui/button.tscl', fromObject)).toBe(resolve(root, 'ui/button.tscl'))
  expect(resolveAlias('@ui', fromObject)).toBe(resolve(root, 'ui'))
  const fromList = projectAliases(root, [{ find: 'shared', replacement: '/abs/shared' }, { find: /^x/, replacement: 'y' }])
  expect(resolveAlias('shared/a.ts', fromList)).toBe(normalize('/abs/shared/a.ts'))
  expect(resolveAlias('xyz', fromList)).toBeUndefined()
})

test('the longest matching alias wins', () => {
  const root = project({ 'tsconfig.json': '{ "compilerOptions": { "paths": { "~/ui/*": ["./design/*"] } } }' })
  const aliases = projectAliases(root)
  expect(resolveAlias('~/ui/button.tscl', aliases)).toBe(resolve(root, 'design/button.tscl'))
  expect(resolveAlias('~/pages/a.tscl', aliases)).toBe(resolve(root, 'src/pages/a.tscl'))
})

// The whole pipeline: dev, build (with prerender), and the component/stylesheet discovery the plugin does itself.
import { readdirSync, readFileSync, symlinkSync } from 'node:fs'
import { createBuilder, createServer } from 'vite'
import clarusjs from '../../src/vite/plugin.ts'

function site() {
  const root = project({
    'tsconfig.json': '{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }',
    'src/components/card.tscl': "@import '~/styles/card.css'\n@import { label } from '@/lib/label.ts'\n@input title: string\n<script>\n  import { twice } from '~/lib/twice.ts'\n  let n = state(1)\n</script>\n<button class=\"card\" (click)=\"n = twice(n)\">{{ label(title) }} {{ n }}</button>\n",
    'src/styles/card.css': '.card { color: rebeccapurple; }\n',
    'src/lib/label.ts': "export const label = (t: string) => `[${t}]`\n",
    'src/lib/twice.ts': 'export const twice = (n: number) => n * 2\n',
    'src/data/site.ts': "export const name = 'Aliased'\n",
    'src/pages/index.tscl': "@import card from '~/components/card.tscl'\n@import { name } from '@/data/site.ts'\n@input greeting: string\n<html><head><title>{{ name }}</title></head><body><h1>{{ greeting }}</h1><card [title]=\"name\" /></body></html>\n",
    'src/pages/index.load.ts': "import { name } from '~/data/site.ts'\nexport const load = () => ({ greeting: `Hello from ${name}` })\n",
  })
  mkdirSync(resolve(root, 'node_modules'), { recursive: true })
  symlinkSync(resolve(import.meta.dirname, '../..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  return root
}
const quiet = { info() {}, warn() {}, warnOnce() {}, error() {}, clearScreen() {}, hasErrorLogged: () => false, hasWarned: false }

test('vite build: ~/ and tsconfig paths work in @import, island scripts and .load.ts; aliased components ship their island and CSS', async () => {
  const root = site()
  await (await createBuilder({ root, configFile: false, customLogger: quiet, plugins: [clarusjs()] })).buildApp()
  const html = readFileSync(resolve(root, 'dist/client/index.html'), 'utf8')
  expect(html).toContain('<h1>Hello from Aliased</h1>')
  expect(html).toContain('[Aliased]')
  expect(html).toMatch(/<cl-island c="card" src="[^"]+"/) // found through the alias: its client chunk exists
  const css = (readdirSync(resolve(root, 'dist/client/assets'), { recursive: true }) as string[]).filter((f) => f.endsWith('.css'))
  expect(css.map((f) => readFileSync(resolve(root, 'dist/client/assets', f), 'utf8')).join('')).toContain('.card{color:') // the aliased component's stylesheet
  expect(html).toMatch(/<link rel="stylesheet" href="[^"]*card[^"]*\.css">/)
}, 120_000)

test('dev server: the same aliases', async () => {
  const root = site()
  const server = await createServer({ root, configFile: false, logLevel: 'silent', server: { port: 0 }, plugins: [clarusjs()] })
  await server.listen()
  try {
    const html = await (await fetch(server.resolvedUrls!.local[0]!)).text()
    expect(html).toContain('<h1>Hello from Aliased</h1>')
    expect(html).toContain('[Aliased]')
  } finally {
    await server.close()
  }
}, 60_000)

test('an import no file, package or alias matches is a located error naming it', async () => {
  const root = site()
  writeFileSync(resolve(root, 'src/pages/broken.tscl'), "<p>x</p>\n")
  writeFileSync(resolve(root, 'src/pages/broken.tscl'), "@input a: string = ''\n@import thing from '@nope/thing.tscl'\n<thing />\n")
  await expect((await createBuilder({ root, configFile: false, customLogger: quiet, plugins: [clarusjs()] })).buildApp())
    .rejects.toThrow(/src\/pages\/broken\.tscl:2:1 cannot resolve '@nope\/thing\.tscl'/)
}, 120_000)
