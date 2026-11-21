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

test('a component bound two ways carries its path on its island; a field binding its @model itself has an empty path', async () => {
  const field = "@model value: string = ''\n<label><input [(value)]=\"value\"></label>\n"
  const fieldServer = compile(field, { file: 'field.tscl', target: 'server', clientUrl: '/field.js' }).code
  expect(await importCode(fieldServer, 'forms-f').then((m) => m.render({ value: 'x' }))).toContain('data-cl-path=""')
  const html = await renderOf(`@import field from './field.tscl'
<script>
  let order = state({ shipping: { street: '' } })
</script>
<field [(value)]="order.shipping.street" />
`, { './field.tscl?render': fieldServer, './field.tscl': fieldServer })
  expect(html).toMatch(/<cl-island c="field"[^>]* data-cl-path="shipping\.street"/)
  expect(html).not.toMatch(/p="[^"]*path/) // not a prop the child sees
})
