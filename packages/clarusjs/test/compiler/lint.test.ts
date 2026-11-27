// #304: template lint rules only clarusjs understands, located like compile errors.
import { expect, test } from 'vitest'
import { lint, type LintRuleDef } from '../../src/compiler/index.ts'

const file = 'src/pages/x.tscl' // a page: several top-level elements are fine (one-root has its own test)
// One-word names (card) in these sources: multi-word-name is off here but in its own test.
const rules = (source: string, config?: Parameters<typeof lint>[2]) => lint(source, file, { 'multi-word-name': 'off', ...config }).map((m) => `${m.line}:${m.column} ${m.severity} ${m.rule}`)

test('a clean component has nothing to say', () => {
  const source = `@import siteBadge from './badge.tscl'
@import { site } from '../site.ts'
@input title: string
@input count: number = 0
<script>
  let n = state(count)
</script>
<h1>{{ title }} {{ site.name }}</h1>
<siteBadge [n]="n" />
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
  const html = async (src: string) => (await importCode(compile(src, { file: 'x.tscl', target: 'server', clientUrl: '/x.js', scope: 's' }).code, 'fixr2')).render({}) as string
  for (const src of ['Hello <b>x</b>', 'Hello <b>x</b> there', '<b>x</b>\nHello']) {
    const fixed = applyFixes(src, lint(src, component).filter((m) => m.rule === 'one-root'))
    expect(await html(fixed), src).toBe(await html(src))
  }
})

test('one-root fix: declarations, <script> and <style> between the roots move above them, in order; the HTML is the same', async () => {
  const { applyFixes, compile } = await import('../../src/compiler/index.ts')
  const { importCode } = await import('../helpers.ts')
  const component = 'src/components/x.tscl'
  const fix = (src: string) => applyFixes(src, lint(src, component).filter((m) => m.rule === 'one-root'))
  expect(fix("<p>a</p>\n@import './card.css'\n<script>\n  let n = state(0)\n</script>\n<p>{{ n }}</p>\n")).toBe("@import './card.css'\n<script>\n  let n = state(0)\n</script>\n<fragment>\n<p>a</p>\n<p>{{ n }}</p>\n</fragment>\n")
  const html = async (src: string) => (await importCode(compile(src, { file: 'x.tscl', target: 'server', clientUrl: '/x.js', scope: 's' }).code, 'hoist')).render({}) as string
  const cases = [
    'a\n@input name: string = "Ada"\n{{ name }}\n',
    '<a>1</a>\n<script>\n  let c = state(0)\n</script>\n<b (click)="c++">{{ c }}</b>\n',
    '<a>1</a>\n<script server>\n  const x = 1\n</script>\n<b>{{ x }}</b>\n',
    '<a>1</a>\n<style scoped>\n  a { color: red; }\n</style>\n<b>2</b>\n',
    '<p>a</p>\n@input u: string = "y"\n<!-- note -->\n@input t: string = "x"\n<p>{{ t }}{{ u }}</p>\n',
  ]
  for (const src of cases) {
    const fixed = fix(src)
    expect(lint(fixed, component).filter((m) => m.rule === 'one-root'), fixed).toEqual([])
    expect(await html(fixed), src).toBe(await html(src))
  }
  expect(fix(cases[4]!)).toContain('<fragment>\n<p>a</p>\n<!-- note -->\n<p>{{ t }}{{ u }}</p>') // a comment renders: it stays
})

// #543: a loop variable named like something the component declares hides it inside the loop: `[class]="item"`
// there reads the row, not the script's item (ui.clarusjs.com's Breadcrumb lost its separators to this).
test('for-shadow: an @for item named like a script name, an input, a model or an import', () => {
  const source = `@import badge from './badge.tscl'
@import { site } from '../site.ts'
@input title: string
@model open: boolean = false
<script>
  const item = 'not-last:after:ml-1'
  let rows = state([{ label: 'a' }])
  function pick() {}
</script>
<script server>
  const crumb = 'x'
</script>
<ul>
  @for (item of rows; track $index) { <li [class]="item">{{ item.label }} {{ title }} {{ site.name }} {{ crumb }} <badge /></li> }
  @for (pick of rows; track $index) { <li>{{ pick.label }}</li> }
  @for (title of rows; track $index) { <li>{{ title.label }}</li> }
  @for (open of rows; track $index) { <li>{{ open.label }}</li> }
  @for (badge of rows; track $index) { <li>{{ badge.label }}</li> }
  @for (site of rows; track $index) { <li>{{ site.label }}</li> }
  @for (crumb of rows; track $index) { <li>{{ crumb.label }}</li> }
  @for (row of rows; track $index) { <li>{{ row.label }}</li> }
</ul>
<button (click)="pick()">p</button>
`
  const found = lint(source, file).filter((m) => m.rule === 'for-shadow')
  expect(found.map((m) => `${m.line}:${m.column}`)).toEqual(['14:9', '15:9', '16:9', '17:9', '18:9', '19:9', '20:9'])
  expect(found[0]!.message).toBe("the row's item hides the script's item inside this @for: rename one of them")
  expect(found.map((m) => m.message.split(' hides ')[1]!.split(' inside')[0])).toEqual([
    "the script's item", "the script's pick", '@input title', '@model open', 'the import badge', 'the import site', "the server script's crumb",
  ])
})

test('for-shadow: a script it can\'t parse is left alone (the compiler reports it)', () => {
  expect(lint('<script>\n  let a = (\n</script>\n@for (a of [1]; track a) { <i>{{ a }}</i> }\n', file).filter((m) => m.rule === 'for-shadow')).toEqual([])
})

test('multi-word-name: a component imported under one word warns (it has no kebab-case tag); two words or more are fine', () => {
  const on = { 'multi-word-name': 'warn' } as const
  expect(rules("@import card from './card.tscl'\n@import UserCard from './card.tscl'\n@import uiCard from './card.tscl'\n<card /><UserCard /><ui-card />\n", on)).toEqual(['1:1 warning multi-word-name'])
  expect(lint("@import card from './card.tscl'\n<card />\n", file)[0]!.message).toBe("'card' is one word: give components two or more (e.g. appCard), so the tag has a kebab-case form and can't be mistaken for an HTML element")
  expect(rules("@import XMLViewer from './x.tscl'\n<XMLViewer />\n", on)).toEqual([]) // xml-viewer
})

test('#602 server-env-in-browser: an error by default, for process.env and unprefixed import.meta.env in browser scripts', () => {
  const source = `<script server>
  const key = process.env.API_KEY
</script>
<script>
  const a = process.env.API_KEY
  const mode = process.env.NODE_ENV
  const b = import.meta.env.SECRET
  const c = import.meta.env.VITE_PUBLIC_URL + import.meta.env.DEV + import.meta.env.BASE_URL
  let n = state(0)
</script>
<button (click)="n++">{{ n }} {{ key }}</button>
`
  const found = lint(source, file).filter((m) => m.rule === 'server-env-in-browser')
  expect(found.map((m) => `${m.line}:${m.column} ${m.severity}`)).toEqual(['5:13 error', '7:13 error'])
  expect(found[0]!.message).toBe("process.env runs in the browser here, where it doesn't exist: read API_KEY in <script server> or a load(), or name it VITE_API_KEY to send it to the browser")
  expect(found[1]!.message).toBe("import.meta.env.SECRET is never sent to the browser (only VITE_ variables are): read it in <script server> or a load(), or name it VITE_SECRET")
  expect(rules(source, { 'server-env-in-browser': 'warn' }).filter((r) => r.endsWith('server-env-in-browser'))).toEqual(['5:13 warning server-env-in-browser', '7:13 warning server-env-in-browser'])
  expect(rules('<script inline>console.log(process.env.TOKEN)</script>')).toEqual(['1:28 error server-env-in-browser'])
})

test('server-env-in-browser reads code, not comments or text: a mention in a string or comment is fine', () => {
  const source = `<script>
  // set process.env.API_KEY on the server
  const help = "Set process.env.API_KEY and import.meta.env.SECRET on the server"
  const shown = \`token: \${process.env.TOKEN}\`
  const other = config.process.env.X
  let n = state(0)
</script>
<button (click)="n++">{{ n }} {{ help }} {{ shown }} {{ other }}</button>
`
  expect(lint(source, file).filter((m) => m.rule === 'server-env-in-browser').map((m) => `${m.line}:${m.column}`)).toEqual(['4:27'])
})

test("server-env-in-browser takes the project's envPrefix: those variables reach the browser too", () => {
  const source = '<script>\n  const url = import.meta.env.PUBLIC_API_URL + import.meta.env.VITE_OTHER\n  let n = state(0)\n</script>\n<p>{{ n }} {{ url }}</p>\n'
  const found = lint(source, file, {}, [], { envPrefix: 'PUBLIC_' }).filter((m) => m.rule === 'server-env-in-browser')
  expect(found.map((m) => `${m.line}:${m.column}`)).toEqual(['2:48'])
  expect(found[0]!.message).toBe('import.meta.env.VITE_OTHER is never sent to the browser (only PUBLIC_ variables are): read it in <script server> or a load(), or name it PUBLIC_VITE_OTHER')
})
