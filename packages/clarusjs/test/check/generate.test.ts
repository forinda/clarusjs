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

test('#455 review: any function parameter in a fill (a rest) and any slot data name ([engine]) type-check; #472: a default is checked against the data', () => {
  const list = '@input rows: { id: number; name: string }[]\n<ul>@for (r of rows; track r.id) {<li><slot name="row" [item]="r" [engine]="42">{{ r.name }}</slot></li>}</ul>\n'
  const page = (fill: string) => `@import list from '../components/list.tscl'\n<list [rows]="[]">${fill}</list>\n`
  expect(check({ 'src/components/list.tscl': list })).toEqual([]) // [engine] on a slot is data, not a form
  // The slot always passes its data, so a default never applies: one that doesn't fit the data is reported, on it.
  expect(check({ 'src/components/list.tscl': list, 'src/pages/index.tscl': page("@slot('row', props = {}) {<b>{{ props.item.name }}</b>}") })).toEqual([
    expect.stringMatching(/^src\/pages\/index\.tscl:2:32 Type '\{\}' is missing the following properties/),
  ])
  expect(check({ 'src/components/list.tscl': list, 'src/pages/index.tscl': page("@slot('row', props) {<b>{{ props.item.name }}{{ props.engine.toFixed() }}</b>}") })).toEqual([])
  expect(check({ 'src/components/list.tscl': list, 'src/pages/index.tscl': page("@slot('row', ...args) {<b>{{ args.length }}</b>}") })).toEqual([])
  expect(check({ 'src/components/list.tscl': list, 'src/pages/index.tscl': page("@slot('row', { item } = {}) {<b>{{ item }}</b>}") })).toEqual([
    expect.stringMatching(/^src\/pages\/index\.tscl:2:\d+ Type '\{\}' is missing the following properties/),
  ])
})

test('#472: a fill\'s names are typed by what the child\'s <slot> passes', () => {
  const list = '@input rows: { id: number; name: string }[]\n<ul>@for (r of rows; track r.id) {<li><slot name="row" [item]="r" [index]="$index">{{ r.name }}</slot></li>}</ul>\n<slot [count]="rows.length" />\n'
  const page = (fill: string) => `@import list from '../components/list.tscl'\n<list [rows]="[]">${fill}</list>\n`
  expect(check({ 'src/components/list.tscl': list, 'src/pages/index.tscl': page("@slot('row', { item, index }) {<b>{{ index.toFixed() }} {{ item.name.toUpperCase() }}</b>}") })).toEqual([])
  expect(check({ 'src/components/list.tscl': list, 'src/pages/index.tscl': page("@slot('row', { item }) {<b>{{ item.nmae }}</b>}") })).toEqual([
    expect.stringMatching(/^src\/pages\/index\.tscl:2:\d+ Property 'nmae' does not exist on type '\{ readonly id: number; readonly name: string; \}'/),
  ])
  expect(check({ 'src/components/list.tscl': list, 'src/pages/index.tscl': page("@slot('row', { item, idx }) {<b>{{ item.id }}{{ idx }}</b>}") })).toEqual([
    expect.stringMatching(/^src\/pages\/index\.tscl:2:\d+ Property 'idx' does not exist on type/),
  ])
  // A name with a default may be one the slot doesn't pass (the docs' { item, note = '' }): any, not an error.
  expect(check({ 'src/components/list.tscl': list, 'src/pages/index.tscl': page("@slot('row', { item, note = '', index = 0 }) {<b>{{ note.toUpperCase() }}{{ item.id }}{{ index.toFixed() }}</b>}") })).toEqual([])
  // The default slot's data too; a slot the child doesn't have stays any.
  expect(check({ 'src/components/list.tscl': list, 'src/pages/index.tscl': page("@slot('default', { count }) {<b>{{ count.toFixed() }}</b>}@slot('other', { x }) {<b>{{ x.y }}</b>}") })).toEqual([])
})

test('#472: a component that renders itself and fills its own slot type-checks (no circular type)', () => {
  const tree = "@input node: { label: string; kids: any[] }\n@import tree from './tree.tscl'\n<li><slot name=\"label\" [text]=\"node.label\">{{ node.label }}</slot><ul>@for (k of node.kids; track $index) {<tree [node]=\"k\">@slot('label', { text }) {<i>{{ text.toUpperCase() }}</i>}</tree>}</ul></li>\n"
  expect(check({ 'src/components/tree.tscl': tree })).toEqual([])
  expect(check({ 'src/components/tree.tscl': tree.replace('text.toUpperCase()', 'text.toFixed()') })).toEqual([
    expect.stringMatching(/Property 'toFixed' does not exist on type 'string'/),
  ])
})

