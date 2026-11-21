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
