// #303: .tscl files formatted by Prettier, with this plugin: the head kept, the template by Prettier's Angular
// formatter, <script> and <style> by its JavaScript and CSS ones.
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { format } from 'prettier'
import { parse } from 'clarusjs/compiler'
import { expect, test } from 'vitest'
import * as plugin from '../src/index.ts'

const fmt = (text: string, options = {}) => format(text, { parser: 'tscl', plugins: [plugin], ...options })

test('a component: head kept, then the template indented, script and style formatted', async () => {
  const src = `@import pill from './pill.tscl'
@input   title: string
@input items: { id: number; name: string }[] = []
{{-- a note --}}
<script>
let open=state(false)
function toggle(){open=!open}
</script>
<section class="card">@if (open) {<ul>@for (item of items; track item.id) {<li>{{ item.name }}</li>} @empty {<li>None</li>}</ul>} @else {<p>Closed</p>}
<button (click)="toggle()">{{ title }}</button><pill [text]="'new'" /></section>
<style scoped>
:scope{border:1px solid}
</style>
`
  expect(await fmt(src)).toBe(`@import pill from './pill.tscl'
@input   title: string
@input items: { id: number; name: string }[] = []
{{-- a note --}}

<script>
  let open = state(false);
  function toggle() {
    open = !open;
  }
</script>
<section class="card">
  @if (open) {
    <ul>
      @for (item of items; track item.id) {
        <li>{{ item.name }}</li>
      } @empty {
        <li>None</li>
      }
    </ul>
  } @else {
    <p>Closed</p>
  }
  <button (click)="toggle()">{{ title }}</button><pill [text]="'new'" />
</section>
<style scoped>
  :scope {
    border: 1px solid;
  }
</style>
`)
})

test('comments, verbatim contents and @slot come back as written', async () => {
  const out = await fmt(`<card>@slot('title') {<b>T</b>}{{-- keep {{ me }} --}}<p>body</p></card>\n<pre><code verbatim>@input x: string\n{{ not a hole }}</code></pre>\n`)
  expect(out).toContain("@slot('title') {")
  expect(out).toContain('{{-- keep {{ me }} --}}')
  expect(out).toContain('<code verbatim>@input x: string\n{{ not a hole }}</code>')
  expect(out).not.toContain('__cl_')
})

test('the project\'s options apply (single quotes, no semicolons, width)', async () => {
  const out = await fmt('<script>\nlet a = state("x")\n</script>\n<p>{{ a }}</p>\n', { singleQuote: true, semi: false })
  expect(out).toContain("let a = state('x')\n")
})

// Every component of the docs site and the theme: formatting is stable, and the result means the same.
const roots = ['../../docs/src', '../../theme-docs/src'].map((r) => resolve(import.meta.dirname, r))
const files = roots.flatMap((root) => (readdirSync(root, { recursive: true }) as string[]).filter((f) => f.endsWith('.tscl')).map((f) => join(root, f)))
const shape = (text: string) => JSON.stringify(parse(text, 'x.tscl'), (key, value) => {
  if (typeof value === 'number') return undefined // offsets move (the tree's only numbers)
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').replace(/"/g, "'").replace(/;\s*\}/g, ' }').replace(/[;\s]/g, '').replace(/,(?=[)\]}])/g, '').replace(/[()]/g, '')
  // Whitespace-only text between elements comes and goes as lines are broken.
  if (Array.isArray(value)) return value.filter((n) => !(n?.type === 'text' && !String(n.value).trim()))
  return value
})

test.each(files.map((f) => [f.slice(f.indexOf('packages/')), f]))('%s: stable, and the same structure', async (_, file) => {
  const src = readFileSync(file, 'utf8')
  const once = await fmt(src, { printWidth: 120 })
  expect(await fmt(once, { printWidth: 120 })).toBe(once)
  expect(shape(once)).toBe(shape(src))
})

test('an @ in text that isn\'t a block stays text (<code>@for</code>, a package name, an email); attributes and scripts untouched', async () => {
  const src = '<p>See <code>@for</code>, <code>@clarusjs/content</code> and me@example.com.</p>\n<input placeholder="a@b.c">\n<style scoped>\n@media (min-width: 1px) { p { color: red } }\n</style>\n'
  const out = await fmt(src)
  expect(out).toContain('<code>@for</code>')
  expect(out).toContain('<code>@clarusjs/content</code>')
  expect(out).toContain('me@example.com')
  expect(out).toContain('placeholder="a@b.c"')
  expect(out).toContain('@media (min-width: 1px)')
  expect(out).not.toContain('&#')
})

test('a template Prettier can\'t format is an error with its reason, never an empty file', async () => {
  await expect(fmt('@if (a) {\n<p>x</p>\n')).rejects.toThrow(/block/i)
})