test('#442 events: emit() is typed by @event, and a parent handler gets $event as the value and $info', () => {
  const stepper = `@event change: number
@event close
<script>
  let n = state(0)
  function up(event) { if (emit('change', n + 1, { reason: 'increment', event })) n = n + 1 }
  function bad() { emit('change', 'one') }
  function shut() { emit('close') }
  function nope() { emit('opne', 1) }
</script>
<button (click)="up($event); bad(); shut(); nope()">{{ n }}</button>
`
  expect(check({ 'src/components/stepper.tscl': stepper })).toEqual([
    "src/components/stepper.tscl:6:35 Argument of type 'string' is not assignable to parameter of type 'number'.",
    expect.stringMatching(/^src\/components\/stepper\.tscl:8:26 Argument of type '"opne"' is not assignable/),
  ])
  const fine = stepper.replace("  function bad() { emit('change', 'one') }\n", '').replace("  function nope() { emit('opne', 1) }\n", '').replace(' bad();', '').replace(' nope()', '')
  const page = `@import stepper from '../components/stepper.tscl'
<script>
  let total = state(0)
</script>
<stepper (change)="total = $event.toUpperCase(); if ($info.reason === 'x') $info.cancel()" (close)="total = 0" (chnage)="total = 1" />
<p>{{ total }}</p>
`
  expect(check({ 'src/components/stepper.tscl': fine, 'src/pages/index.tscl': page })).toEqual([
    expect.stringMatching(/^src\/pages\/index\.tscl:5:35 Property 'toUpperCase' does not exist on type 'number'/),
    expect.stringMatching(/^src\/pages\/index\.tscl:5:112 Type '"chnage"' is not assignable to type /),
  ])
})

test('#463 attributes on a component: attribute-like names pass (static or bound); other unknown names are still errors', () => {
  const button = '@input label: string\n<button>{{ label }}</button>\n'
  const page = `@import btn from '../components/btn.tscl'
<btn [label]="'Save'" id="save" data-test="x" aria-label="Save it" [aria-controls]="'panel'" role="button" hidden tabindex="0" />
<btn [label]="'Bad'" foo="1" />
`
  expect(check({ 'src/components/btn.tscl': button, 'src/pages/index.tscl': page })).toEqual([
    expect.stringMatching(/^src\/pages\/index\.tscl:3:22 .*'foo' does not exist/),
  ])
})

test('#464 [use]: a function of the element (typed by its tag), or a list of them; anything else is an error', () => {
  const c = `<script>
  const focus = (el) => el.focus()
  const grow = (el) => { el.rows = 4; return () => {} }
</script>
<button [use]="focus">a</button>
<textarea [use]="[focus, grow]"></textarea>
<p [use]="(el) => el.rows">p</p>
<i [use]="42"></i>
`
  expect(check({ 'src/components/c.tscl': c })).toEqual([
    "src/components/c.tscl:7:22 Property 'rows' does not exist on type 'HTMLParagraphElement'.",
    expect.stringMatching(/^src\/components\/c\.tscl:8:11 Argument of type 'number' is not assignable/),
  ])
})

test('#465 context: @context names are typed in the template; provide() type-checks in a script', () => {
  const panel = "@context tabs: { value: string }\n@context theme: { tone: string } = { tone: 'light' }\n<p>{{ tabs.value }} {{ theme.tone }} {{ tabs.nope }}</p>\n"
  expect(check({ 'src/components/panel.tscl': panel })).toEqual([
    expect.stringMatching(/^src\/components\/panel\.tscl:3:46 Property 'nope' does not exist/),
  ])
  const tabs = "@input value: string\n<script>\n  provide('tabs', { value })\n</script>\n<div><slot /></div>\n"
  expect(check({ 'src/components/tabs.tscl': tabs })).toEqual([])
})

test('#465 review: a script\'s own provide is an error in check too, as in the build', () => {
  const own = "<script>\n  function provide(k, v) {}\n  provide('k', 1)\n</script>\n<p />\n"
  // The generator throws the build's located error; the check CLI reports it at its place.
  expect(() => check({ 'src/components/own.tscl': own })).toThrow(/^src\/components\/own\.tscl:2:3 provide is reserved/)
})

test('#465 review: provide passed around (not called) is the build\'s located error in check too', () => {
  const bare = "<script>\n  const register = provide\n  register('tabs', 1)\n</script>\n<p />\n"
  expect(() => check({ 'src/components/bare.tscl': bare })).toThrow(/^src\/components\/bare\.tscl:2:20 provide is called with/)
})

test('#fallthrough: (name) a component doesn\'t declare is the DOM event on what it renders; $event is that event', () => {
  const button = '<button type="button"><slot /></button>\n'
  const page = `@import btn from '../components/btn.tscl'
<script>
  let x = state(0)
</script>
<btn (click)="x = $event.clientX">a</btn>
<btn (keydown)="x = $event.key.length">b</btn>
<btn (click)="x = $event.nope">c</btn>
<btn (clik)="x = 1">d</btn>
<p>{{ x }}</p>
`
  expect(check({ 'src/components/btn.tscl': button, 'src/pages/index.tscl': page })).toEqual([
    expect.stringMatching(/^src\/pages\/index\.tscl:7:26 Property 'nope' does not exist on type '(Pointer|Mouse)Event'/),
    expect.stringMatching(/^src\/pages\/index\.tscl:8:6 Type '"clik"' is not assignable to type /),
  ])
})

