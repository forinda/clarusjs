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
    compilerOptions: { strict: true, noUnusedLocals: true, noEmit: true, target: 'ES2023', module: 'ESNext', moduleResolution: 'Bundler', lib: ['ES2023', 'DOM'], allowImportingTsExtensions: true, rootDirs: ['.', '.clarusjs/virtual'], skipLibCheck: true },
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
<input (input)="v = $event.target.value; $event.data?.length"><b (click)="$event.clientX.toFixed()">x</b>{{ v }}
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

test('[prop] on an HTML element: a boolean attribute takes a boolean, others a primitive (numbers are fine)', () => {
  const errors = check({
    'src/a.tscl': `<script>
  let busy = state(false)
  let n = state(2)
  let user = state({ name: 'a' })
</script>
<button [disabled]="'false'" [hidden]="busy"></button>
<input [readonly]="'yes'" [required]="busy" [tabindex]="n" [value]="n" [checked]="busy">
<a [href]="user" [aria-current]="busy ? 'page' : false" [data-id]="n" [title]="null"></a>
<my-element [anything]="user"></my-element>
`,
  })
  expect(errors).toEqual([
    expect.stringMatching(/^src\/a\.tscl:6:21 .*'"false"' is not assignable to parameter of type 'boolean \| null \| undefined'/), // [disabled]="'false'": still disabled
    expect.stringMatching(/^src\/a\.tscl:7:20 .*'"yes"' is not assignable to parameter of type 'boolean \| null \| undefined'/), // readonly → readOnly
    expect.stringMatching(/^src\/a\.tscl:8:12 .*'\{ name: string; \}' is not assignable to parameter of type 'string \| number \| boolean \| null \| undefined'/), // an object would be "[object Object]"
    expect.stringMatching(/^src\/a\.tscl:9:25 .*'\{ name: string; \}' is not assignable/), // a custom element gets attributes too
  ])
})

test('event handlers keep the narrowing of the @if (and @else) around them; currentTarget is the element; no noise from generated code', () => {
  const errors = check({
    'src/a.tscl': `@input label: string
@input unused: number
<script>
  let picked = state(Math.random() > 1 ? null : { name: 'a' })
  let mode = state(Math.random() > 1 ? 'a' : 'b')
</script>
@if (picked) {
  <button (click)="console.log(picked.name)">x</button>
} @else if (mode === 'a') {
  <button (click)="console.log(picked.name)">y</button>
}
<input (input)="console.log($event.currentTarget.value, label)">
<p (click)="$event.currentTarget.value">z</p>
@if (nope.length) {
  <button (click)="console.log(1)">w</button>
}
`,
  })
  expect(errors).toEqual([
    // In the @else if branch picked is null: still reported there.
    expect.stringMatching(/^src\/a\.tscl:10:32 'picked' is possibly 'null'/),
    expect.stringMatching(/^src\/a\.tscl:13:34 Property 'value' does not exist on type 'EventTarget & HTMLParagraphElement'/),
    // An error in a condition is reported once, where it is written (not again where it's repeated for a handler).
    expect.stringMatching(/^src\/a\.tscl:14:6 Cannot find name 'nope'/),
  ])
})

