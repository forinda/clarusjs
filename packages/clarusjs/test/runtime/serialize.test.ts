// #14: island props and state survive the trip from server HTML to the browser.
import { expect, test } from 'vitest'
import { parse, stringify } from '../../src/runtime/serialize.ts'

const roundtrip = (v: unknown) => parse(stringify(v))

test('plain JSON values round-trip unchanged', () => {
  const v = { a: 1, b: 'x</script><b>', c: [true, null, { d: [] }] }
  expect(roundtrip(v)).toEqual(v)
})

test('Date, Map, Set, undefined, NaN, ±Infinity, -0 and BigInt round-trip', () => {
  const v = {
    when: new Date('2026-11-20T10:00:00.000Z'),
    map: new Map<unknown, unknown>([['a', 1], [2, new Set(['x'])]]),
    set: new Set([1, 'two']),
    missing: undefined,
    list: [undefined, NaN, Infinity, -Infinity],
    big: 12345678901234567890n,
  }
  const back = roundtrip(v) as typeof v
  expect(back.when).toBeInstanceOf(Date)
  expect(back.when.toISOString()).toBe('2026-11-20T10:00:00.000Z')
  expect(back.map).toBeInstanceOf(Map)
  expect([...back.map.keys()]).toEqual(['a', 2])
  expect(back.map.get(2)).toEqual(new Set(['x']))
  expect(back.set).toEqual(new Set([1, 'two']))
  expect('missing' in back).toBe(true)
  expect(back.missing).toBeUndefined()
  expect(back.list[0]).toBeUndefined()
  expect(back.list[1]).toBeNaN()
  expect(back.list.slice(2)).toEqual([Infinity, -Infinity])
  expect(Object.is(roundtrip(-0), -0)).toBe(true)
  expect(back.big).toBe(12345678901234567890n)
})

test('data that uses the tag key is not mistaken for a tag', () => {
  const v = { $cl: 'd', v: 'not a date', nested: { $cl: 'u' } }
  expect(roundtrip(v)).toEqual(v)
})

test('functions, symbols, class instances and cycles are rejected, naming the path', () => {
  expect(() => stringify({ a: { cb: () => 1 } })).toThrow(/a\.cb.*function/)
  expect(() => stringify({ s: Symbol('x') })).toThrow(/\bs\b.*symbol/)
  class Point { x = 1 }
  expect(() => stringify({ list: [new Point()] })).toThrow(/list\.0.*Point/)
  const loop: Record<string, unknown> = {}
  loop.self = loop
  expect(() => stringify(loop)).toThrow(/self.*circular/)
})
