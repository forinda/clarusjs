// @vitest-environment happy-dom
// The forms engine over deeply nested values: sections (components with an object @model) holding rows, added and
// removed under one [engine]. Paths go through each island; marks follow the DOM after it changes; the work per
// keystroke grows with the fields, not with their square.
import { afterEach, expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { attachAll } from '../../src/runtime/loader.ts'
import { importCode } from '../helpers.ts'

afterEach(() => { document.body.innerHTML = '' })

// A section is a component with an object @model: a template can't reach an outer @for's $index.
const sectionSrc = `@model value: any
@event remove
<script>
  function addItem() { value = { ...value, items: [...value.items, { name: 'new', tags: [] }] } }
</script>
<fieldset>
  <input class="title" required [(value)]="value.title">
  <button type="button" class="add-item" (click)="addItem()">+</button>
  <button type="button" class="remove" (click)="emit('remove')">x</button>
  @for (item of value.items; track $index) {
    <input class="name" required [(value)]="value.items[$index].name">
  }
</fieldset>
`
const src = (sections: number, items: number, engine = true) => `@import sectionFields from './section.tscl'
<script>
  import { form } from 'clarusjs/forms'
  const make = (s, i) => ({ name: 's' + s + 'i' + i, tags: [{ label: 't' }] })
  let order = state({ customer: { address: { city: '' } }, sections: Array.from({ length: ${sections} }, (_, s) => ({ title: 'S' + s, items: Array.from({ length: ${items} }, (_, i) => make(s, i)) })) })
  const f = form(order)
  function addSection() { order = { ...order, sections: [...order.sections, { title: '', items: [make(9, 0)] }] } }
  function removeSection(s) { order = { ...order, sections: order.sections.filter((_, i) => i !== s) } }
</script>
<form${engine ? ' [engine]="f"' : ''}>
  <input class="city" required [(value)]="order.customer.address.city">
  @for (section of order.sections; track $index) {
    <sectionFields [(value)]="order.sections[$index]" (remove)="removeSection($index)" />
  }
  <button type="button" class="add" (click)="addSection()">add</button>
</form>
<output>{{ f.error('sections.1.items.0.name') }}|{{ f.touched('sections.1.items.0.name') }}|{{ f.changed('sections.1.items.0.name') }}|{{ JSON.stringify(order.sections[1]?.items[0]) }}</output>
`
async function mount(sections: number, items: number, name: string, engine = true) {
  const code = src(sections, items, engine)
  const childS = compile(sectionSrc, { file: 'section.tscl', target: 'server', clientUrl: '/section.js' }).code
  const s = await importCode(compile(code, { file: 'x.tscl', target: 'server', clientUrl: '/x.js' }).code, name + '-s', { './section.tscl': childS })
  const c = await importCode(compile(code, { file: 'x.tscl', target: 'client' }).code, name + '-c', { './section.tscl?render': childS })
  const child = await importCode(compile(sectionSrc, { file: 'section.tscl', target: 'client' }).code, name + '-child')
  const modules: Record<string, unknown> = { '/x.js': c, '/section.js': child }
  document.body.innerHTML = s.render({})
  await attachAll(document, async (u) => modules[u] as any)
}
const $ = (sel: string) => document.querySelector(sel) as HTMLInputElement
const $$ = (sel: string) => [...document.querySelectorAll(sel)] as HTMLInputElement[]
const type = (el: HTMLInputElement, value: string) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })) }
const leave = (el: Element) => el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
const tick = () => new Promise((r) => setTimeout(r, 0))
const invalid = (els: Element[]) => els.map((e) => e.getAttribute('aria-invalid'))

test('a row two islands deep: written by its path, and its error, touched and changed read by that path', async () => {
  await mount(3, 2, 'deep')
  const row = $$('.name')[2]! // section 1, item 0
  type(row, '')
  leave(row)
  await tick()
  expect($('output').textContent).toBe('Constraints not satisfied|true|true|{"name":"","tags":[{"label":"t"}]}')
  expect(row.getAttribute('aria-invalid')).toBe('true')
})

test('after a section above is removed (or one added), each field\'s mark follows its own value', async () => {
  await mount(3, 1, 'remove')
  for (const t of $$('.title')) leave(t)
  type($$('.title')[1]!, '')
  leave($$('.title')[1]!)
  expect(invalid($$('.title'))).toEqual([null, 'true', null])
  $$('.remove')[0]!.click()
  await tick()
  expect($$('.title').map((e) => e.value)).toEqual(['', 'S2'])
  expect(invalid($$('.title'))).toEqual(['true', null]) // the empty title moved up; S2 is fine
  $('.add').click()
  await tick()
  expect(invalid($$('.title'))).toEqual(['true', null, null]) // the new one isn't touched yet
})

/** DOM attribute reads during `fn`: the engine's work, counted rather than timed. */
function reads(fn: () => void): number {
  const get = Element.prototype.getAttribute
  let n = 0
  Element.prototype.getAttribute = function (this: Element, name: string) { n++; return get.call(this, name) }
  try { fn() } finally { Element.prototype.getAttribute = get }
  return n
}

test('the work per keystroke and per field left grows with the fields, not their square', async () => {
  const cost = async (sections: number) => {
    await mount(sections, 4, `scale${sections}`)
    const names = $$('.name')
    const keystroke = reads(() => type(names.at(-1)!, 'x'))
    const left = reads(() => leave(names[0]!))
    await tick()
    document.body.innerHTML = ''
    return { keystroke, left }
  }
  const small = await cost(5) // 26 fields
  const big = await cost(20) // 101 fields: about 4 times as many
  expect(big.keystroke / small.keystroke).toBeLessThan(7)
  expect(big.left / small.left).toBeLessThan(7)
}, 60_000)

// FORMS_TIMING=1 prints how long each operation takes at a few sizes, with and without the engine (not run in CI).
for (const [sections, items] of [[10, 10], [20, 25], [40, 25]] as const) {
  for (const engine of [true, false]) {
    test.skipIf(!process.env.FORMS_TIMING)(`timing: ${sections} sections x ${items} items, ${engine ? 'with' : 'without'} the engine`, async () => {
      const t0 = performance.now()
      await mount(sections, items, `t${sections}${engine}`, engine)
      const attach = performance.now() - t0
      const time = async (fn: () => void) => { const t = performance.now(); fn(); await new Promise<void>((r) => queueMicrotask(r)); return (performance.now() - t).toFixed(1) }
      const names = $$('.name')
      const k = await time(() => type(names.at(-1)!, 'x'))
      const l = await time(() => leave(names[0]!))
      const a = await time(() => $('.add').click())
      const r = await time(() => $$('.remove')[0]!.click())
      console.log(`${$$('input').length} fields, engine ${engine}: attach ${attach.toFixed(0)}ms, keystroke ${k}ms, leave ${l}ms, add section ${a}ms, remove section ${r}ms`)
    }, 300_000)
  }
}