test('an entity the author wrote (&#64;, &#064;) stays as written; @ in comments and quoted > in attributes are fine', async () => {
  const src = '<p>Write &#64;if or &#064;for.</p>\n<!-- see @if -->\n<a title="a > b @x" href="/">x</a>\n'
  const out = await fmt(src)
  expect(out).toContain('Write &#64;if or &#064;for.')
  expect(out).toContain('<!-- see @if -->')
  expect(out).toContain('title="a > b @x"')
})

// Review of #303: each case formats to the same meaning, and formatting twice changes nothing.
const same = async (src: string, options = {}) => {
  const once = await fmt(src, options)
  expect(await fmt(once, options)).toBe(once)
  expect(shape(once)).toBe(shape(src))
  return once
}

test('a multi-line @type with a generic keeps the lines after it (R1)', async () => {
  const out = await same("@type P = Map<\n  string,\n  number\n>\n@input p: P\n<p>{{ p }}</p>\n")
  expect(out).toContain('@type P = Map<\n  string,\n  number\n>\n@input p: P\n')
})

test('a hole with a bitwise | keeps its parentheses (R2)', async () => {
  expect(await same('<p>{{ (a || b) | c }}</p>\n')).toContain('{{ (a || b) | c }}')
})

test('a top-level @word never lands at a line start; a directive after the template moves to the head (R3)', async () => {
  const long = '<b>x</b> some long top level text that goes on and on and on past the print width and mentions @clarusjs/content here\n'
  const out = await same(long)
  expect(out).not.toMatch(/^\s*@clarusjs/m)
  const moved = await same("<script>\nlet a = state(1)\n</script>\n@import Foo from './foo.tscl'\nhello <b>x</b>\n")
  expect(moved.startsWith("@import Foo from './foo.tscl'\n")).toBe(true)
})

test('literal { and } in text format (R4), and a quoted > before verbatim', async () => {
  for (const src of ['<code>function f() { return 1 }</code>\n', '<p>a } b</p>\n', "<p>Use {{ '{' }} a }</p>\n", '@if (a) {<p>a } b</p>}\n', '<pre data-x="a>b" verbatim>{ raw }</pre>\n']) {
    await same(src)
  }
})

test('blank lines before @else and @empty: stable (R6)', async () => {
  await same('@if (a) {<p>a</p>}\n\n@else {<p>b</p>}\n')
  await same('<ul>@for (x of xs; track x) {<li>{{ x }}</li>}\n\n@empty {<li>none</li>}</ul>\n')
})

test('an inline block keeps the whitespace around and inside it (R7)', async () => {
  expect(await same('<p>Hello @if (x) {<b>world</b>}!</p>\n')).toContain('Hello @if (x) {<b>world</b>}!')
})

test('@else and @empty as text right after a hole (R8)', async () => {
  await same('<p>{{ n }}@empty</p>\n')
  await same('<p>Count {{ n }} @else text</p>\n')
})

test('@slot text in a script or an attribute is left alone (R9)', async () => {
  const out = await same('<script>\nconst s = "@slot  (\'x\')"\n</script>\n<a title="see @slot (x)">x</a>\n')
  expect(out).toContain('"@slot  (\'x\')"')
  expect(out).toContain('title="see @slot (x)"')
})

test('an author comment that looks like a placeholder stays (R10)', async () => {
  const out = await same('<p>{{-- note --}}<!--cl:0--></p>\n')
  expect(out).toContain('{{-- note --}}')
  expect(out).toContain('<!--cl:0-->')
})

test('a file the compiler rejects is an error, not a reformat', async () => {
  await expect(fmt('<p>\n')).rejects.toThrow(/unclosed/)
})

test('cases that were already right stay right after the rewrite', async () => {
  for (const src of [
    '', '@input a: string\n', '{{-- only a note --}}\n', '<p>a</p>\r\n<p>b</p>\r\n',
    '<pre>  keep\n   this</pre>\n<textarea>  x</textarea>\n',
    '<a title="x@y.z {{ \'@if\' }}">{{ "@for {" }}</a>\n',
    '<script inline>\nwindow.x = { a: 1 }\n</script>\n<script type="application/ld+json">{"a": {"b": 1}}</script>\n',
    '@input f: (a: string) => number = (a) => a.length\n<p>{{ f("x") }}</p>\n',
    '@type T = {\n  a: string\n}\n<p>x</p>\n',
    '<ul>@for (x of [{ a: 1 }]; track x.a) {<li>{{ $index }} {{ x.a }}</li>}</ul>\n',
    '<myCard [(value)]="form.name" /><myCard>@slot(\'title\') {<b>T</b>}</myCard>\n',
  ]) await same(src)
})