test('#review: an event that does not bubble is reported (it would never arrive); a typo is reported once', () => {
  const button = '<button type="button"><slot /></button>\n'
  const page = `@import btn from '../components/btn.tscl'
<script>
  let x = state(0)
  function f(v) { x = v }
</script>
<btn (focus)="x = 1">a</btn>
<btn (clik)="f($event.x)">b</btn>
<p>{{ x }}</p>
`
  const errors = check({ 'src/components/btn.tscl': button, 'src/pages/index.tscl': page })
  expect(errors).toHaveLength(2)
  expect(errors[0]).toMatch(/^src\/pages\/index\.tscl:6:6 Type '"focus"' is not assignable/)
  expect(errors[1]).toMatch(/^src\/pages\/index\.tscl:7:6 Type '"clik"' is not assignable/)
})

test('a component whose root is a <fragment> takes no attributes or DOM events: each one on its tag is reported', () => {
  const pair = '@event pick: string\n<fragment><dt><slot /></dt><dd>x</dd></fragment>\n'
  const page = `@import pair from '../components/pair.tscl'
<script>
  let x = state('')
</script>
<dl>
  <pair id="a" (click)="x = 'c'" (pick)="x = $event">d</pair>
  <pair class="b">e</pair>
  <pair (pick)="x = $event">f</pair>
</dl>
<p>{{ x }}</p>
`
  const errors = check({ 'src/components/pair.tscl': pair, 'src/pages/index.tscl': page })
  expect(errors).toEqual([
    expect.stringMatching(/^src\/pages\/index\.tscl:6:9 .*'id' does not exist in type .*__cl_fragment_root_takes_no_attributes/),
    expect.stringMatching(/^src\/pages\/index\.tscl:6:16 Type '"click"' is not assignable/),
    expect.stringMatching(/^src\/pages\/index\.tscl:7:9 .*'class' does not exist/),
  ])
})

test('@extends button: the tag takes every button attribute, typed; others are reported', () => {
  const btn = '@extends button\n@input value: number = 0\n<button type="button">{{ value }}</button>\n'
  const page = `@import btn from '../components/btn.tscl'
<btn disabled form="f" name="n" formmethod="post" title="t" [value]="1">a</btn>
<btn type="nope">b</btn>
<btn href="/x">c</btn>
<btn [value]="'s'">d</btn>
`
  const errors = check({ 'src/components/btn.tscl': btn, 'src/pages/index.tscl': page })
  expect(errors).toEqual([
    expect.stringMatching(/^src\/pages\/index\.tscl:3:6 Type '"nope"' is not assignable to type '"button" \| "reset" \| "submit"/),
    expect.stringMatching(/^src\/pages\/index\.tscl:4:6 .*'href' does not exist/),
    expect.stringMatching(/^src\/pages\/index\.tscl:5:7 Type 'string' is not assignable to type 'number'/),
  ])
})

test('#review: check agrees with compile on fragment roots: beside <cl-head>, in an @if branch; class is reported too', () => {
  const head = '<cl-head><title>t</title></cl-head>\n<fragment><b>1</b><i>2</i></fragment>\n'
  const branch = '@input a: boolean = true\n@if (a) { <fragment><b>1</b><i>2</i></fragment> } @else { <p>3</p> }\n'
  const page = `@import head from '../components/head.tscl'
@import branch from '../components/branch.tscl'
<head id="x" />
<branch id="y" />
<head class="c" />
`
  const errors = check({ 'src/components/head.tscl': head, 'src/components/branch.tscl': branch, 'src/pages/index.tscl': page })
  expect(errors).toEqual([
    expect.stringMatching(/^src\/pages\/index\.tscl:3:7 .*'id' does not exist/),
    expect.stringMatching(/^src\/pages\/index\.tscl:4:9 .*'id' does not exist/),
    expect.stringMatching(/^src\/pages\/index\.tscl:5:7 .*'class' does not exist/),
  ])
})

test('#594 review: a script error that mentions @input doesn\'t make tolerant recovery blank a valid @input', async () => {
  const { generateTolerant } = await import('../../src/check/generate.ts')
  const src = '@input n: number\n<script>\n  let x: number = n\n</script>\n<p>{{ x }}</p>\n'
  const { result, errors } = generateTolerant(src, 'x.tscl')
  expect(errors).toEqual([expect.objectContaining({ message: expect.stringMatching(/^TypeScript syntax in a <script>.*a type annotation/) })])
  expect(result!.code).toMatch(/\bn: number/) // the input is still there
})
