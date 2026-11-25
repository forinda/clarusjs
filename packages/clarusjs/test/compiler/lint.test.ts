// #304: template lint rules only clarusjs understands, located like compile errors.
import { expect, test } from 'vitest'
import { lint, type LintRuleDef } from '../../src/compiler/index.ts'

const file = 'src/pages/x.tscl' // a page: several top-level elements are fine (one-root has its own test)
const rules = (source: string, config?: Parameters<typeof lint>[2]) => lint(source, file, config).map((m) => `${m.line}:${m.column} ${m.severity} ${m.rule}`)

test('a clean component has nothing to say', () => {
  const source = `@import badge from './badge.tscl'
@import { site } from '../site.ts'
@input title: string
@input count: number = 0
<script>
  let n = state(count)
</script>
<h1>{{ title }} {{ site.name }}</h1>
<badge [n]="n" />
<img src="/a.png" alt="A" />
<img src="/b.png" alt="" />
<label>Name <input /></label>
<label for="e">Email</label><input id="e" />
<button (click)="n++">Add</button>
<button aria-label="Close">×</button>
<a href="/x"><img src="/i.png" alt="Home" /></a>
<a href="/y">{{ title }}</a>
`
  expect(lint(source, file)).toEqual([])
})

test('unused-input: an @input (or @model) the template and script never read', () => {
  expect(rules('@input title: string\n@input used: string\n@model open: boolean = false\n<p>{{ used }}</p>\n')).toEqual([
    '1:1 warning unused-input',
    '3:1 warning unused-input',
  ])
  // Read in the script, in an attribute, in an @if, an @for, an interpolated attribute, or another input's default.
  expect(rules('@input a: number\n@input b: string\n@input c: boolean\n@input d: string[]\n@input e: string\n@input f: number = a\n<script>\n  const x = derived(() => f)\n</script>\n<p [title]="b" class="k-{{ e }}">@if (c) {<i>{{ x }}</i>}</p>\n@for (i of d; track i) {<b>{{ i }}</b>}\n')).toEqual([])
  // A name inside a longer one, or a property of something else, isn't a read.
  expect(rules('@input name: string\n<p>{{ user.name }} {{ names }}</p>\n')).toEqual(['1:1 warning unused-input'])
})

test('unused-import: a component never used as a tag, and data never read', () => {
  expect(rules("@import card from './card.tscl'\n@import { a, b as c } from './data.ts'\n<p>{{ a }}</p>\n")).toEqual([
    '1:1 warning unused-import',
    '2:1 warning unused-import',
  ])
  expect(lint("@import { a, b as c } from './data.ts'\n<p>{{ a }}</p>\n", file)[0]!.message).toBe("'c' is imported but never used")
  // Used in a slot fill, in a branch, or as a type.
  expect(rules("@import card from './card.tscl'\n@import { Kind } from './kinds.ts'\n@input k: Kind\n@if (k) {<card />}\n")).toEqual([])
})

test('img-alt: every <img> has an alt, empty for decoration', () => {
  expect(rules('<img src="/a.png" />\n<img [alt]="x" src="/b.png" />\n')).toEqual(['1:1 warning img-alt'])
})

test('label-field: a <label> names a field, by for="…" or by holding one', () => {
  expect(rules('<label>Name</label>\n<label>Pick <select></select></label>\n<label [for]="id">Id</label>\n')).toEqual(['1:1 warning label-field'])
  // A component or a slot may render the field: given the benefit of the doubt.
  expect(rules("@import field from './field.tscl'\n<label>Name <field /></label>\n<label><slot /></label>\n")).toEqual([])
})

test('accessible-name: a button or link with no text, label or title', () => {
  expect(rules('<button></button>\n<a href="/x"><svg></svg></a>\n<a href="/y"><img src="/i.png" alt="" /></a>\n<a name="top"></a>\n')).toEqual([
    '1:1 warning accessible-name',
    '2:1 warning accessible-name',
    '3:1 warning accessible-name',
  ])
  expect(rules('<button title="Close"><svg></svg></button>\n<button><slot /></button>\n<a [href]="u" aria-labelledby="t"></a>\n')).toEqual([])
})

test('rules nested in @if, @for and slot fills are found too', () => {
  expect(rules('@if (true) {\n  @for (i of [1]; track i) {\n    <img src="/a.png" />\n  }\n}\n')).toEqual(['3:5 warning img-alt'])
})

test('a {{-- clarusjs-ignore --}} comment skips the next line: all rules, or the ones it names', () => {
  expect(rules('{{-- clarusjs-ignore img-alt --}}\n<img src="/a.png" />\n<img src="/b.png" />\n')).toEqual(['3:1 warning img-alt'])
  expect(rules('{{-- clarusjs-ignore --}}\n<button><img src="/a.png" /></button>\n')).toEqual([])
  expect(rules('{{-- clarusjs-ignore label-field --}}\n<img src="/a.png" />\n')).toEqual(['2:1 warning img-alt'])
  expect(rules('<img src="/a.png" /> {{-- clarusjs-ignore img-alt --}}\n')).toEqual([]) // or the same line
})