test('forms: [engine] takes a form, and paths given to the form are the values\' paths', () => {
  const forms = resolve(import.meta.dirname, '../../src/forms/index.ts')
  const errors = check({
    'node_modules/clarusjs/package.json': JSON.stringify({ name: 'clarusjs', exports: { './forms': './forms.ts' } }),
    'node_modules/clarusjs/forms.ts': `export * from ${JSON.stringify(forms)}\n`,
    'src/a.tscl': `<script>
  import { form } from 'clarusjs/forms'
  let order = state({ customer: { email: '' }, lines: [{ item: '' }] })
  const f = form(order)
</script>
<form [engine]="f"><input [(value)]="order.customer.email"><p>{{ f.error('customer.email') }} {{ f.error('lines.0.item') }}</p></form>
<p>{{ f.error('customer.emial') }}</p>
<div [engine]="order"></div>
`,
  })
  expect(errors).toEqual([
    expect.stringMatching(/^src\/a\.tscl:7:15 .*'"customer\.emial"' is not assignable to parameter of type '"customer" \| "customer\.email"/),
    expect.stringMatching(/^src\/a\.tscl:8:16 .*is missing the following properties from type 'Form<any>'/),
  ])
})

test('review #233: only the script\'s own top-level functions count; a callback for a parameter with a default keeps its type', () => {
  const nested = generateTs("<script>\n  function outer() { function visit(cb) { cb(1) } return visit }\n  const r = visit((n) => n)\n</script>\n<p>{{ r }}</p>\n", 'a.tscl').code
  expect(nested).toContain('visit((n) => n)') // `visit` here isn't the nested one: no annotation
  const withDefault = generateTs("<script>\n  function record(update = (n = 0) => n, other) { return update(1) }\n  const r = record((n) => n, (m) => m)\n</script>\n<p>{{ r }}</p>\n", 'b.tscl').code
  expect(withDefault).toContain('record((n) => n, (m: any) => m)') // the first is typed by the default; the second isn't
})

test('review #233 (2): enumerated attributes take their strings; an outer @if guard isn\'t replayed onto a loop item of the same name', () => {
  const errors = check({
    'src/a.tscl': `<script>
  let row = state(Math.random() > 1 ? null : { kind: 'ok', name: 'a' })
  let rows = state([{ kind: 'bad' }])
</script>
<img [draggable]="'false'" [spellcheck]="'true'" alt="">
@if (row) {
  @for (row of rows; track $index) {
    <button (click)="console.log(row.name)">x</button>
  }
}
`,
  })
  expect(errors).toEqual([expect.stringMatching(/^src\/a\.tscl:8:38 Property 'name' does not exist/)])
})

test('#249: a @for row\'s implicit names type-check: $count, $first, $last (booleans), $even, $odd', () => {
  expect(check({ 'src/pages/index.tscl': `@for (n of [1, 2, 3]; track n) {<i [class]="$even ? 'e' : 'o'">{{ $index + 1 }}/{{ $count.toFixed(0) }}{{ $first ? '!' : '' }}{{ $last && $odd ? '.' : '' }}</i>}
` })).toEqual([])
  // They're booleans: a number method on one is an error at its place.
  expect(check({ 'src/pages/index.tscl': `@for (n of [1]; track n) {<i>{{ $first.toFixed(0) }}</i>}
` })).toEqual([expect.stringMatching(/^src\/pages\/index\.tscl:1:\d+ Property 'toFixed' does not exist on type 'boolean'/)])
})

test('#267: a radio group bound with [(value)] to a union type-checks (each radio writes its own value)', () => {
  expect(check({ 'src/components/plan.tscl': `@model plan: 'free' | 'pro' = 'free'
<input type="radio" value="free" [(value)]="plan"><input type="radio" value="pro" [(value)]="plan">
` })).toEqual([])
  // A radio whose value isn't one of the type's is an error at the binding.
  expect(check({ 'src/components/plan.tscl': `@model plan: 'free' | 'pro' = 'free'
<input type="radio" value="gold" [(value)]="plan">
` })).toEqual([expect.stringMatching(/^src\/components\/plan\.tscl:2:\d+ .*'"gold"'.*'"free" \| "pro"'/)])
})

test('#408 review: [class] takes a readonly string array input', () => {
  expect(check({ 'src/pages/index.tscl': '@input classes: string[] = []\n<p [class]="classes">x</p>\n' })).toEqual([])
})

test('#455: a slot\'s data is checked where the child passes it, and a fill that receives it type-checks', () => {
  const list = '@input rows: { id: number; name: string }[]\n<ul>@for (r of rows; track r.id) {<li><slot name="row" [item]="r" [index]="$index">{{ r.name }}</slot></li>}</ul>\n'
  const page = "@import list from '../components/list.tscl'\n<list [rows]=\"[{ id: 1, name: 'Ada' }]\">@slot('row', { item, index }) {<b>{{ index }} {{ item.name }}</b>}</list>\n"
  expect(check({ 'src/components/list.tscl': list, 'src/pages/index.tscl': page })).toEqual([])
  const wrong = list.replace('[item]="r"', '[item]="nope"')
  expect(check({ 'src/components/list.tscl': wrong })).toEqual(["src/components/list.tscl:2:64 Cannot find name 'nope'."])
  // A fill may use only some of what it receives (noUnusedLocals is on here).
  const some = page.replace('{{ index }} {{ item.name }}', '{{ item.name }}')
  expect(check({ 'src/components/list.tscl': list, 'src/pages/index.tscl': some })).toEqual([])
})
