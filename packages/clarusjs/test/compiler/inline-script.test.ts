// #110: <script inline> inside markup is written out as is and runs where it stands (e.g. before first paint).
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { ClarusError } from '../../src/compiler/errors.ts'
import { importCode } from '../helpers.ts'

const err = (src: string) => { try { compile(src, { file: 'x.tscl', target: 'server' }) } catch (e) { return e as ClarusError } throw new Error('expected an error') }

test('an inline script keeps its content exactly: no holes, no escaping', async () => {
  const src = '<html><head><script inline>if (1 < 2 && "{{ x }}") document.documentElement.dataset.t = "dark"</script></head><body></body></html>'
  const { render } = await importCode(compile(src, { file: 'x.tscl', target: 'server' }).code, 'inline-1')
  expect(render()).toBe('<html><head><script>if (1 < 2 && "{{ x }}") document.documentElement.dataset.t = "dark"</script></head><body></body></html>')
})

test('static attributes are kept (except inline); the client module of a stateless component stays empty', () => {
  const src = '<head><script inline type="module" data-x>a()</script></head>'
  expect(compile(src, { file: 'x.tscl', target: 'server' }).code).toContain('<script type=\\"module\\" data-x>a()</script>')
  expect(compile(src, { file: 'x.tscl', target: 'client' }).code).toBe('export {}\n')
})

test('a script inside markup without inline is still an error that explains the choice; bound attributes are not allowed', () => {
  expect(err('<head><script>a()</script></head>').message).toMatch(/^x\.tscl:1:7 .*<script> must be at the top level.*inline/)
  expect(err('<head><script inline [src]="u"></script></head>').message).toMatch(/^x\.tscl:1:22 .*inline script/)
  expect(err('<head><script inline>a()</head>').message).toMatch(/unclosed <script inline>/)
})

test('inline means inline at the top level too: it is not the component script', async () => {
  const out = compile('<script inline>window.a = 1</script>\n<p>x</p>', { file: 'x.tscl', target: 'server' })
  expect(out.stateful).toBe(false)
  expect((await importCode(out.code, 'inline-top')).render()).toBe('<script>window.a = 1</script><p>x</p>')
})
