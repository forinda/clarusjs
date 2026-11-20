// @vitest-environment happy-dom
// Regression tests for the whole-branch review findings.
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { KviewError } from '../../src/compiler/errors.ts'
import { lower } from '../../src/compiler/ir.ts'
import { parse } from '../../src/compiler/parse.ts'
import { importCode } from '../helpers.ts'

const lowerSource = (source: string, file = 'x.kvw') => lower(parse(source, file), file, source)
function compileError(source: string): KviewError {
  try { compile(source, { file: 'x.kvw', target: 'client' }) } catch (e) { return e as KviewError }
  throw new Error('expected compile to throw')
}
async function mount(source: string, props = {}) {
  const server = await importCode(compile(source, { file: 'x.kvw', target: 'server', clientUrl: '/x' }).code, 'fix-s')
  const client = await importCode(compile(source, { file: 'x.kvw', target: 'client' }).code, 'fix-c')
  document.body.innerHTML = server.render(props)
  const island = document.querySelector('kv-island')!
  client.attach(island, props)
  return island
}

test('a hole that is not a single expression is a located build error', () => {
  const e = compileError('<p>a</p>\n<p>{{ a) + (b }}</p>')
  expect(e).toBeInstanceOf(KviewError)
  expect(e.message.startsWith('x.kvw:2:4 ')).toBe(true)
})

test('an event handler may contain several statements, all rewritten', async () => {
  const island = await mount('<script>\n  let count = state(0)\n  let log = state(0)\n</script>\n<button (click)="log++; count++">{{ count }}</button>')
  island.querySelector('button')!.click()
  expect(island.querySelector('button')!.textContent).toBe('1')
})

test('an event handler with a syntax error is a located build error', () => {
  expect(compileError('<script>let n = state(0)</script>\n<b (click)="n +">x</b>').message).toMatch(/^x\.kvw:2:4 /)
})

test('a hole calling a script function that reads state is reactive', async () => {
  const ir = lowerSource('<script>\n  let count = state(1)\n  function fmt() { return count * 2 }\n</script>\n<b (click)="count++">{{ fmt() }}</b>')
  expect(ir.nodes).toContainEqual({ kind: 'hole', expr: 'fmt()', reactive: true, index: 0 })
  const island = await mount('<script>\n  let count = state(1)\n  function fmt() { return count * 2 }\n</script>\n<b (click)="count++">{{ fmt() }}</b>')
  island.querySelector('b')!.click()
  expect(island.querySelector('b')!.textContent).toBe('4')
})

test('script names do not collide with generated names', async () => {
  const src = '<script>\n  let h = state(0)\n  const props = 1\n  const root = 2\n  function escape(v) { return v }\n  function island() {}\n</script>\n<b (click)="h++">{{ h }}{{ "<i>" }}</b>'
  const island = await mount(src)
  expect(island.querySelector('b')!.innerHTML).toContain('&lt;i&gt;')
  island.querySelector('b')!.click()
  expect(island.querySelector('b')!.textContent).toBe('1<i>')
})

test('import inside <script> is a located build error', () => {
  expect(compileError("<script>\nimport { x } from './x'\n</script>\n<p>x</p>").message).toMatch(/^x\.kvw:2:1 .*imports in <script> are not supported yet/)
})

test('HTML comments are static text, not markup or holes', () => {
  const ir = lowerSource('<p>a<!-- <b> {{ x }} --></p>')
  expect(ir.nodes).toEqual([{ kind: 'static', html: '<p>a<!-- <b> {{ x }} --></p>' }])
})