test('a block next to a hole, or inside an inline element, is kept as written (the docs brand link)', async () => {
  const hole = '<span>{{ a }}@if (b) {<span class="js">{{ b }}</span>}</span>'
  expect(await same(`<div>${hole}</div>\n`)).toContain(hole)
  const link = '<a class="brand" href="/">@if (logo) {<img [src]="logo" alt="">}<span>x</span></a>'
  expect(await same(`<header>${link}</header>\n`)).toContain('@if (logo) {<img [src]="logo" alt="">}')
  // A block among block elements is still laid out.
  expect(await same('<ul>@for (x of xs; track x) {<li>{{ x }}</li>}</ul>\n')).toContain('\n  @for (x of xs; track x) {\n    <li>')
})

test('only blocks of block-level elements are laid out; a block of inline pieces stays as written (release notes)', async () => {
  const li = "<li>@for (part of text.split('`'); track $index) {@if ($index % 2) {<code>{{ part }}</code>} @else {<span>{{ part }}</span>}} @if (pr) {<a [href]=\"url\">{{ pr }}</a>}</li>"
  const out = await same(`<ul>@for (c of changes; track c.url) {${li}}</ul>\n`)
  expect(out).toContain(li)
  expect(out).toContain('<ul>\n  @for (c of changes; track c.url) {\n')
  // Components: their display isn't known, so a block of them stays as written too.
  expect(await same('<div>@for (x of xs; track x) {<card [x]="x" />}</div>\n')).toContain('@for (x of xs; track x) {<card [x]="x" />}')
})

test('a block of options in a <select> is laid out, and formatting is stable (signup form)', async () => {
  const out = await same('<label><span>L</span> <select multiple [(value)]="v">@for (l of langs; track l.id) {<option [value]="l.id">{{ l.label }}</option>}</select></label>\n')
  expect(out).toContain('@for (l of langs; track l.id) {\n')
})

// CodeRabbit review of #306.
test('an attribute value with &quot; keeps its double quotes (clarusjs rejects single-quoted values)', async () => {
  expect(await same('<a title="it&apos;s &quot;x&quot;">x</a>\n')).toContain('title="it&apos;s &quot;x&quot;"')
})

test('a {{-- --}} comment inside verbatim contents stays verbatim, with what follows it', async () => {
  expect(await same('<code verbatim>{{-- note --}}@if (ok) {x}</code>\n')).toContain('<code verbatim>{{-- note --}}@if (ok) {x}</code>')
})

test('a bitwise | in a binding keeps its parentheses ([prop], (event), [(model)] alike)', async () => {
  const out = await same('<p [title]="(a || b) | c" (click)="x = (a || b) | c">x</p>\n')
  expect(out).toContain('[title]="(a || b) | c"')
  expect(out).toContain('(click)="x = (a || b) | c"')
})

test('a directive\'s multi-line default keeps its spaces', async () => {
  expect(await same('@input message: string = `hello  \nworld`\n<p>{{ message }}</p>\n')).toContain('`hello  \nworld`')
})

test('a kept hole is restored when Prettier wraps it', async () => {
  const out = await same('<p>{{ (a || b) | c }}</p>\n', { printWidth: 10 })
  expect(out).toContain('{{ (a || b) | c }}')
  expect(out).not.toContain('__cl')
})

test('#430: @await, @then and @catch are laid out like @if / @else, their headers as written, and stay stable', async () => {
  const input = '<section>\n@await (load(id,  2)) { <p>Loading…</p> } @then (rows) {\n<ul>@for (r of rows; track r.id) {<li>{{ r.name }}</li>}</ul> } @catch (e) { <p role="alert">{{ e.message }}</p> }\n</section>\n'
  const out = await format(input, { parser: 'tscl', plugins: [plugin] })
  expect(out).toBe(`<section>
  @await (load(id,  2)) {
    <p>Loading…</p>
  } @then (rows) {
    <ul>
      @for (r of rows; track r.id) {
        <li>{{ r.name }}</li>
      }
    </ul>
  } @catch (e) {
    <p role="alert">{{ e.message }}</p>
  }
</section>
`)
  expect(await format(out, { parser: 'tscl', plugins: [plugin] })).toBe(out)
})

test('#442 @event and #456 @layout are directives: kept as written, also with an object type', async () => {
  const src = "@layout none\n@model values: string[] = []\n@event change: { value: string; selected: boolean }\n@event close\n<script>\n  let n = state(0)\n</script>\n<p>{{ n }}</p>\n"
  const out = await fmt(src)
  expect(out.startsWith('@layout none\n@model values: string[] = []\n@event change: { value: string; selected: boolean }\n@event close\n\n<script>')).toBe(true)
  expect(await fmt(out)).toBe(out)
})
