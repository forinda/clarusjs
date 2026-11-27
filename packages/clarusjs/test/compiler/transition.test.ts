// @vitest-environment happy-dom
// Motion phase 2: @transition around an island's @if (Vue's classes, modes, appear, duration, hooks).
import { expect, test } from 'vitest'
import { ClarusError } from '../../src/compiler/errors.ts'
import { parse } from '../../src/compiler/parse.ts'

function parseError(source: string): ClarusError {
  try { parse(source, 'x.tscl') } catch (e) { return e as ClarusError }
  throw new Error('expected parse to throw')
}

// --- parsing ---

test('@transition (name, options) { @if … } becomes the @if, carrying its transition', () => {
  const source = "@transition ('fade', { mode: 'out-in' }) {\n  @if (a) { <p>A</p> } @else { <p>B</p> }\n}"
  const node = parse(source, 'x.tscl').nodes[0] as any
  expect(node).toMatchObject({ type: 'if', transition: { name: "'fade'", options: "{ mode: 'out-in' }", start: 0 } })
  expect(node.branches).toHaveLength(2)
  expect(source.slice(node.transition.nameStart, node.transition.nameStart + 6)).toBe("'fade'")
  expect(source.slice(node.transition.optionsStart).startsWith("{ mode: 'out-in' }")).toBe(true)
})

test('@transition without arguments, a name alone, and comments or whitespace around the @if', () => {
  const bare = parse('@transition { @if (a) { <p/> } }', 'x.tscl').nodes[0] as any
  expect(bare.transition).toMatchObject({ name: null, options: null })
  const named = parse("@transition (kind) {\n  {{-- the panel --}}\n  @if (a) { <p/> }\n\n}", 'x.tscl').nodes[0] as any
  expect(named.transition).toMatchObject({ name: 'kind', options: null })
  // A comma inside the arguments' own brackets or strings doesn't split them.
  const nested = parse("@transition (pick('a,b'), { duration: { enter: 1, leave: 2 } }) { @if (a) { <p/> } }", 'x.tscl').nodes[0] as any
  expect(nested.transition).toMatchObject({ name: "pick('a,b')", options: '{ duration: { enter: 1, leave: 2 } }' })
})

test('@transition holds exactly one @if: anything else is an error at that node', () => {
  const message = '@transition wraps one @if (@for comes later)'
  expect(parseError('@transition { <p/> }').message).toBe(`x.tscl:1:15 ${message}`)
  const two = '@transition { @if (a) { } @if (b) { } }'
  expect(parseError(two).message).toBe(`x.tscl:1:${two.indexOf('@if (b)') + 1} ${message}`)
  expect(parseError('@transition { @for (x of xs; track x) { } }').message).toBe(`x.tscl:1:15 ${message}`)
  expect(parseError('@transition { }').message).toBe(`x.tscl:1:1 ${message}`)
  expect(parseError('@transition { @if (a) { }').message).toBe('x.tscl:1:1 unclosed @transition block')
})
