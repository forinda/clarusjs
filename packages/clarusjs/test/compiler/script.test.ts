import { expect, test } from 'vitest'
import { analyzeScript, referencesSignal, rewriteClient, rewriteClientExpr, rewriteServer, type Signals } from '../../src/compiler/script.ts'
import { ClarusError } from '../../src/compiler/errors.ts'
import { compile } from '../../src/compiler/index.ts'

const signals: Signals = new Map([['count', 'state'], ['double', 'derived']])

test('finds state and derived declarations', () => {
  const code = 'let count = state(0)\nconst double = derived(() => count * 2)\nconst plain = 1'
  expect(analyzeScript(code, 'x.tscl', code, 0)).toEqual(new Map([['count', 'state'], ['double', 'derived']]))
})

test('client rewrite: declarations become const, ++ becomes set(get()+1)', () => {
  expect(rewriteClient('let count = state(start)\nfunction add() { count++ }', signals))
    .toBe('const count = state(start)\nfunction add() { count.set(count.get() + 1) }')
})

test('client rewrite: compound and plain assignment', () => {
  expect(rewriteClient('count += 2', signals)).toBe('count.set(count.get() + (2))')
  expect(rewriteClient('count = 5', signals)).toBe('count.set(5)')
  expect(rewriteClient('--count', signals)).toBe('count.set(count.get() - 1)')
})

test('client rewrite: reads inside derived become get()', () => {
  expect(rewriteClient('const double = derived(() => count * 2)', signals)).toBe('const double = derived(() => count.get() * 2)')
})

test('client expression rewrite leaves member properties and object keys alone', () => {
  expect(rewriteClientExpr('double', signals)).toBe('double.get()')
  expect(rewriteClientExpr('obj.count', signals)).toBe('obj.count')
  expect(rewriteClientExpr('({ count: 1 })', signals)).toBe('({ count: 1 })')
  expect(rewriteClientExpr('({ count })', signals)).toBe('({ count: count.get() })')
})

test('server rewrite unwraps state and runs derived once', () => {
  expect(rewriteServer('let count = state(start)\nconst double = derived(() => count * 2)'))
    .toBe('let count = (start)\nconst double = (() => count * 2)()')
})

test('referencesSignal', () => {
  expect(referencesSignal('count + 1', signals)).toBe(true)
  expect(referencesSignal('start', signals)).toBe(false)
  expect(referencesSignal('obj.count', signals)).toBe(false)
})

test('script syntax errors point into the .tscl file', () => {
  const source = '<script>\nlet = </script>'
  try {
    analyzeScript('\nlet = ', 'x.tscl', source, 8)
    throw new Error('expected throw')
  } catch (e) {
    expect(e).toBeInstanceOf(ClarusError)
    expect((e as ClarusError).line).toBe(2)
  }
})

test('top-level await in an island\'s <script> is a located error naming <script server> (attach is synchronous); await inside functions is fine', () => {
  const err = (src: string) => { try { compile(src, { file: 'x.tscl', target: 'client' }) } catch (e) { return (e as Error).message } return 'no error' }
  for (const [code, col] of [['const r = await load()', 13], ['for await (const x of xs) {}', 3], ['if (a) { b = await c }', 16]] as const) {
    expect(err(`<script>\n  ${code}\n</script>\n<p>x</p>`), code).toMatch(new RegExp(`^x\\.tscl:2:${col} an island's <script> can't await at the top level .*<script server>`))
  }
  expect(err('<script>\n  async function go() { await fetch("/x") }\n  const f = async () => { for await (const x of y) {} }\n  class A { async m() { await 1 } }\n</script>\n<p>x</p>')).toBe('no error')
})
