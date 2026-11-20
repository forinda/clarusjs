// #20: templates → virtual TypeScript that tsc checks, with errors mapped back to file.clarus:line:col.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, relative, resolve } from 'node:path'
import { expect, test } from 'vitest'
import { generateTs, toSourceOffset } from '../../src/check/generate.ts'

const tsc = resolve(import.meta.dirname, '../../node_modules/.bin/tsc')

/** Write sources and their virtual files into a temp project, run tsc, map each error back to its .clarus position. */
function check(files: Record<string, string>): string[] {
  const root = mkdtempSync(resolve(tmpdir(), 'clarus-check-'))
  const virtualRoot = resolve(root, '.clarusjs/virtual')
  const generated = new Map<string, ReturnType<typeof generateTs> & { source: string; file: string }>()
  for (const [file, source] of Object.entries(files)) {
    const path = resolve(root, file)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, source)
    if (!file.endsWith('.clarus')) continue
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
  try { execFileSync(tsc, ['-p', '.'], { cwd: root, encoding: 'utf8' }) } catch (e) { output = (e as { stdout: string }).stdout }
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
const badge = { 'src/components/badge.clarus': '@input label: string\n@input tone: string = "info"\n<span>{{ label }}</span>\n' }

test('inputs become an exported Inputs interface; defaults are optional', () => {
  const { code } = generateTs('@input label: string\n@input tone: string = "info"\n<b>{{ label }}</b>', 'b.clarus')
  expect(code).toContain('export interface Inputs {')
  expect(code).toMatch(/label: string/)
  expect(code).toMatch(/tone\?: string/)
})

test('a correct page type-checks cleanly', () => {
  expect(check({ ...user, ...badge,
    'src/pages/index.clarus': `@import type { User } from '../domain/user'
@import badge from '../components/badge.clarus'
@input user: User | null

@if (user) {<h1>{{ user.name }}</h1><badge [label]="user.name" />} @else {<p>anonymous</p>}
@for (n of [1, 2, 3]; track n) {<i>{{ n.toFixed(1) }} #{{ $index + 1 }}</i>}
`,
  })).toEqual([])
})

test('a misspelled property is reported at its place in the template', () => {
  expect(check({ ...user, 'src/pages/index.clarus': `@import type { User } from '../domain/user'
@input user: User
<h1>{{ user.nmae }}</h1>
` })).toEqual([expect.stringMatching(/^src\/pages\/index\.clarus:3:13 Property 'nmae' does not exist/)])
})

test('component props are checked: unknown and missing props', () => {
  const errors = check({ ...badge, 'src/pages/index.clarus': `@import badge from '../components/badge.clarus'
<badge [lable]="'x'" />
<badge />
` })
  expect(errors).toEqual(expect.arrayContaining([
    expect.stringMatching(/^src\/pages\/index\.clarus:2:9 .*'lable'/),
    expect.stringMatching(/^src\/pages\/index\.clarus:3:1 .*'label' is missing/),
  ]))
  expect(errors).toHaveLength(2)
})

test('@if narrows: reading through a possibly-null value is an error outside the block only', () => {
  const errors = check({ ...user, 'src/pages/index.clarus': `@import type { User } from '../domain/user'
@input user: User | null
<p>{{ user.name }}</p>
@if (user) {<p>{{ user.name }}</p>}
` })
  expect(errors).toEqual([expect.stringMatching(/^src\/pages\/index\.clarus:3:7 .*possibly 'null'/)])
})

test('island scripts are typed: state() keeps its value type, handlers are checked', () => {
  const errors = check({ 'src/components/c.clarus': `<script>
  let n = state(0)
  const double = derived(() => n * 2)
</script>
<b (click)="n = 'x'">{{ n.toFixed(1) }} {{ double.toFixed(0) }} {{ n.foo }}</b>
` })
  expect(errors).toEqual(expect.arrayContaining([
    expect.stringMatching(/^src\/components\/c\.clarus:5:13 Type 'string' is not assignable to type 'number'/),
    expect.stringMatching(/^src\/components\/c\.clarus:5:70 Property 'foo' does not exist on type 'number'/),
  ]))
  expect(errors).toHaveLength(2)
})

test('@for needs something iterable', () => {
  expect(check({ 'src/pages/index.clarus': '@input n: number\n@for (x of n) {{{ x }}}\n' }))
    .toEqual([expect.stringMatching(/^src\/pages\/index\.clarus:2:12 .*(iterator|iterable)/i)])
})

test('$event is typed by event name, its target is left open', () => {
  expect(check({ 'src/components/f.clarus': `<script>let v = state('')</script>
<input (input)="v = $event.target.value; $event.data?.length"><b (click)="$event.clientX.toFixed()">x</b>
` })).toEqual([])
})