test('rules can be turned off, or raised to errors', () => {
  expect(rules('<img src="/a.png" />\n<button></button>\n', { 'img-alt': 'off', 'accessible-name': 'error' })).toEqual(['2:1 error accessible-name'])
})

test('messages say what to do, and locations are 1-based', () => {
  const [m] = lint('<p>\n  <img src="/a.png" />\n</p>\n', file)
  expect(m).toMatchObject({ rule: 'img-alt', severity: 'warning', file, line: 2, column: 3 })
  expect(m!.message).toBe('<img> without alt: describe the image, or use alt="" when it is decoration')
})

test("a project's own rules run beside the built-in ones, with the same levels and ignores", () => {
  // The recipe from the Lint guide: no inline style="…", so styles stay in <style> blocks.
  const noInlineStyle: LintRuleDef = {
    name: 'no-inline-style',
    check({ elements, report }) {
      for (const el of elements) {
        const style = el.attrs.find((a) => a.name === 'style')
        if (style) report(style.start, `inline style on <${el.tag}>: move it to a <style> block`)
      }
    },
  }
  const source = '<p style="color: red">a</p>\n{{-- clarusjs-ignore no-inline-style --}}\n<b style="x">b</b>\n<img src="/a.png" />\n'
  expect(lint(source, file, {}, [noInlineStyle]).map((m) => `${m.line}:${m.column} ${m.severity} ${m.rule} ${m.message}`)).toEqual([
    '1:4 warning no-inline-style inline style on <p>: move it to a <style> block',
    '4:1 warning img-alt <img> without alt: describe the image, or use alt="" when it is decoration',
  ])
  expect(lint(source, file, { 'no-inline-style': 'error', 'img-alt': 'off' }, [noInlineStyle]).map((m) => m.severity)).toEqual(['error'])
})

test('a rule that throws is reported as its own finding, not a crash', () => {
  const broken: LintRuleDef = { name: 'broken', check() { throw new Error('oops') } }
  expect(lint('<p></p>\n', file, {}, [broken])).toEqual([expect.objectContaining({ rule: 'broken', severity: 'error', line: 1, column: 1, message: 'the rule failed: oops' })])
})

test('one-root: a component renders one root element (or a fragment, a slot, an @if chain of one each)', () => {
  const component = 'src/components/x.tscl'
  const one = (source: string, f = component) => lint(source, f).filter((m) => m.rule === 'one-root').map((m) => `${m.line}:${m.column} ${m.severity}`)
  expect(one('<h1>a</h1>\n<p>b</p>\n')).toEqual(['2:1 warning'])
  expect(one('text <b>x</b>\n')).toEqual(['1:1 warning'])
  expect(one('@for (n of [1]; track n) { <i>{{ n }}</i> }\n')).toEqual(['1:1 warning'])
  expect(one('<div><h1>a</h1><p>b</p></div>\n<style scoped>div {}</style>\n')).toEqual([])
  expect(one('<fragment><h1>a</h1><p>b</p></fragment>\n')).toEqual([])
  expect(one('<slot />\n')).toEqual([])
  expect(one('@input a: boolean\n@if (a) { <a href="/">x</a> } @else { <span>x</span> }\n')).toEqual([])
  expect(one('@input a: boolean\n@if (a) { <a href="/">x</a> }\n')).toEqual(['2:1 warning'])
  // Pages, layouts and whole documents are exempt.
  expect(one('<h1>a</h1>\n<p>b</p>\n', 'src/pages/index.tscl')).toEqual([])
  expect(one('<header /><slot /><footer />\n', 'src/layouts/docs.tscl')).toEqual([])
  expect(one('<html><body><slot /></body></html>\n')).toEqual([])
  expect(lint('<h1>a</h1>\n<p>b</p>\n', component, { 'one-root': 'error' })[0]?.severity).toBe('error')
})

test('#review: one-root: a fragment in an @if branch is not one element', () => {
  const one = (source: string) => lint(source, 'src/components/x.tscl').filter((m) => m.rule === 'one-root').length
  expect(one('@input a: boolean\n@if (a) { <fragment><b>1</b><i>2</i></fragment> } @else { <p>3</p> }\n')).toBe(1)
})

test('#review: one-root: an HTML comment beside the root is not another root', () => {
  expect(lint('<!-- note -->\n<p>x</p>\n<!-- end -->\n', 'src/components/x.tscl').filter((m) => m.rule === 'one-root')).toEqual([])
})

