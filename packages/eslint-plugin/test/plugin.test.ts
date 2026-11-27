// #305: ESLint on .tscl files: the project's rules on <script>, at the right place, and the template rules of
// clarusjs check through ESLint.
import { createRequire } from 'node:module'
import { Linter } from 'eslint'
import { expect, test } from 'vitest'
import clarusjs from '../src/index.ts'

const filename = 'src/components/counter.tscl'
const run = (code: string, rules: Linter.RulesRecord, extra: Partial<Linter.Config> = {}) =>
  new Linter().verify(code, [...clarusjs.configs.recommended, { files: ['**/*.tscl'], rules, ...extra }], filename)
const where = (messages: Linter.LintMessage[]) => messages.map((m) => `${m.line}:${m.column} ${m.ruleId}`)

const counter = `@input start: number = 0
@import { site } from '../site.ts'

<script>
  let count = state(start)
  const double = derived(() => count * 2)
  function add() {
    count++
  }
  const label = site.name
</script>

<button (click)="add()">{{ label }} {{ count }} {{ double }}</button>
`

test('a script rule is reported at its line and column in the .tscl file', () => {
  const messages = run(counter.replace('const double', 'let double'), { 'prefer-const': 'error' })
  expect(where(messages)).toEqual(['6:7 prefer-const'])
})

test("the file's inputs, imported data and state()/derived()/shared() are known; other names aren't", () => {
  expect(run(counter, { 'no-undef': 'error' })).toEqual([])
  expect(where(run(counter.replace('count * 2', 'count * missing'), { 'no-undef': 'error' }))).toEqual(['6:40 no-undef'])
})

test('a script name the template reads is used; one nothing reads is not', () => {
  expect(run(counter, { 'no-unused-vars': 'error' })).toEqual([])
  const messages = run(counter.replace('  const label', '  function unused() {}\n  const label'), { 'no-unused-vars': 'error' })
  expect(where(messages)).toEqual(['10:12 no-unused-vars'])
})

test('fixes apply to the .tscl file and leave the template alone', () => {
  const out = new Linter().verifyAndFix(counter.replace('const double', 'let double'), [...clarusjs.configs.recommended, { files: ['**/*.tscl'], rules: { 'prefer-const': 'error' } }], filename)
  expect(out.output).toBe(counter)
})

test('the template rules of clarusjs check, through clarusjs/template', () => {
  const messages = run('<img src="/a.png" />\n<p>\n  <button></button>\n</p>\n', {})
  expect(messages.map((m) => `${m.line}:${m.column} ${m.ruleId} ${m.severity} ${m.message}`)).toEqual([
    '1:1 clarusjs/template 1 <img> without alt: describe the image, or use alt="" when it is decoration (img-alt)',
    '2:1 clarusjs/template 1 a component renders one root element, for what a parent passes it (attributes, class, events) to land on: wrap these in an element, or in <fragment> if no element is wanted (one-root)',
    '3:3 clarusjs/template 1 <button> has no accessible name: give it text, aria-label or title (accessible-name)',
  ])
  // Levels as the rule's option; an ignore comment works as in check.
  expect(run('<img src="/a.png" />\n<button></button>\n', { 'clarusjs/template': ['error', { 'img-alt': 'off', 'one-root': 'off' }] }).map((m) => m.message)).toEqual([
    '<button> has no accessible name: give it text, aria-label or title (accessible-name)',
  ])
  expect(run('{{-- clarusjs-ignore --}}\n<img src="/a.png" />\n', {})).toEqual([])
})

test("a project's own lint rules, from settings.clarusjs.lintRules", () => {
  const noB = { name: 'no-b', check: ({ elements, report }: { elements: { tag: string; start: number }[]; report(s: number, m: string): void }) => { for (const e of elements) if (e.tag === 'b') report(e.start, 'no <b>') } }
  expect(run('<p><b>x</b></p>\n', {}, { settings: { clarusjs: { lintRules: [noB] } } }).map((m) => `${m.line}:${m.column} ${m.message}`)).toEqual(['1:4 no <b> (no-b)'])
})

test('a template syntax error is a parsing error at its place', () => {
  const [m] = run('<p>a</p>\n<div>\n  <span>\n', {})
  expect(m).toMatchObject({ fatal: true, line: 3, column: 3, message: expect.stringContaining('unclosed <span>') })
})

test('a component without a script lints its template only', () => {
  expect(run('@input title: string\n<h1>{{ title }}</h1>\n', { 'no-undef': 'error', 'no-unused-vars': 'error' })).toEqual([])
})

test('parserOptions.parser: another parser (typescript-eslint, …) gets the script with every offset kept', () => {
  const seen: string[] = []
  const espree = createRequire(createRequire(import.meta.url).resolve('eslint'))('espree') as { parse(code: string, options: object): unknown }
  const parser = {
    parse(code: string, options: object) {
      seen.push(code)
      return espree.parse(code, { ...options, ecmaVersion: 'latest', sourceType: 'module', range: true, loc: true, tokens: true, comment: true })
    },
  }
  const source = counter.replace('const double', 'let double')
  const messages = run(source, { 'prefer-const': 'error' }, { languageOptions: { parserOptions: { parser } } })
  expect(where(messages)).toEqual(['6:7 prefer-const'])
  expect(seen[0]!.length).toBe(source.length)
  expect(seen[0]!.slice(0, counter.indexOf('<script>') + 8).trim()).toBe('')
  expect(seen[0]).toContain('let count = state(start)')
})

test('prefer-const leaves `let` state alone: the template or a copy-on-write update writes it, where ESLint cannot see', () => {
  const source = '<script>\n  let open = state(false)\n  let label = "x"\n  let items = shared(store)\n  let twice = derived(() => 2)\n</script>\n<button (click)="open = !open">{{ label }} {{ items }} {{ twice }}</button>\n'
  // A shared() store is written the same way; derived() is read-only, so const it is.
  expect(where(run(source, { 'prefer-const': 'error' }, { languageOptions: { globals: { store: 'readonly' } } }))).toEqual(['3:7 prefer-const', '5:7 prefer-const'])
})

test('template fixes apply through --fix: several roots are wrapped in <fragment>', () => {
  const out = new Linter().verifyAndFix('<h1>a</h1>\n<p>b</p>\n', [...clarusjs.configs.recommended, { files: ['**/*.tscl'] }], filename)
  expect(out.output).toBe('<fragment>\n<h1>a</h1>\n<p>b</p>\n</fragment>\n')
  expect(out.messages).toEqual([])
})

test("a script name read only in @transition's arguments is used", () => {
  const source = "<script>\n  let open = state(true)\n  const slide = { mode: 'out-in' }\n</script>\n\n<div>\n  <button (click)=\"open = !open\">Toggle</button>\n  @transition ('slide', slide) { @if (open) { <p>A</p> } }\n</div>\n"
  expect(run(source, { 'no-unused-vars': 'error' })).toEqual([])
})

test("a script name read only in @transition's arguments around a @for is used", () => {
  const source = "<script>\n  let xs = state([1])\n  const opts = { appear: true }\n</script>\n\n<ul>\n  @transition ('list', opts) { @for (x of xs; track x) { <li>{{ x }}</li> } }\n</ul>\n"
  expect(run(source, { 'no-unused-vars': 'error' })).toEqual([])
})
