// The compiler's part of the forms engine (clarusjs/forms): form(state) gets the signal, fields carry their paths,
// and [engine] connects a form.
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'

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