test('one-root fix: wraps the top level in <fragment>, leaving the rest of the file; the HTML is the same', async () => {
  const { applyFixes, compile } = await import('../../src/compiler/index.ts')
  const { importCode } = await import('../helpers.ts')
  const component = 'src/components/x.tscl'
  const source = '@input a: string = "A"\n<script>\n  let n = state(0)\n</script>\n\n<h1>{{ a }}</h1>\n<pre>  keep\n  this</pre>\n<button (click)="n++">{{ n }}</button>\n<!-- end -->\n\n<style scoped>\n  h1 { color: red; }\n</style>\n'
  const [m] = lint(source, component).filter((x) => x.rule === 'one-root')
  expect(m!.fix).toBeDefined()
  const fixed = applyFixes(source, [m!])
  expect(fixed).toBe('@input a: string = "A"\n<script>\n  let n = state(0)\n</script>\n\n<fragment>\n<h1>{{ a }}</h1>\n<pre>  keep\n  this</pre>\n<button (click)="n++">{{ n }}</button>\n</fragment>\n<!-- end -->\n\n<style scoped>\n  h1 { color: red; }\n</style>\n')
  expect(lint(fixed, component).filter((x) => x.rule === 'one-root')).toEqual([])
  const html = async (src: string) => ((await importCode(compile(src, { file: 'x.tscl', target: 'server', clientUrl: '/x.js', scope: 's' }).code, 'fix')).render({}) as string)
  expect(await html(fixed)).toBe(await html(source))
})

test('applyFixes: several edits, from the end, skipping any that overlap; messages without one are ignored', async () => {
  const { applyFixes } = await import('../../src/compiler/index.ts')
  const at = (start: number, end: number, text: string) => ({ rule: 'r', severity: 'warning' as const, message: '', file: 'f', line: 1, column: 1, start, fix: { start, end, text } })
  expect(applyFixes('abcdef', [at(0, 1, 'X'), at(4, 6, 'YZ!'), { ...at(2, 3, 'Q'), fix: undefined }])).toBe('XbcdYZ!')
  expect(applyFixes('abcdef', [at(0, 3, 'X'), at(2, 4, 'Y')])).toBe('Xdef')
})

test('#review: one-root fix: none when a <script> or <style> sits between the roots; text and CRLF keep their rendering', async () => {
  const { applyFixes, compile } = await import('../../src/compiler/index.ts')
  const { importCode } = await import('../helpers.ts')
  const component = 'src/components/x.tscl'
  const fixOf = (src: string) => lint(src, component).find((m) => m.rule === 'one-root')?.fix
  expect(fixOf('<a>1</a>\n<script>\n  let c = state(0)\n</script>\n<b (click)="c++">2</b>\n')).toBeUndefined()
  expect(fixOf('<a>1</a>\n<script server>\n  const x = 1\n</script>\n<b>{{ x }}</b>\n')).toBeUndefined()
  expect(fixOf('<a>1</a>\n<style>\n  a {}\n</style>\n<b>2</b>\n')).toBeUndefined()
  const html = async (src: string) => (await importCode(compile(src, { file: 'x.tscl', target: 'server', clientUrl: '/x.js', scope: 's' }).code, 'fixr')).render({}) as string
  for (const src of ['hello {{ 1 }}\n', 'Hi <b>there</b> friend\n', '<b>a</b>\r\n<i>b</i>\r\n']) {
    const [m] = lint(src, component).filter((x) => x.rule === 'one-root')
    const fixed = applyFixes(src, [m!])
    expect(await html(fixed), src).toBe(await html(src))
    if (src.includes('\r\n')) expect(fixed.replace(/\r\n/g, '')).not.toContain('\n')
  }
})

test('#review 2: no fix around a declaration between the roots; a final text keeps its ending', async () => {
  const { applyFixes, compile } = await import('../../src/compiler/index.ts')
  const { importCode } = await import('../helpers.ts')
  const component = 'src/components/x.tscl'
  const fixOf = (src: string) => lint(src, component).find((m) => m.rule === 'one-root')?.fix
  expect(fixOf('a\n@input name: string = "Ada"\n{{ name }}\n')).toBeUndefined()
  expect(fixOf('<a>1</a>\n@import { x } from "./x.ts"\n<b>{{ x }}</b>\n')).toBeUndefined()
  expect(fixOf("<p>a</p>\n@import './card.css'\n<p>b</p>\n")).toBeUndefined()
  expect(fixOf("<p>a</p>\n@event pick: string\n<p>b</p>\n")).toBeUndefined()
  expect(fixOf("<p>a</p>\n@extends p\n<p>b</p>\n")).toBeUndefined()
  const html = async (src: string) => (await importCode(compile(src, { file: 'x.tscl', target: 'server', clientUrl: '/x.js', scope: 's' }).code, 'fixr2')).render({}) as string
  for (const src of ['Hello <b>x</b>', 'Hello <b>x</b> there', '<b>x</b>\nHello']) {
    const fixed = applyFixes(src, lint(src, component).filter((m) => m.rule === 'one-root'))
    expect(await html(fixed), src).toBe(await html(src))
  }
})
