// @vitest-environment happy-dom
// Review fixes for #212 (TypeScript epic): model paths, read-only writes, multi-line types, event scoping, model
// events from deeper islands, in-place updates by source, and input updates applied together.
import { afterEach, expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { ClarusError } from '../../src/compiler/errors.ts'
import { parse } from '../../src/compiler/parse.ts'
import { attachAll } from '../../src/runtime/loader.ts'
import { importCode } from '../helpers.ts'

afterEach(() => { document.body.innerHTML = '' })
const server = (src: string, file = 'x.tscl', clientUrl = '/x.js') => compile(src, { file, target: 'server', clientUrl }).code
const client = (src: string, file = 'x.tscl') => compile(src, { file, target: 'client' }).code
async function mountOne(src: string, props = {}) {
  const s = await importCode(server(src), 'r212-s')
  const c = await importCode(client(src), 'r212-c')
  document.body.innerHTML = s.render(props)
  return c.attach(document.querySelector('cl-island')!, props)
}
const type = (el: Element, value: string) => {
  ;(el as HTMLInputElement).value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

test('a bracket path on an object updates that property; on an array it updates that element', async () => {
  await mountOne(`<script>
  let form = state({ name: 'Ada', tags: ['a', 'b'] })
  let i = state(1)
</script>
<div><input class="n" [(value)]="form['name']"><input class="t" [(value)]="form.tags[i]"><p class="out">{{ form.name }}/{{ form.tags.join(',') }}/{{ String(Array.isArray(form.tags)) }}</p></div>
`)
  type(document.querySelector('.n')!, 'Grace')
  type(document.querySelector('.t')!, 'B')
  expect(document.querySelector('.out')!.textContent).toBe('Grace/a,B/true')
})

test('a destructuring write to an input is a located read-only error; to a shadowing local it is fine', () => {
  let error: ClarusError | undefined
  try { client("@input value: string = ''\n<script>\n  let x = state(0)\n  function f() { ({ value } = { value: 'x' }) }\n</script>\n<p>{{ value }} {{ x }}</p>\n") } catch (e) { error = e as ClarusError }
  expect(error?.message).toMatch(/^x\.tscl:4:19 @input value is read-only/) // at the pattern
  expect(() => client("@input value: string = ''\n<script>\n  let x = state(0)\n  function f() { let value; ({ value } = { value: 'x' }); return value }\n</script>\n<p>{{ value }} {{ x }}</p>\n")).not.toThrow()
})

test('a multi-line generic type stays inside its @type', () => {
  const parsed = parse('@type List = Array<\n  string\n>\n@input items: List\n<p>{{ items.length }}</p>\n', 'x.tscl')
  expect(parsed.types[0]!.type).toBe('Array<\n  string\n>')
  expect(parsed.inputs.map((i) => i.name)).toEqual(['items'])
})

test('mouseenter on a child runs the child\'s handler only, not an ancestor\'s (it doesn\'t bubble)', async () => {
  await mountOne(`<script>
  let log = state([])
  const add = (x) => { log = [...log, x] }
</script>
<div class="outer" (mouseenter)="add('outer')"><span class="inner" (mouseenter)="add('inner')">x</span><p class="log">{{ log.join(',') }}</p></div>
`)
  document.querySelector('.outer')!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }))
  document.querySelector('.inner')!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }))
  expect(document.querySelector('.log')!.textContent).toBe('outer,inner')
})

test('a model event from an island the region does not bind (a deeper one) is not taken; the bound child\'s is', async () => {
  // The bound child (panel) renders an unbound island (rating) inside it.
  const panelStub = `export function render() { return '<cl-island c="panel" src="/panel.js" p="{}"><div><cl-island c="rating" src="/rating.js" p="{}"><button>0</button></cl-island></div></cl-island>' }`
  const page = `@import panel from './panel.tscl'
<script>
  let form = state({ note: 'keep' })
</script>
<section><panel [(value)]="form.note" /><p class="out">{{ form.note }}</p></section>
`
  const deps = { './panel.tscl': panelStub, './panel.tscl?render': panelStub }
  const s = await importCode(server(page, 'page.tscl', '/page.js'), 'r212-ps', deps)
  const c = await importCode(client(page, 'page.tscl'), 'r212-pc', deps)
  document.body.innerHTML = s.render({})
  c.attach(document.querySelector('cl-island[c="page"]')!, {})
  const send = (el: Element, value: string) => el.dispatchEvent(new CustomEvent('cl:model', { detail: { name: 'value', value }, bubbles: true, cancelable: true }))
  expect(send(document.querySelector('cl-island[c="rating"]')!, 'from rating')).toBe(true) // not taken: the rating keeps it
  expect(document.querySelector('.out')!.textContent).toBe('keep')
  expect(send(document.querySelector('cl-island[c="panel"]')!, 'from panel')).toBe(false) // taken by the page
  expect(document.querySelector('.out')!.textContent).toBe('from panel')
})

test('__clUpdate keeps an island in place only for the same component source', async () => {
  const update = (globalThis as { __clUpdate?: (el: Element, next: Element) => boolean }).__clUpdate!
  document.body.innerHTML = '<cl-island c="panel" src="/a/panel.js" p="{}"><span></span></cl-island>'
  await attachAll(document, async () => ({ attach: () => () => {} }))
  const island = (src: string) => {
    const next = document.createElement('cl-island')
    next.setAttribute('c', 'panel')
    next.setAttribute('src', src)
    next.setAttribute('p', '{}')
    return next
  }
  const el = document.querySelector('cl-island')!
  expect(update(el, island('/b/panel.js'))).toBe(false) // another panel.tscl: replaced, not kept
  expect(update(el, island('/a/panel.js'))).toBe(true)
})

test('new props are applied together: effects reading several inputs never see half an update', async () => {
  const update = await mountOne(`@input rows: { name: string }[]
@input index: number
<script>
  let x = state(0)
</script>
<p class="name">{{ rows[index].name }} {{ x }}</p>
`, { rows: [{ name: 'a' }, { name: 'b' }], index: 1 })
  expect(document.querySelector('.name')!.textContent).toBe('b 0')
  update({ rows: [{ name: 'c' }], index: 0 })
  expect(document.querySelector('.name')!.textContent).toBe('c 0')
})

test('__clUpdate: an island kept in place takes its new data-cl-path (rows shifted)', async () => {
  const update = (globalThis as { __clUpdate?: (el: Element, next: Element) => boolean }).__clUpdate!
  document.body.innerHTML = '<cl-island c="field" src="/field.js" p="{}" data-cl-path="lines.1.item"><input></cl-island>'
  await attachAll(document, async () => ({ attach: () => () => {} }))
  const next = document.createElement('cl-island')
  for (const [k, v] of [['c', 'field'], ['src', '/field.js'], ['p', '{}'], ['data-cl-path', 'lines.0.item']]) next.setAttribute(k!, v!)
  const el = document.querySelector('cl-island')!
  expect(update(el, next)).toBe(true)
  expect(el.getAttribute('data-cl-path')).toBe('lines.0.item')
})
