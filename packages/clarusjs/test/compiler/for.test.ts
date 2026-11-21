// @vitest-environment happy-dom
// #11: @for (item of list; track key) { … } @empty { … }
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { ClarusError } from '../../src/compiler/errors.ts'
import { parse } from '../../src/compiler/parse.ts'
import { importCode } from '../helpers.ts'

const server = (source: string) => compile(source, { file: 'x.tscl', target: 'server', clientUrl: '/x' }).code
async function render(source: string, props = {}) {
  return (await importCode(server(source), 'for-s')).render(props) as string
}
function compileError(source: string): ClarusError {
  try { compile(source, { file: 'x.tscl', target: 'server', clientUrl: '/x' }) } catch (e) { return e as ClarusError }
  throw new Error('expected compile to throw')
}
async function mount(source: string) {
  const s = await importCode(server(source), 'for-ms')
  const c = await importCode(compile(source, { file: 'x.tscl', target: 'client' }).code, 'for-mc')
  document.body.innerHTML = s.render({})
  const island = document.querySelector('cl-island')!
  c.attach(island, {})
  return island
}
const click = (el: Element | null) => (el as HTMLElement).click()
const texts = (island: Element, sel: string) => [...island.querySelectorAll(sel)].map((e) => e.textContent)

// --- parsing ---

test('parses item, list, track and @empty', () => {
  const f = parse('<ul>@for (post of posts; track post.id) {<li>{{ post.title }}</li>} @empty {<li>none</li>}</ul>', 'x.tscl')
  expect((f.nodes[0] as any).children[0]).toMatchObject({
    type: 'for', item: 'post', list: 'posts', track: 'post.id',
    children: [{ type: 'element', tag: 'li' }], empty: [{ type: 'element', tag: 'li' }],
  })
})

test('track is optional', () => {
  const f = parse('@for (n of [1, 2]) {{{ n }}}', 'x.tscl')
  expect(f.nodes[0]).toMatchObject({ type: 'for', item: 'n', list: '[1, 2]', track: null, empty: null })
})

test('@for errors are located', () => {
  expect(compileError('@for (posts) {x}').message).toMatch(/^x\.tscl:1:7 .*expected "item of list"/)
  expect(compileError('@for ({ a } of xs) {x}').message).toMatch(/^x\.tscl:1:7 .*a simple name/)
  expect(compileError('@for (x of xs; sort x) {x}').message).toMatch(/^x\.tscl:1:7 .*unknown @for clause "sort x"/)
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

test('#249: $first, $last, $even, $odd and $count in rows (server HTML, and a plain loop)', async () => {
  const src = '@input xs: string[] = ["a", "b", "c"]\n<ul>@for (x of xs; track x) { <li [class]="$even ? \'even\' : \'odd\'">{{ $index + 1 }}/{{ $count }} {{ x }}{{ $first ? \' first\' : \'\' }}{{ $last ? \' last\' : \'\' }}</li> }</ul>'
  expect(await render(src)).toBe('<ul> <li class="even">1/3 a first</li>  <li class="odd">2/3 b</li>  <li class="even">3/3 c last</li> </ul>')
  expect(await render(src.replace('"a", "b", "c"', '"a"'))).toBe('<ul> <li class="even">1/1 a first last</li> </ul>')
})

test('#249: in an island the derived names follow the list: adding a row moves $last and updates $count', async () => {
  const island = await mount('<script>\n  let xs = state(["a", "b"])\n</script>\n<ul>@for (x of xs; track x) { <li>{{ x }}{{ $last ? "!" : "" }} of {{ $count }}{{ $odd ? " odd" : "" }}</li> }</ul>\n<button (click)="xs = [...xs, \'c\']">add</button>')
  const items = () => [...island.querySelectorAll('li')].map((li) => li.textContent)
  expect(items()).toEqual(['a of 2', 'b! of 2 odd'])
  click(island.querySelector('button'))
  expect(items()).toEqual(['a of 3', 'b of 3 odd', 'c! of 3'])
})

test('#249: clearer @for errors: an item named like an implicit variable, two @empty blocks, two tracks', () => {
  expect(compileError('<ul>@for ($index of xs; track $index) { <li></li> }</ul>').message).toMatch(/^x\.tscl:1:11 .*\$index.*implicit/)
  expect(compileError('<ul>@for (x of xs; track x) { <li></li> } @empty { <li>none</li> } @empty { <li>none</li> }</ul>').message).toMatch(/only one @empty/)
  expect(compileError('<ul>@for (x of xs; track x; track x.id) { <li></li> }</ul>').message).toMatch(/only one track/)
})

test('#249: an island @for without track warns (rows are matched by position)', () => {
  const out = compile('<script>\n  let xs = state([1])\n</script>\n<ul>@for (x of xs) { <li>{{ x }}</li> }</ul>', { file: 'x.tscl', target: 'client' })
  expect(out.warnings.map((w) => w.message)).toEqual([expect.stringMatching(/^x\.tscl:4:5 @for without track/)])
  expect(compile('<ul>@for (x of [1]) { <li>{{ x }}</li> }</ul>', { file: 'x.tscl', target: 'client' }).warnings).toEqual([]) // not an island: nothing to match
})
