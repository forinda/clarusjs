// @vitest-environment happy-dom
// Motion phase 2: @transition around an island's @if (Vue's classes, modes, appear, duration, hooks).
import { expect, test } from 'vitest'
import { ClarusError } from '../../src/compiler/errors.ts'
import { parse } from '../../src/compiler/parse.ts'
import { compile } from '../../src/compiler/index.ts'

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

// --- compiling ---

const island = (wrapper: string) => `<script>\n  let open = state(true)\n</script>\n<div>\n  <button type="button" (click)="open = !open">Toggle</button>\n  ${wrapper}\n</div>\n`
const compileError = (source: string): ClarusError => {
  try { compile(source, { file: 'x.tscl', target: 'client' }) } catch (e) { return e as ClarusError }
  throw new Error('expected compile to throw')
}

test('outside an island, @transition is an error at the wrapper: there is no browser code to run it', () => {
  const source = "<div>\n  @transition ('fade') { @if (true) { <p>A</p> } }\n</div>\n"
  expect(compileError(source).message).toBe('x.tscl:2:3 @transition runs in the browser: this component needs a <script> or a @model input (an island)')
})

test('in an island: the client calls transitionBlock from clarusjs/motion with the name and options; the server is unchanged', () => {
  const source = island("@transition ('fade', { mode: 'out-in' }) { @if (open) { <p>A</p> } @else { <p>B</p> } }")
  const client = compile(source, { file: 'x.tscl', target: 'client' }).code
  expect(client).toContain("import { transitionBlock as __cl_tb } from 'clarusjs/motion'")
  expect(client).toMatch(/__cl_tb\(__cl_root, 0, \(\) => \(open\.get\(\) \? 0 : 1\), \[[\s\S]*\], 'fade', \(\{ mode: 'out-in' \}\)\)/)
  expect(client).not.toContain('__cl_block(')
  const plain = island('@if (open) { <p>A</p> } @else { <p>B</p> }')
  expect(compile(source, { file: 'x.tscl', target: 'server', clientUrl: '/x' }).code).toBe(compile(plain, { file: 'x.tscl', target: 'server', clientUrl: '/x' }).code)
})

test("without arguments the name is 'cl'; a script's names in the arguments are read like any expression", () => {
  const bare = compile(island('@transition { @if (open) { <p>A</p> } }'), { file: 'x.tscl', target: 'client' }).code
  expect(bare).toMatch(/, "cl", undefined\)/)
  const named = compile(island("@transition (open ? 'a' : 'b') { @if (open) { <p>A</p> } }"), { file: 'x.tscl', target: 'client' }).code
  expect(named).toContain('(open.get() ? ')
})

test('a component with only a @model input is an island: @transition compiles', () => {
  expect(() => compile("@model open: boolean = false\n<div>@transition ('fade') { @if (open) { <p>A</p> } }</div>\n", { file: 'x.tscl', target: 'client' })).not.toThrow()
})

test("a comma inside a JavaScript comment or a template's ${} doesn't split the arguments", () => {
  const commented = parse("@transition ('fade' /* , */, { mode: 'out-in' }) { @if (a) { <p/> } }", 'x.tscl').nodes[0] as any
  expect(commented.transition).toMatchObject({ name: "'fade' /* , */", options: "{ mode: 'out-in' }" })
  const lined = parse("@transition ('fade' // a, b\n, opts) { @if (a) { <p/> } }", 'x.tscl').nodes[0] as any
  expect(lined.transition).toMatchObject({ name: "'fade' // a, b", options: 'opts' })
  const template = parse("@transition (`${pick(a, b)}-fade`, opts) { @if (a) { <p/> } }", 'x.tscl').nodes[0] as any
  expect(template.transition).toMatchObject({ name: '`${pick(a, b)}-fade`', options: 'opts' })
})
