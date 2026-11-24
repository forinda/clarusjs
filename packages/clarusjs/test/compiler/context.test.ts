// #465: context. A component provides named values with provide(key, value); components rendered inside it (in its
// template or in content passed to it, at any depth) read them with @context name: Type.
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { parse } from '../../src/compiler/parse.ts'
import { ClarusError } from '../../src/compiler/errors.ts'

const compileError = (source: string) => {
  try { compile(source, { file: 'x.tscl', target: 'server', clientUrl: '/c.js' }) } catch (e) { return (e as ClarusError).message }
  throw new Error('expected compile to throw')
}

test('@context parses like an @input: name, type, optional default', () => {
  expect(parse('@context tabs: { id: string }\n<p />', 'x.tscl').contexts).toMatchObject([{ name: 'tabs', type: '{ id: string }' }])
  expect(parse("@context tabs: { id: string } = { id: 'x' }\n<p />", 'x.tscl').contexts).toMatchObject([{ name: 'tabs', default: "{ id: 'x' }" }])
})

test('@context in an island, a non-literal provide key and a name clash are located build errors', () => {
  expect(compileError('<script>let n = state(0)</script>\n@context t: string\n<p />')).toMatch(/^x\.tscl:2:1 .*@context.*island/)
  expect(compileError('<script>\n  provide(name, 1)\n</script>\n<p />')).toMatch(/^x\.tscl:2:3 .*provide.*string/)
  expect(compileError('@input t: string\n@context t: string\n<p />')).toMatch(/^x\.tscl:2:10 .*already/)
})
