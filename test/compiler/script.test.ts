import { expect, test } from 'vitest'
import { analyzeScript, referencesSignal, rewriteClient, rewriteClientExpr, rewriteServer, type Signals } from '../../src/compiler/script.ts'
import { KviewError } from '../../src/compiler/errors.ts'

const signals: Signals = new Map([['count', 'state'], ['double', 'derived']])

test('finds state and derived declarations', () => {
  const code = 'let count = state(0)\nconst double = derived(() => count * 2)\nconst plain = 1'
  expect(analyzeScript(code, 'x.kvw', code, 0)).toEqual(new Map([['count', 'state'], ['double', 'derived']]))
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

test('script syntax errors point into the .kvw file', () => {
  const source = '<script>\nlet = </script>'
  try {
    analyzeScript('\nlet = ', 'x.kvw', source, 8)
    throw new Error('expected throw')
  } catch (e) {
    expect(e).toBeInstanceOf(KviewError)
    expect((e as KviewError).line).toBe(2)
  }
})
