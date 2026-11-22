// @vitest-environment happy-dom
// #403: [class.name] toggles one class; [class] takes a string, an object (truthy keys) or an array (falsy dropped,
// nested allowed), like clsx; all merged with written classes and the scope class, on the server and in islands.
import { expect, test } from 'vitest'
import { compile, ClarusError } from '../../src/compiler/index.ts'
import { attrValue, classValue } from '../../src/runtime/attrs.ts'
import { parse as parseProps } from '../../src/runtime/serialize.ts'
import { importCode } from '../helpers.ts'

const html = async (src: string, props: object = {}) => {
  const { code } = compile(src, { file: 'c.tscl', target: 'server', scope: 's', clientUrl: '/c.js' })
  return ((await importCode(code, 'cls', {}, true)) as { render: (p: object) => string }).render(props)
}

test('classValue: strings as written, objects by truthy keys, arrays flattened without falsy entries', () => {
  expect(classValue('a b')).toBe('a b')
  expect(classValue({ a: true, b: false, c: 1, d: null })).toBe('a c')
  expect(classValue(['a', false, null, undefined, 0, '', ['b', { c: true, d: false }]])).toBe('a b c')
  expect(classValue(null)).toBe('')
  expect(classValue(['star', 'star on'])).toBe('star on') // each class once (a written and a bound class="…" agreeing)
  expect(classValue('  a   b ')).toBe('a b')
  expect(attrValue('class', { a: true, b: false })).toBe('a')
  expect(attrValue('class', ['x', false])).toBe('x')
  expect(attrValue('class', {})).toBe('') // an empty class, not [object Object]
})

test('[class.name] toggles one class, merged with the written class and the scope class', async () => {
  const src = '@input on: boolean\n@input off: boolean\n<div><p class="card" [class.active]="on" [class.hidden]="off">x</p></div>'
  expect(await html(src, { on: true, off: false })).toContain('<p class="card active">x</p>')
  expect(await html(src, { on: false, off: false })).toContain('<p class="card">x</p>')
  expect(await html('@input on: boolean\n<p [class.active]="on">x</p>', { on: true })).toBe('<p class="active cl-c-s">x</p>')
})

test('[class] with an object or an array, merged with toggles, the written class and the scope class', async () => {
  expect(await html("@input on: boolean\n<p class=\"card\" [class]=\"{ big: on, small: !on }\">x</p>", { on: true })).toBe('<p class="card big cl-c-s">x</p>')
  expect(await html("@input on: boolean\n<p [class]=\"['a', on && 'b', ['c']]\" [class.d]=\"on\">x</p>", { on: true })).toBe('<p class="a b c d cl-c-s">x</p>')
  expect(await html("@input on: boolean\n<div><p [class]=\"{ big: on }\">x</p></div>", { on: false })).toContain('<p class="">x</p>')
})

test('in an island, a toggle and an object class update when state changes', async () => {
  const src = '<script>\n  let on = state(false)\n</script>\n<button type="button" class="b" [class.on]="on" [class]="{ big: on }" (click)="on = !on">x</button>\n'
  const s = await importCode(compile(src, { file: 'i.tscl', target: 'server', scope: 'i', clientUrl: '/i.js' }).code, 'cls-is', {}, true)
  const c = await importCode(compile(src, { file: 'i.tscl', target: 'client', scope: 'i' }).code, 'cls-ic')
  document.body.innerHTML = s.render({})
  const root = document.querySelector('cl-island')!
  const button = root.querySelector('button')!
  expect(button.className.split(' ').sort()).toEqual(['b', 'cl-c-i'])
  c.attach(root, parseProps(root.getAttribute('p')!))
  button.click()
  expect(button.className.split(' ').sort()).toEqual(['b', 'big', 'cl-c-i', 'on'])
  button.click()
  expect(button.className.split(' ').sort()).toEqual(['b', 'cl-c-i'])
})

test('[class.x] on a component tag is a located error (a component takes a static class)', () => {
  let err: unknown
  try { compile("@import card from './card.tscl'\n@input on: boolean\n<card [class.on]=\"on\" />\n", { file: 'p.tscl', target: 'server' }) } catch (e) { err = e }
  expect(err).toBeInstanceOf(ClarusError)
  expect((err as Error).message).toMatch(/p\.tscl:3:7 .*static class/)
})
