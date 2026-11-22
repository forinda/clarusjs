// <icon> through the whole pipeline: the Vite plugin (build and dev) and clarusjs check find icons in the sets the
// project installs.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createBuilder, createServer } from 'vite'
import { expect, test } from 'vitest'
import { check } from '../../src/cli/check.ts'
import clarusjs from '../../src/vite/plugin.ts'

const typescript = resolve(import.meta.dirname, '../../node_modules/typescript')
const quiet = { info() {}, warn() {}, warnOnce() {}, error() {}, clearScreen() {}, hasErrorLogged: () => false, hasWarned: false }

function install(root: string, prefix: string, icons: Record<string, { body: string }>): void {
  const dir = resolve(root, 'node_modules/@iconify-json', prefix)
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, 'package.json'), JSON.stringify({ name: `@iconify-json/${prefix}`, exports: { './icons.json': './icons.json' } }))
  writeFileSync(resolve(dir, 'icons.json'), JSON.stringify({ prefix, width: 24, height: 24, icons }))
}
function site(page: string): string {
  const root = mkdtempSync(resolve(tmpdir(), 'clarus-icons-'))
  writeFileSync(resolve(root, 'package.json'), '{ "type": "module" }')
  mkdirSync(resolve(root, 'src/pages'), { recursive: true })
  writeFileSync(resolve(root, 'src/pages/index.tscl'), page)
  install(root, 'test', { rocket: { body: '<path d="M4 20 20 4"/>' } })
  symlinkSync(resolve(import.meta.dirname, '../..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  return root
}
const PAGE = '<html><head><title>Icons</title></head><body><h1><icon name="test:rocket" /> Launch</h1></body></html>\n'

test('vite build: the icon is inline SVG in the page, and no JavaScript ships for it', async () => {
  const root = site(PAGE)
  await (await createBuilder({ root, configFile: false, customLogger: quiet, plugins: [clarusjs()] })).buildApp()
  const html = readFileSync(resolve(root, 'dist/client/index.html'), 'utf8')
  expect(html).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true"')
  expect(html).toContain('<path d="M4 20 20 4"/></svg> Launch</h1>')
  expect(html).not.toContain('<script')
  // The page loads no script, and no built script carries the icon.
  const scripts = (readdirSync(resolve(root, 'dist/client'), { recursive: true }) as string[]).filter((f) => f.endsWith('.js'))
  for (const f of scripts) expect(readFileSync(resolve(root, 'dist/client', f), 'utf8')).not.toContain('M4 20 20 4')
}, 120_000)

test('dev: a set installed after the error is found on the next request, without a restart', async () => {
  const root = site(PAGE.replace('test:rocket', 'late:star'))
  const server = await createServer({ root, configFile: false, logLevel: 'silent', server: { port: 0 }, plugins: [clarusjs()] })
  await server.listen()
  try {
    const url = server.resolvedUrls!.local[0]!
    const before = await fetch(url)
    expect(await before.text()).toContain("no icon set 'late': install it with pnpm add -D @iconify-json/late")
    install(root, 'late', { star: { body: '<circle r="1"/>' } })
    server.moduleGraph.invalidateAll()
    expect(await (await fetch(url)).text()).toContain('<circle r="1"/></svg>')
  } finally {
    await server.close()
  }
}, 60_000)

test('clarusjs check: an unknown icon is an error at its line and column, with the closest name', () => {
  const root = site('<p>\n  <icon name="test:rockt" /></p>\n')
  const result = check({ root, typescript })
  expect(result.diagnostics.map((d) => `${d.file}:${d.line}:${d.column} ${d.severity} ${d.message}`)).toContain(
    "src/pages/index.tscl:2:3 error no icon 'rockt' in test (did you mean 'rocket'?)",
  )
})

test('clarusjs check: a known icon is no error', () => {
  const root = site('<p><icon name="test:rocket" /></p>\n')
  expect(check({ root, typescript }).diagnostics.filter((d) => d.severity === 'error')).toEqual([])
})
