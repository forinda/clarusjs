import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { parse } from '../../src/compiler/parse.ts'
import { ClaruError } from '../../src/compiler/errors.ts'

const counter = readFileSync(new URL('../fixtures/counter.kvw', import.meta.url), 'utf8')

function parseError(source: string): ClaruError {
  try { parse(source, 'x.kvw') } catch (e) { return e as ClaruError }
  throw new Error('expected parse to throw')
}

test('parses the counter component', () => {
  const f = parse(counter, 'counter.kvw')
  expect(f.inputs).toMatchObject([{ name: 'start', type: 'number', default: '0' }])
  expect(f.script?.code).toContain('let count = state(start)')
  expect(f.nodes).toHaveLength(1)
  expect(f.nodes[0]).toMatchObject({
    type: 'element',
    tag: 'button',
    attrs: [{ kind: 'event', name: 'click', expr: 'add()' }],
    children: [
      { type: 'text', value: 'Clicked ' },
      { type: 'expr', expr: 'count' },
      { type: 'text', value: ' times (double: ' },
      { type: 'expr', expr: 'double' },
      { type: 'text', value: ')' },
    ],
  })
})

test('script start offset points inside the script block', () => {
  const f = parse(counter, 'counter.kvw')
  expect(counter.slice(f.script!.start, f.script!.start + f.script!.code.length)).toBe(f.script!.code)
})

test('parses @import directives', () => {
  const f = parse(`@import counter from '../components/counter.kvw'\n@import greeting from "./greeting.kvw"\n<p>x</p>`, 'p.kvw')
  expect(f.imports).toMatchObject([
    { name: 'counter', from: '../components/counter.kvw' },
    { name: 'greeting', from: './greeting.kvw' },
  ])
})

test('parses self-closing components with prop bindings', () => {
  const f = parse('<counter [start]="3" />', 'p.kvw')
  expect(f.nodes[0]).toMatchObject({ type: 'element', tag: 'counter', attrs: [{ kind: 'prop', name: 'start', expr: '3' }], children: [] })
})

test('parses static and boolean attributes', () => {
  const f = parse('<a href="/x" hidden>y</a>', 'p.kvw')
  expect(f.nodes[0]).toMatchObject({ attrs: [{ kind: 'static', name: 'href', value: '/x' }, { kind: 'static', name: 'hidden', value: true }] })
})

test('void elements close themselves', () => {
  const f = parse('<input disabled>\n<p>x</p>', 'p.kvw')
  expect(f.nodes.map((n) => n.type === 'element' && n.tag)).toEqual(['input', 'p'])
})

test('unclosed element reports file:line:col', () => {
  const e = parseError('<p>a</p>\n<div>\n  <span>')
  expect(e).toBeInstanceOf(ClaruError)
  expect(e.message.startsWith('x.kvw:3:3 ')).toBe(true)
})

test('mismatched close tag is an error', () => {
  expect(parseError('<div></span>').message).toMatch(/x\.kvw:1:6 .*span/)
})

test('unclosed {{ is an error', () => {
  expect(parseError('<p>{{ x </p>').message).toMatch(/x\.kvw:1:4 /)
})

test('interpolation inside attributes is rejected', () => {
  expect(parseError('<a href="{{ url }}">x</a>').message).toContain('interpolation in attributes is not supported yet')
})

test('unknown directive is an error', () => {
  expect(parseError('@foo bar\n<p>x</p>').message).toMatch(/x\.kvw:1:1 .*@foo/)
})

test('second script block is an error', () => {
  expect(parseError('<script>a</script>\n<script>b</script>').message).toMatch(/x\.kvw:2:1 /)
})
