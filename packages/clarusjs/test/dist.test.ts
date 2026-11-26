// The published package is the built dist/, not src/. Build it once and check it works on its own.
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
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

test('built JS carries no comments (size); the declarations keep their docs (editor hovers)', () => {
  expect(readFileSync(`${dist}/server/head.js`, 'utf8')).not.toMatch(/\/\*\*|^\s*\/\/ /m)
  expect(readFileSync(`${dist}/server/head.d.ts`, 'utf8')).toContain('/** The site\'s public address')
  // The browser runtime keeps its comments: Vite reads /* @vite-ignore */ in apps that bundle it (and minifies it).
  for (const file of ['router', 'loader']) expect(readFileSync(`${dist}/runtime/${file}.js`, 'utf8')).toMatch(/import\([^\n]*\/\* @vite-ignore \*\/ src\)/)
})

test('built JS has no .ts import specifiers', () => {
  const plugin = readFileSync(`${dist}/vite/plugin.js`, 'utf8')
  const compiler = readFileSync(`${dist}/compiler/index.js`, 'utf8')
  expect(plugin + compiler).not.toMatch(/from ['"][^'"]+\.ts['"]/)
})

test('built compiler compiles a component', async () => {
  const { compile } = await import(`${dist}/compiler/index.js`)
  const out = compile('<script>let n = state(0)</script>\n<b (click)="n++">{{ n }}</b>', { file: 'c.tscl', target: 'client' })
  expect(out.code).toContain('export function attach')
})

test('built compiler exports parse, declared in the .d.ts', async () => {
  const { parse } = await import(`${dist}/compiler/index.js`)
  expect(parse('<b>hi</b>', 'c.tscl').nodes.length).toBeGreaterThan(0)
  expect(readFileSync(`${dist}/compiler/index.d.ts`, 'utf8')).toMatch(/\bparse\b/)
})

test('built Vite plugin points at built runtime files that exist', async () => {
  const { default: clarusjs } = await import(`${dist}/vite/plugin.js`)
  const plugin = clarusjs()
  const aliases = plugin.config({}, { command: 'serve', mode: 'development' }).resolve.alias as { find: string | RegExp; replacement: string }[]
  // The runtime's own entries (the project's path aliases, like ~/, point into the project).
  for (const a of aliases.filter((x) => typeof x.find === 'string' && x.find.startsWith('clarusjs/'))) {
    expect(a.replacement.startsWith(dist)).toBe(true)
    expect(existsSync(a.replacement)).toBe(true)
  }
  const loader = plugin.resolveId.handler('/cl-loader.js')
  expect(loader).toBe(join(dist, 'runtime/loader.js'))
  expect(existsSync(loader)).toBe(true)
  // #179: the built router gets its own copy of the built navigation guard.
  const guard = plugin.resolveId.handler('./navigate.js', join(dist, 'runtime/router.js')) as string
  expect(guard).toBe(`${join(dist, 'runtime/navigate.js')}?cl-copy=router`)
  expect(existsSync(guard.replace(/\?.*/, ''))).toBe(true)
  const entry = plugin.load.handler('\0virtual:clarusjs/server-entry') as string
  expect(entry).toContain(JSON.stringify(join(dist, 'server/handler.js')).slice(1, -1)) // as written into the entry (a JSON string)
})

test('every path in "files" exists, including README and LICENSE (npm shows the package README)', () => {
  const pkg = JSON.parse(readFileSync(`${pkgDir}/package.json`, 'utf8'))
  expect(pkg.files).toEqual(expect.arrayContaining(['dist', 'LICENSE', 'README.md']))
  for (const f of pkg.files as string[]) expect(existsSync(`${pkgDir}/${f}`), f).toBe(true)
})

test('the clarusjs command is built, with a shebang', () => {
  const pkg = JSON.parse(readFileSync(`${pkgDir}/package.json`, 'utf8'))
  const bin = resolve(pkgDir, pkg.bin.clarusjs)
  expect(bin.startsWith(dist)).toBe(true)
  expect(readFileSync(bin, 'utf8').startsWith('#!/usr/bin/env node')).toBe(true)
})

