// #20: templates → virtual TypeScript that tsc checks, with errors mapped back to file.tscl:line:col.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, relative, resolve } from 'node:path'
import { expect, test } from 'vitest'
import { generateTs, toSourceOffset } from '../../src/check/generate.ts'

// tsc from the typescript package itself, run with this Node: no dependency on how .bin links are laid out.
const tsPackage = createRequire(import.meta.url).resolve('typescript/package.json')
const tscBin = JSON.parse(readFileSync(tsPackage, 'utf8')).bin
const tsc = resolve(dirname(tsPackage), typeof tscBin === 'string' ? tscBin : tscBin.tsc)

/** Write sources and their virtual files into a temp project, run tsc, map each error back to its .tscl position. */
function check(files: Record<string, string>): string[] {
  const root = mkdtempSync(resolve(tmpdir(), 'clarus-check-'))
  const virtualRoot = resolve(root, '.clarusjs/virtual')
  const generated = new Map<string, ReturnType<typeof generateTs> & { source: string; file: string }>()
  for (const [file, source] of Object.entries(files)) {
    const path = resolve(root, file)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, source)
    if (!file.endsWith('.tscl')) continue
    const out = generateTs(source, file)
    const vpath = resolve(virtualRoot, `${file}.ts`)
    mkdirSync(dirname(vpath), { recursive: true })
    writeFileSync(vpath, out.code)
    generated.set(vpath, { ...out, source, file })
  }
  writeFileSync(resolve(root, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { strict: true, noEmit: true, target: 'ES2023', module: 'ESNext', moduleResolution: 'Bundler', lib: ['ES2023', 'DOM'], allowImportingTsExtensions: true, rootDirs: ['.', '.clarusjs/virtual'], skipLibCheck: true },
    include: ['src', '.clarusjs/virtual'],
  }))
  let output = ''
  try {
    output = execFileSync(process.execPath, [tsc, '-p', '.'], { cwd: root, encoding: 'utf8' })
  } catch (e) {
    // tsc exits non-zero when it reports errors; anything without that report is a real failure.
    const stdout = (e as { stdout?: string }).stdout
    if (!stdout) throw e
    output = stdout
  }
  const errors: string[] = []
  for (const line of output.split('\n')) {
    const m = /^(.+?)\((\d+),(\d+)\): error TS\d+: (.*)$/.exec(line.trim())
    if (!m) continue
    const g = generated.get(resolve(root, m[1]!))
    if (!g) { errors.push(`${relative(root, resolve(root, m[1]!))}:${m[2]}:${m[3]} ${m[4]}`); continue }
    const lines = g.code.split('\n')
    const vOffset = lines.slice(0, Number(m[2]) - 1).reduce((n, l) => n + l.length + 1, 0) + Number(m[3]) - 1
    const s = toSourceOffset(g.mappings, vOffset)
    if (s === null) { errors.push(`${g.file}:? (unmapped) ${m[4]}`); continue }
    const before = g.source.slice(0, s)
    errors.push(`${g.file}:${before.split('\n').length}:${s - before.lastIndexOf('\n')} ${m[4]}`)
  }
  return errors
}

const user = { 'src/domain/user.ts': 'export interface User { name: string; admin: boolean }\n' }
const badge = { 'src/components/badge.tscl': '@input label: string\n@input tone: string = "info"\n<span>{{ label }}</span>\n' }

test('inputs become an exported Inputs interface; defaults are optional', () => {
  const { code } = generateTs('@input label: string\n@input tone: string = "info"\n<b>{{ label }}</b>', 'b.tscl')
  expect(code).toContain('export interface Inputs {')
  expect(code).toMatch(/label: string/)
  expect(code).toMatch(/tone\?: string/)
})

test('a correct page type-checks cleanly', () => {
  expect(check({ ...user, ...badge,
    'src/pages/index.tscl': `@import type { User } from '../domain/user'
@import badge from '../components/badge.tscl'
@input user: User | null

@if (user) {<h1>{{ user.name }}</h1><badge [label]="user.name" />} @else {<p>anonymous</p>}
@for (n of [1, 2, 3]; track n) {<i>{{ n.toFixed(1) }} #{{ $index + 1 }}</i>}
`,
  })).toEqual([])
})

test('a misspelled property is reported at its place in the template', () => {
  expect(check({ ...user, 'src/pages/index.tscl': `@import type { User } from '../domain/user'
@input user: User
<h1>{{ user.nmae }}</h1>
` })).toEqual([expect.stringMatching(/^src\/pages\/index\.tscl:3:13 Property 'nmae' does not exist/)])
})

test('component props are checked: unknown and missing props', () => {
  const errors = check({ ...badge, 'src/pages/index.tscl': `@import badge from '../components/badge.tscl'
<badge [lable]="'x'" />
<badge />
` })
  expect(errors).toEqual(expect.arrayContaining([
    expect.stringMatching(/^src\/pages\/index\.tscl:2:9 .*'lable'/),
    expect.stringMatching(/^src\/pages\/index\.tscl:3:1 .*'label' is missing/),
  ]))
  expect(errors).toHaveLength(2)
})

