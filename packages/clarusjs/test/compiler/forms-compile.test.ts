// The compiler's part of the forms engine (clarusjs/forms): form(state) gets the signal, fields carry their paths,
// and [engine] connects a form.
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { importCode } from '../helpers.ts'

const client = (src: string) => compile(src, { file: 'a.tscl', target: 'client' }).code
const server = (src: string) => compile(src, { file: 'a.tscl', target: 'server', clientUrl: '/a.js' }).code

test('form(order) hands the engine the signal in the browser, the value on the server', () => {
  const src = "<script>\n  import { form } from 'clarusjs/forms'\n  let order = state({ name: '' })\n  const f = form(order, { show: 'blur' })\n</script>\n<p>{{ f.error('name') }}</p>\n"
  const out = client(src)
  expect(out).toContain("const f = form(order, { show: 'blur' })")
  expect(out).not.toContain('form(order.get()')
  expect(server(src)).toMatch(/form\(order, \{ show: 'blur' \}\)/)
})

test('form() of a shared store name passes the store signal; a form() of your own is left alone', () => {
  const shared = "<script>\n  import { form } from 'clarusjs/forms'\n  import { signup } from './store.ts'\n  let values = shared(signup)\n  const f = form(values)\n</script>\n<p>{{ f.error('name') }}</p>\n"
  expect(client(shared)).toContain('const f = form(values)')
  const own = "<script>\n  let order = state({ name: '' })\n  const form = (x) => x\n  const copy = form(order)\n</script>\n<p>{{ copy.name }}</p>\n"
  expect(client(own)).toContain('form(order.get())')
})

const renderOf = async (src: string, deps: Record<string, string> = {}, props = {}) =>
  (await importCode(server(src), 'forms-r', deps)).render(props) as string

test('every [(value)] / [(checked)] field carries its path, without the root name; rows get their index', async () => {
  const html = await renderOf(`<script>
  let order = state({ customer: { email: '' }, agree: false, lines: [{ item: 'a' }, { item: 'b' }] })
</script>
<input [(value)]="order.customer.email"><input type="checkbox" [(checked)]="order.agree">
@for (l of order.lines; track $index) {<input [(value)]="order.lines[$index].item">}
<input [(value)]="order['customer'].email">
`)
  expect(html).toContain('data-cl-path="customer.email"')
  expect(html).toContain('data-cl-path="agree"')
  expect(html).toContain('data-cl-path="lines.0.item"')
  expect(html).toContain('data-cl-path="lines.1.item"')
  expect(html.match(/data-cl-path="customer\.email"/g)).toHaveLength(2) // a bracket with a string key is a key
})

test('a component bound two ways carries its binding\'s path on its island; a field bound to its @model names it', async () => {
  const field = "@model value: string = ''\n<label><input [(value)]=\"value\"></label>\n"
  const fieldServer = compile(field, { file: 'field.tscl', target: 'server', clientUrl: '/field.js' }).code
  expect(await importCode(fieldServer, 'forms-f').then((m) => m.render({ value: 'x' }))).toContain('data-cl-path="@value"')
  const html = await renderOf(`@import field from './field.tscl'
<script>
  let order = state({ shipping: { street: '' } })
</script>
<field [(value)]="order.shipping.street" />
`, { './field.tscl?render': fieldServer, './field.tscl': fieldServer })
  expect(html).toMatch(/<cl-island c="field"[^>]* data-cl-path-value="shipping\.street"/)
  expect(html).not.toMatch(/p="[^"]*path/) // not a prop the child sees
})

const signup = (body: string) => `<script>
  import { form } from 'clarusjs/forms'
  let order = state({ name: '', lines: [{ item: '' }] })
  let other = state({ x: '' })
  const f = form(order)
</script>
${body}
`

test('[engine]="f" marks the element on the server and connects it in the browser', () => {
  const src = signup('<form [engine]="f"><input [(value)]="order.name"></form>')
  const out = client(src)
  expect(out).toContain("import { connect as __cl_connect } from 'clarusjs/forms'")
  expect(out).toMatch(/__cl_connect\(__cl_root, 0, \(\) => \(?f\)?\)/)
  const html = server(src)
  expect(html).toContain('data-cl-form=\\"0\\"')
  expect(html).not.toContain('engine')
  // A component without [engine] imports nothing from forms.
  expect(client("<script>\n  let a = state('')\n</script>\n<input [(value)]=\"a\">\n")).not.toContain('clarusjs/forms')
})

test('[engine] needs an island; fields under one [engine] bind one object', () => {
  expect(() => compile('<form [engine]="f"></form>\n', { file: 'a.tscl', target: 'client' })).toThrow(/^a\.tscl:1:7 \[engine\] needs a <script>/)
  expect(() => client(signup('<form [engine]="f"><input [(value)]="order.name">\n<input [(value)]="other.x"></form>'))).toThrow(/a\.tscl:8:8 fields under \[engine\] bind one object: found order and other/)
  // Outside the [engine] element, another object is fine.
  expect(() => client(signup('<form [engine]="f"><input [(value)]="order.name"></form>\n<input [(value)]="other.x">'))).not.toThrow()
})

test('review #233 (2): form imported under another name keeps the signal; a local `form` gets the value', () => {
  const aliased = "<script>\n  import { form as createForm } from 'clarusjs/forms'\n  let order = state({ name: '' })\n  const f = createForm(order)\n</script>\n<p>{{ f.error('name') }}</p>\n"
  expect(client(aliased)).toContain('const f = createForm(order)')
  const local = "<script>\n  import { form } from 'clarusjs/forms'\n  let order = state({ name: 'Ada' })\n  const f = form(order)\n  function read(form) { return form(order) }\n</script>\n<p>{{ f.error('name') }}</p>\n"
  expect(client(local)).toContain('return form(order.get())')
})

test('review #233 (2): a string-literal key is evaluated for the path (escapes decoded)', async () => {
  const html = await renderOf(`<script>\n  let order = state({ email: '' })\n</script>\n<input [(value)]="order['\\u0065mail']">\n`)
  expect(html).toContain('data-cl-path="email"')
})

test('review #233 (2): a component bound two ways twice carries a path per binding; its fields name their model', async () => {
  const pair = "@model first: string = ''\n@model last: string = ''\n<div><input [(value)]=\"first\"><input [(value)]=\"last\"></div>\n"
  const pairServer = compile(pair, { file: 'pair.tscl', target: 'server', clientUrl: '/pair.js' }).code
  const inner = await importCode(pairServer, 'forms-pair').then((m) => m.render({ first: '', last: '' }))
  expect(inner).toContain('data-cl-path="@first"')
  expect(inner).toContain('data-cl-path="@last"')
  const html = await renderOf(`@import pair from './pair.tscl'
<script>
  let user = state({ name: { first: '', last: '' } })
</script>
<pair [(first)]="user.name.first" [(last)]="user.name.last" />
`, { './pair.tscl?render': pairServer, './pair.tscl': pairServer })
  expect(html).toMatch(/<cl-island c="pair"[^>]* data-cl-path-first="name\.first" data-cl-path-last="name\.last"/)
})