// 130 / 470 KB: class and style forms and spread (#402: classValue, styleValue, spreadAttrs and the browser's spread,
// with their docs) take the unpacked package from 453,740 to 461,453 B, past 450 KB; the sitemap stories add more.
// 130 / 450 KB: richer sitemaps (#394: a page's own lastmod, images, include, an index, hreflang) on top of main at
// 127,227 / 446,892 B, within 800 B of the old 125 KB tarball; the third story alone went over.
// 125 / 450 KB: built-in icons (clarusjs/icons reads installed Iconify sets, ~6 KB unpacked with its typed docs, and
// <icon> in the compiler) on top of main at 123,616 / 434,441 B, within 6 KB of the old 430 KB.
// 125 / 430 KB: the server and build features of #93–#95, #54 and #98 (cookies, handle(), endpoints and their CSRF
// check, watch mode, precompression) left main at 116,980 / 408,481 B, and component loaders (#97) add ~1.2 KB.
// 115 / 400 KB: main sat within ~100 B of 110 KB, so the next feature (#307, collapsing template
// whitespace at build: 16 lines) went over; 5 KB of headroom for the lint (#304) and formatting work.
// 110 / 400 KB unpacked: #301 (h() with its docs, @for names, radio and checkbox groups, the attribute fixes).
// 110 / 380 KB: clarusjs/fetch (#258: resource, batch, json; #287: the keyed cache) with its typed docs takes the
// package to 100.2 / 346 KB once main's other changes are in (#289).
// 100 / 350 KB before: the forms engine (#250: clarusjs/forms, steps, submit) takes the package past 90 / 320 KB, which
// the editor epic (#45: the content mapper, tolerant parsing) had nearly filled (88 / 304 KB).
// 90 / 320 KB before: the TypeScript epic (#211); 80 / 290 KB: the navigation epic (#169); 70 / 250 KB before that.
// 135 KB tarball: main is at 129,399 B; the attributes epic (#402: class and style forms, spread onto elements and
// components, with their checker types and docs) takes it to 133,568 B. Unpacked stays 470 KB (469,786 B with it).
// 150 / 540 KB: from main's 133,568 / 469,786 B, clarusjs/fetch's request(), callbacks and action() (#431, #429) add
// 3,788 / 15,104 B, and <script server> with @await (#430) 4,741 / 20,588 B: about 142,100 / 505,500 B together.
// 160 / 580 KB: main is at 153,549 / 549,113 B (51 B and 3.8 KB of room) after the islands-in-islands and context work
// (#465); the next framework changes (attributes on an @if root for ui.clarusjs.com's Button) no longer fit.
// 170 KB tarball: main is at 163,501 B (339 B of room); event modifiers and $values (#444) add ~1.8 KB, and the layout
// follow-ups (#472) more. Unpacked stays 580 KB (583,235 B on main).
test('size budget: the published package stays small (tarball 170 KB, unpacked 580 KB)', () => {
  const [info] = JSON.parse(execSync('npm pack --dry-run --json --ignore-scripts', { cwd: pkgDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))
  expect(info.size, `tarball ${info.size} B`).toBeLessThanOrEqual(170 * 1024)
  expect(info.unpackedSize, `unpacked ${info.unpackedSize} B`).toBeLessThanOrEqual(580 * 1024)
}, 30_000) // npm pack takes over 5 s when every package's tests run at once

test('#197: sideEffects lists only the browser scripts that start work when loaded (bundlers drop the rest when unused)', () => {
  const pkg = JSON.parse(readFileSync(`${pkgDir}/package.json`, 'utf8'))
  const scripts = ['loader', 'router', 'fragments', 'navigation']
  expect(pkg.sideEffects).toEqual([...scripts.map((s) => `./src/runtime/${s}.ts`), ...scripts.map((s) => `./dist/runtime/${s}.js`)])
})

test('dependencies are exactly acorn (compiler) and commander (CLI): adding one is a deliberate change', () => {
  const pkg = JSON.parse(readFileSync(`${pkgDir}/package.json`, 'utf8'))
  expect(Object.keys(pkg.dependencies).sort()).toEqual(['acorn', 'commander'])
})

test('the built package has clarusjs/forms, with its types', async () => {
  const forms = await import(`${dist}/forms/index.js`)
  expect(typeof forms.form).toBe('function')
  expect(typeof forms.connect).toBe('function')
  expect(readFileSync(`${dist}/forms/index.d.ts`, 'utf8')).toContain('export declare function form')
})

test('the built package has clarusjs/fetch, with its types, in its published exports', async () => {
  const fetchEntry = await import(`${dist}/fetch/index.js`)
  for (const name of ['resource', 'batch', 'json']) expect(typeof fetchEntry[name], name).toBe('function')
  expect(readFileSync(`${dist}/fetch/index.d.ts`, 'utf8')).toContain('export declare function resource')
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  expect(pkg.exports['./fetch']).toBe('./src/fetch/index.ts')
  expect(pkg.publishConfig.exports['./fetch']).toEqual({ types: './dist/fetch/index.d.ts', default: './dist/fetch/index.js' })
})