test('@if narrows: reading through a possibly-null value is an error outside the block only', () => {
  const errors = check({ ...user, 'src/pages/index.tscl': `@import type { User } from '../domain/user'
@input user: User | null
<p>{{ user.name }}</p>
@if (user) {<p>{{ user.name }}</p>}
` })
  expect(errors).toEqual([expect.stringMatching(/^src\/pages\/index\.tscl:3:7 .*possibly 'null'/)])
})

test('island scripts are typed: state() keeps its value type, handlers are checked', () => {
  const errors = check({ 'src/components/c.tscl': `<script>
  let n = state(0)
  const double = derived(() => n * 2)
</script>
<b (click)="n = 'x'">{{ n.toFixed(1) }} {{ double.toFixed(0) }} {{ n.foo }}</b>
` })
  expect(errors).toEqual(expect.arrayContaining([
    expect.stringMatching(/^src\/components\/c\.tscl:5:13 Type 'string' is not assignable to type 'number'/),
    expect.stringMatching(/^src\/components\/c\.tscl:5:70 Property 'foo' does not exist on type 'number'/),
  ]))
  expect(errors).toHaveLength(2)
})

test('@for needs something iterable', () => {
  expect(check({ 'src/pages/index.tscl': '@input n: number\n@for (x of n) {{{ x }}}\n' }))
    .toEqual([expect.stringMatching(/^src\/pages\/index\.tscl:2:12 .*(iterator|iterable)/i)])
})

test('$event is typed by event name, its target is left open', () => {
  expect(check({ 'src/components/f.tscl': `<script>let v = state('')</script>
<input (input)="v = $event.target.value; $event.data?.length"><b (click)="$event.clientX.toFixed()">x</b>
` })).toEqual([])
})

test('#77: imported data is typed', () => {
  expect(check({
    'src/nav.ts': `export const nav = [{ title: 'Intro', href: '/intro' }]\n`,
    'src/pages/index.tscl': `@import { nav } from '../nav'\n@for (item of nav) {<a [href]="item.hrfe">{{ item.title }}</a>}\n`,
  })).toEqual([expect.stringMatching(/^src\/pages\/index\.tscl:2:37 Property 'hrfe' does not exist/)])
})

test('review: @for list and track errors map to their own position, not an earlier match', () => {
  // "f" also occurs inside "of"; the error belongs to the list.
  expect(check({ 'src/pages/index.tscl': `@for (x of f) {<b>{{ x }}</b>}\n` })).toEqual([expect.stringMatching(/^src\/pages\/index\.tscl:1:12 Cannot find name 'f'/)])
  // "n" also occurs as the item; the error belongs to the track expression.
  expect(check({ 'src/pages/index.tscl': `@for (n of [1]; track n.id) {<b>{{ n }}</b>}\n` })).toEqual([expect.stringMatching(/^src\/pages\/index\.tscl:1:25 Property 'id' does not exist/)])
})

test('review: identical script imports each map to their own line', () => {
  const errors = check({ 'src/pages/index.tscl': `<script>\nimport './missing.ts'\nimport './missing.ts'\nlet n = state(0)\n</script>\n<b (click)="n++">{{ n }}</b>\n` })
  const lines = errors.filter((e) => e.includes('missing')).map((e) => e.split(':')[1])
  expect(lines).toEqual(['2', '3'])
})

test("a script's own functions get `: any` on untyped parameters (scripts are JavaScript); callbacks keep their contextual type", () => {
  const source = "<script>\n  import { x } from './x.ts'\n  function add(a, { b }, ...rest) { return a }\n  const one = z => z\n  const two = async (c = 1) => c\n  const list = state([1]).map((v) => v)\n</script>\n<p>{{ add(1, {}) }}</p>\n"
  const { code, mappings } = generateTs(source, 'x.tscl')
  expect(code).toContain('function add(a: any, { b }: any, ...rest: any[]) { return a }')
  expect(code).toContain('const one = (z: any) => z')
  expect(code).toContain('const two = async (c = 1) => c') // a default gives the type
  expect(code).toContain('.map((v) => v)')
  // A callback given to one of the script's own functions has no context type either.
  const own = generateTs("<script>\n  function record(update) { return update(1) }\n  const each = (f) => f\n  record((p) => p)\n  each(function (q) { return q })\n  record.call(null, (r) => r)\n</script>\n<p>{{ record((x) => x) }}</p>\n", 'y.tscl').code
  expect(own).toContain('record((p: any) => p)')
  expect(own).toContain('each(function (q: any) { return q })')
  expect(own).toContain('record.call(null, (r) => r)') // not a direct call: left as is
  // Every exact span is the template's own text (the imports are copied once, at the top), so a mapper can call
  // them verbatim.
  for (const [v, length, s, exact] of mappings) if (exact) expect(code.slice(v, v + length)).toBe(source.slice(s, s + length))
  expect(mappings.filter(([, , , exact]) => exact).some(([v, l]) => code.slice(v, v + l).includes('return a'))).toBe(true)
})
