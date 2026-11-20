// @vitest-environment happy-dom
// #11: @for (item of list; track key) { … } @empty { … }
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { ClarusError } from '../../src/compiler/errors.ts'
import { parse } from '../../src/compiler/parse.ts'
import { importCode } from '../helpers.ts'

const server = (source: string) => compile(source, { file: 'x.clarus', target: 'server', clientUrl: '/x' }).code
async function render(source: string, props = {}) {
  return (await importCode(server(source), 'for-s')).render(props) as string
}
function compileError(source: string): ClarusError {
  try { compile(source, { file: 'x.clarus', target: 'server', clientUrl: '/x' }) } catch (e) { return e as ClarusError }
  throw new Error('expected compile to throw')
}
async function mount(source: string) {
  const s = await importCode(server(source), 'for-ms')
  const c = await importCode(compile(source, { file: 'x.clarus', target: 'client' }).code, 'for-mc')
  document.body.innerHTML = s.render({})
  const island = document.querySelector('cl-island')!
  c.attach(island, {})
  return island
}
const click = (el: Element | null) => (el as HTMLElement).click()
const texts = (island: Element, sel: string) => [...island.querySelectorAll(sel)].map((e) => e.textContent)

// --- parsing ---

test('parses item, list, track and @empty', () => {
  const f = parse('<ul>@for (post of posts; track post.id) {<li>{{ post.title }}</li>} @empty {<li>none</li>}</ul>', 'x.clarus')
  expect((f.nodes[0] as any).children[0]).toMatchObject({
    type: 'for', item: 'post', list: 'posts', track: 'post.id',
    children: [{ type: 'element', tag: 'li' }], empty: [{ type: 'element', tag: 'li' }],
  })
})

test('track is optional', () => {
  const f = parse('@for (n of [1, 2]) {{{ n }}}', 'x.clarus')
  expect(f.nodes[0]).toMatchObject({ type: 'for', item: 'n', list: '[1, 2]', track: null, empty: null })
})

test('@for errors are located', () => {
  expect(compileError('@for (posts) {x}').message).toMatch(/^x\.clarus:1:7 .*expected "item of list"/)
  expect(compileError('@for ({ a } of xs) {x}').message).toMatch(/^x\.clarus:1:7 .*a simple name/)
  expect(compileError('@for (x of xs; sort x) {x}').message).toMatch(/^x\.clarus:1:7 .*unknown @for clause "sort x"/)
})

// --- server rendering outside islands ---

test('renders a row per item with $index, escaped', async () => {
  const src = '@input xs: string[]\n<ul>@for (x of xs) {<li>{{ $index }}:{{ x }}</li>}</ul>'
  expect(await render(src, { xs: ['a', '<b>'] })).toBe('<ul><li>0:a</li><li>1:&lt;b&gt;</li></ul>')
})

test('@empty renders for an empty or missing list', async () => {
  const src = '@input xs: string[]\n<ul>@for (x of xs) {<li>{{ x }}</li>} @empty {<li>none</li>}</ul>'
  expect(await render(src, { xs: [] })).toBe('<ul><li>none</li></ul>')
  expect(await render(src, {})).toBe('<ul><li>none</li></ul>')
})

test('loops nest and combine with @if', async () => {
  const src = '@input rows: number[][]\n@for (row of rows) {<p>@for (n of row) {@if (n > 1) {<b>{{ n }}</b>} @else {{{ n }}}}</p>}'
  expect(await render(src, { rows: [[1, 2], [3]] })).toBe('<p>1<b>2</b></p><p><b>3</b></p>')
})

// --- inside islands ---

const list = `<script>
  let items = state([{ id: 1, name: 'a' }, { id: 2, name: 'b' }, { id: 3, name: 'c' }])
  let next = state(4)
  let total = state(0)
  function add() { items = [...items, { id: next, name: 'n' + next }]; next++ }
  function remove(item) { items = items.filter((i) => i !== item) }
  function reverse() { items = [...items].reverse() }
  function rename() { items = items.map((i) => (i.id === 2 ? { ...i, name: 'B' } : i)) }
  function clear() { items = [] }
</script>
<button class="add" (click)="add()">add</button><button class="rev" (click)="reverse()">rev</button>
<button class="ren" (click)="rename()">ren</button><button class="clr" (click)="clear()">clr</button>
<ul>@for (item of items; track item.id) {<li [data-id]="item.id"><span>{{ item.name }}</span> #{{ $index }} <b class="x" (click)="remove(item); total++">x</b></li>} @empty {<li class="none">none</li>}</ul>
<p class="total">{{ total }}</p>`

test('the server marks the list and its rows', async () => {
  const html = await render(list)
  expect(html).toContain('<ul><!--[f0--><!--[r--><li data-id="1" data-cl-a="0">') // [data-id] reads item: reactive per row
  expect(html).toContain('</li><!--]--><!--]--></ul>')
})

test('rows from the server are adopted, and events get their own item', async () => {
  const island = await mount(list)
  click(island.querySelectorAll('.x')[1])
  expect(texts(island, 'li span')).toEqual(['a', 'c'])
  expect(texts(island, '.total')).toEqual(['1'])
})

test('adding keeps existing row nodes and wires the new row', async () => {
  const island = await mount(list)
  const first = island.querySelector('li')
  click(island.querySelector('.add'))
  expect(texts(island, 'li span')).toEqual(['a', 'b', 'c', 'n4'])
  expect(island.querySelector('li')).toBe(first)
  click(island.querySelectorAll('.x')[3])
  expect(texts(island, 'li span')).toEqual(['a', 'b', 'c'])
})

test('reordering moves rows by key and updates $index', async () => {
  const island = await mount(list)
  const byId = (id: string) => island.querySelector(`li[data-id="${id}"]`)
  const one = byId('1')
  click(island.querySelector('.rev'))
  expect(texts(island, 'li span')).toEqual(['c', 'b', 'a'])
  expect(byId('1')).toBe(one)
  expect(byId('1')!.textContent).toContain('#2')
})

test('a changed item with the same key updates its row in place', async () => {
  const island = await mount(list)
  const two = island.querySelector('li[data-id="2"]')
  click(island.querySelector('.ren'))
  expect(island.querySelector('li[data-id="2"]')).toBe(two)
  expect(two!.querySelector('span')!.textContent).toBe('B')
})

test('removed rows stop listening, and @empty shows and hides', async () => {
  const island = await mount(list)
  click(island.querySelector('.clr'))
  expect(texts(island, 'li')).toEqual(['none'])
  click(island.querySelector('.add'))
  expect(texts(island, 'li span')).toEqual(['n4'])
  expect(island.querySelector('.none')).toBeNull()
  click(island.querySelector('.x'))
  expect(texts(island, '.total')).toEqual(['1'])
})

test('without track, rows are keyed by index', async () => {
  const island = await mount(`<script>let xs = state(['a', 'b'])</script>
<button class="add" (click)="xs = [...xs, 'c']">+</button>@for (x of xs) {<i>{{ x }}</i>}`)
  click(island.querySelector('.add'))
  expect(texts(island, 'i')).toEqual(['a', 'b', 'c'])
})

test('@if inside a row and component state in a row both update', async () => {
  const island = await mount(`<script>
  let xs = state([1, 2, 3])
  let limit = state(1)
</script>
<button class="up" (click)="limit++">up</button>@for (x of xs) {<i>@if (x > limit) {big} @else {small}</i>}`)
  expect(texts(island, 'i')).toEqual(['small', 'big', 'big'])
  click(island.querySelector('.up'))
  expect(texts(island, 'i')).toEqual(['small', 'small', 'big'])
})
