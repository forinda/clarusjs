// #432: a <script> is JavaScript. TypeScript-only syntax is an error at its place, named, in the compiler and in
// clarusjs check alike: what isn't JavaScript at all (an annotation, a cast), and what JavaScript reads as something
// else (request<string>(…) is two comparisons).
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { ClarusError } from '../../src/compiler/errors.ts'

const error = (script: string) => {
  try { compile(`<script>\n${script}\n</script>\n<p>{{ n }}</p>\n`, { file: 'x.tscl', target: 'client' }); return '' } catch (e) { return (e as ClarusError).message }
}
const ts = /TypeScript syntax in a <script> \(scripts are JavaScript\)/

test('a type argument, which JavaScript reads as comparisons, is reported where it is', () => {
  expect(error("  import { request } from 'clarusjs/fetch'\n  let n = state(0)\n  const csv = () => request<string>('/a')")).toMatch(/^x\.tscl:4:21 TypeScript syntax in a <script> \(scripts are JavaScript\): a type argument, request<string>\(…\)/)
  expect(error('  let n = state(0)\n  const pair = (f) => f<number, string>(1)')).toMatch(/^x\.tscl:3:23 .*a type argument, f<number, string>\(…\)/)
  expect(error('  let n = state(0)\n  const m = new Map<string, number>()')).toMatch(ts)
})

test('syntax that is not JavaScript at all: named, at its place', () => {
  expect(error('  let n: number = state(0)')).toMatch(/^x\.tscl:2:8 .*a type annotation/)
  expect(error('  let n = state(0)\n  function f(x: number) { return x }')).toMatch(/^x\.tscl:3:15 .*a type annotation/)
  expect(error('  let n = state(0)\n  const v = n as number')).toMatch(/^x\.tscl:3:15 .*an as cast/)
  expect(error('  let n = state(0)\n  const v = n satisfies number')).toMatch(/an? satisfies check/)
  expect(error("  let n = state(0)\n  const v = document.querySelector('p')!.id")).toMatch(/a non-null assertion/)
  expect(error('  interface P { a: number }\n  let n = state(0)')).toMatch(/a type declaration/)
  expect(error('  type P = { a: number }\n  let n = state(0)')).toMatch(/a type declaration/)
  expect(error('  let n = state(0)\n  function id<T>(x) { return x }')).toMatch(/type parameters/)
})

test('JavaScript that only looks like it stays fine', () => {
  expect(error('  let n = state(0)\n  const a = 1, b = 2, c = 3\n  const ok = a < b && b > c')).toBe('')
  expect(error('  let n = state(0)\n  const t = n ? 1 : 2\n  const o = { a: 1 }')).toBe('')
  expect(error('  let n = state(0)\n  const not = !n')).toBe('')
})
