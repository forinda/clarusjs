// #40: @import './x.css' declares a stylesheet the component needs.
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { ClarusError } from '../../src/compiler/errors.ts'
import { parse } from '../../src/compiler/parse.ts'

test("@import 'x.css' is a stylesheet import; it compiles to nothing in either module", () => {
  const src = "@import '../styles/docs.css'\n@import \"./card.css\"\n<p>x</p>"
  expect(parse(src, 'x.tscl').cssImports.map((c) => c.from)).toEqual(['../styles/docs.css', './card.css'])
  expect(compile(src, { file: 'x.tscl', target: 'server' }).code).not.toContain('.css')
  expect(compile(src, { file: 'x.tscl', target: 'client' }).code).toBe('export {}\n')
})

test('a bare @import of anything but a stylesheet is an error that says so', () => {
  let e: ClarusError | undefined
  try { parse("@import './x.ts'\n<p/>", 'x.tscl') } catch (err) { e = err as ClarusError }
  expect(e?.message).toMatch(/^x\.tscl:1:1 .*@import without a name only takes a stylesheet/)
})
