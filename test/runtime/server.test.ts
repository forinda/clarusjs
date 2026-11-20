import { describe, expect, test } from 'vitest'
import { escape, island } from '../../src/runtime/server.ts'

describe('escape', () => {
  test('escapes HTML-significant characters', () => {
    expect(escape('<script>"x" & \'y\'</script>')).toBe('&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;')
  })
  test('renders null/undefined as empty and numbers as text', () => {
    expect(escape(null)).toBe('')
    expect(escape(undefined)).toBe('')
    expect(escape(0)).toBe('0')
  })
})

describe('island', () => {
  test('wraps html in a self-describing cl-island element', () => {
    expect(island('counter', '/c.clarus?import', { start: 3 }, '<b>x</b>')).toBe(
      '<cl-island c="counter" src="/c.clarus?import" p="{&quot;start&quot;:3}"><b>x</b></cl-island>',
    )
  })
  test('cannot break out of the props attribute', () => {
    const out = island('c', '/c', { label: '</cl-island><script>' }, '')
    expect(out).toContain('&lt;/cl-island&gt;&lt;script&gt;')
    expect(out.split('<cl-island').length - 1).toBe(1)
    expect(out.split('</cl-island>').length - 1).toBe(1)
  })
  test('rejects props that cannot be serialized, naming the path', () => {
    expect(() => island('c', '/c', { cb: () => 1 }, '')).toThrow(TypeError)
    expect(() => island('c', '/c', { cb: () => 1 }, '')).toThrow(/cb/)
    expect(() => island('c', '/c', { a: { b: 1n } }, '')).toThrow(/a\.b/)
  })
})
