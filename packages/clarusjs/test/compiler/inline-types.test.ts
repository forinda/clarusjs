// #99: @type declares a type inside a .tscl file, for its @input props: local to the file (other files see it only
// through the component's props), erased from compiled output. Types to share go in a .ts file.
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { parse } from '../../src/compiler/parse.ts'

const source = "@type User = { name: string; admin: boolean }\n@type Pair<T> = [T, T]\n@input user: User\n@input pair: Pair<number>\n<p>{{ user.name }} {{ pair[0] }}</p>\n"

test('@type lines are parsed with their name, parameters and type', () => {
  const parsed = parse(source, 'card.tscl')
  expect(parsed.types.map((t) => [t.name, t.params ?? '', t.type])).toEqual([['User', '', '{ name: string; admin: boolean }'], ['Pair', '<T>', '[T, T]']])
  expect(source.slice(parsed.types[0]!.typeStart, parsed.types[0]!.typeStart + 6)).toBe('{ name')
})

test('compiled output has no trace of them', () => {
  for (const target of ['server', 'client'] as const) expect(compile(source, { file: 'card.tscl', target }).code).not.toMatch(/User|Pair/)
})

test('a duplicate name, or one an @import type already brings in, is a located error; a malformed line too', () => {
  expect(() => parse('@type A = string\n@type A = number\n<p></p>\n', 'x.tscl')).toThrow('x.tscl:2:1 @type A is declared twice')
  expect(() => parse("@import type { A } from './a.ts'\n@type A = number\n<p></p>\n", 'x.tscl')).toThrow('x.tscl:2:1 @type A is already imported with @import type')
  expect(() => parse('@type = number\n<p></p>\n', 'x.tscl')).toThrow('x.tscl:1:1 unknown or malformed directive "@type"')
})

test('@interface (with type parameters and extends), and both forms spanning lines while a bracket is open', () => {
  const src = [
    '@interface Named { name: string }',
    '@interface User<Role = string> extends Named {',
    '  role: Role',
    "  tags: Array<'a' | 'b'>",
    '}',
    '@type Flags<K extends string> = {',
    '  [P in K]: boolean',
    '}',
    '@type ElementOf<T> = T extends (infer U)[] ? U : never',
    "@type Label = `#${'{'}${string}`",
    '@input user: User',
    '<p>{{ user.name }}</p>',
    '',
  ].join('\n')
  const parsed = parse(src, 'card.tscl')
  expect(parsed.types.map((t) => [t.kind, t.name, t.params ?? ''])).toEqual([
    ['interface', 'Named', ''], ['interface', 'User', '<Role = string>'], ['type', 'Flags', '<K extends string>'], ['type', 'ElementOf', '<T>'], ['type', 'Label', ''],
  ])
  expect(parsed.types[1]!.type).toBe("extends Named {\n  role: Role\n  tags: Array<'a' | 'b'>\n}")
  expect(parsed.types[2]!.type).toBe('{\n  [P in K]: boolean\n}')
  expect(parsed.types[3]!.type).toBe('T extends (infer U)[] ? U : never')
  expect(parsed.inputs.map((i) => i.name)).toEqual(['user']) // the lines after a multi-line type are read as usual
  expect(compile(src, { file: 'card.tscl', target: 'server' }).code).not.toMatch(/Named|Flags|infer/)
})

test('an unclosed bracket in a type is a located error', () => {
  expect(() => parse('@interface A {\n  x: string\n<p></p>\n', 'x.tscl')).toThrow('x.tscl:1:1 @interface A: unclosed {')
})

test('@input types and defaults span lines while a bracket is open; function types and defaults keep their =>', () => {
  const src = [
    '@input options: {',
    "  size: 'sm' | 'lg'",
    '  label?: string',
    "} = { size: 'sm' }",
    '@input onPick: (id: string) => void',
    '@input format: (n: number) => string = (n) => n.toFixed(2)',
    '@input limits: Record<string, number> = {',
    '  max: 10,',
    '}',
    '<p>{{ options.size }}</p>',
    '',
  ].join('\n')
  const parsed = parse(src, 'x.tscl')
  expect(parsed.inputs.map((i) => [i.name, i.type, i.default])).toEqual([
    ['options', "{\n  size: 'sm' | 'lg'\n  label?: string\n}", "{ size: 'sm' }"],
    ['onPick', '(id: string) => void', undefined],
    ['format', '(n: number) => string', '(n) => n.toFixed(2)'],
    ['limits', 'Record<string, number>', '{\n  max: 10,\n}'],
  ])
  expect(src.slice(parsed.inputs[2]!.typeStart, parsed.inputs[2]!.typeStart + 3)).toBe('(n:')
  expect(src.slice(parsed.inputs[2]!.defaultStart!, parsed.inputs[2]!.defaultStart! + 3)).toBe('(n)')
  // The default is what the server renders with.
  const { code } = compile(src, { file: 'x.tscl', target: 'server' })
  expect(code).toContain("{ size: 'sm' }")
})
