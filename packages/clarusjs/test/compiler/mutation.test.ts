// #350: state changed in place (items.push(x), form.a = 1) doesn't notify, so the page doesn't update: a located
// warning, in scripts and event handlers, saying what to write instead. [(value)] bindings are copy-on-write already.
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'

const warnings = (body: string, template = '<p>{{ items.length }} {{ form.a }}</p>') => {
  const source = `<script>\n  let items = state([])\n  let form = state({ a: 0, b: { c: 1 } })\n  let tags = state(new Set())\n${body}\n</script>\n${template}\n`
  return compile(source, { file: 'a.tscl', target: 'client' }).warnings.map((w) => w.message)
}

test('a mutating method on state: located, with the copy to write instead', () => {
  expect(warnings('  function add() { items.push(1) }')).toEqual([
    "a.tscl:5:20 items.push() changes items in place, so the page won't update: assign a new value instead (items = [...items, …])",
  ])
  expect(warnings('  function f() { items.sort() }')[0]).toContain('(items = items.toSorted(…))')
  expect(warnings('  function f() { items.splice(0, 1) }')[0]).toContain('(items = items.toSpliced(…))')
  expect(warnings('  function f() { tags.add(1) }')[0]).toContain('tags.add() changes tags in place')
})

test('a property written, incremented or deleted, at any depth', () => {
  expect(warnings('  function f() { form.a = 1 }')).toEqual([
    "a.tscl:5:18 form.a = … changes form in place, so the page won't update: assign a new value instead (form = { ...form, a: … })",
  ])
  expect(warnings('  function f() { form.b.c++ }')[0]).toContain('form.b.c++ changes form in place')
  expect(warnings('  function f() { items[0] = 2 }')[0]).toContain('items[…] = … changes items in place')
  expect(warnings('  function f() { delete form.a }')[0]).toContain('delete form.a changes form in place')
})

test('in a template event handler too (only [(value)] is copy-on-write)', () => {
  const found = warnings('', '<button type="button" (click)="items.push(1)">Add</button>\n<input [(value)]="form.a" />\n<p>{{ items.length }}</p>')
  expect(found).toEqual(["a.tscl:7:32 items.push() changes items in place, so the page won't update: assign a new value instead (items = [...items, …])"])
})

test('no warning for new values, copies, locals, shadowing names, or non-mutating calls', () => {
  expect(warnings([
    '  function a() { items = [...items, 1] }',
    '  function b() { const copy = items.slice(); copy.push(1); items = copy }',
    '  function c(items) { items.push(1) }',
    '  function d() { const sorted = items.toSorted(); items.slice().sort(); return items.map((x) => x).reverse() }',
    '  function e() { form = { ...form, a: 1 } }',
    '  function g() { const local = { a: 1 }; local.a = 2 }',
  ].join('\n'))).toEqual([])
})
