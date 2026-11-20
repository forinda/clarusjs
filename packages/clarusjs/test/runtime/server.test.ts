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
    expect(island('counter', '/c.tscl?import', { start: 3 }, '<b>x</b>')).toBe(
      '<cl-island c="counter" src="/c.tscl?import" p="{&quot;start&quot;:3}"><b>x</b></cl-island>',
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
    expect(() => island('c', '/c', { a: { b: Symbol('x') } }, '')).toThrow(/a\.b/)
  })
})

test('#14: island state goes in an s attribute, escaped; no state, no attribute', () => {
  const out = island('c', '/c', {}, '', { label: '"><script>', when: new Date(0) })
  expect(out).toContain(' s="{&quot;label&quot;:&quot;\\&quot;&gt;&lt;script&gt;&quot;,&quot;when&quot;:{&quot;$cl&quot;:&quot;d&quot;,&quot;v&quot;:&quot;1970-01-01T00:00:00.000Z&quot;}}"')
  expect(island('c', '/c', {}, '')).not.toContain(' s=')
})
