// #455: scoped slots. A component passes data to the content filling a slot (<slot name="row" [item]="r" />); the
// parent's fill names it (@slot('row', { item }) { … }) and renders with it. The slot's own content stays the fallback.
import { expect, test } from 'vitest'
import { ClarusError, compile } from '../../src/compiler/index.ts'
import { parse } from '../../src/compiler/parse.ts'
import { importCode, unscoped } from '../helpers.ts'

const server = (src: string, file = 'page.tscl') => compile(src, { file, target: 'server', clientUrl: '/x.js', scope: 's' }).code
const error = (src: string) => { try { server(src); return '' } catch (e) { return e instanceof ClarusError ? e.message : String(e) } }

const LIST = `@input rows: { id: number; name: string }[]
<ul>@for (r of rows; track r.id) {<li><slot name="row" [item]="r" [index]="$index">{{ r.name }}</slot></li>}</ul>
`
const render = async (page: string, list = LIST) => {
  const { render } = await importCode(server(page), 'scoped', { './list.tscl': server(list, 'list.tscl') })
  return unscoped(await render({}))
}
const ROWS = "[{ id: 1, name: 'Ada' }, { id: 2, name: 'Grace' }]"

test('parses the names a fill receives: @slot(\'row\', { item, index })', () => {
  const p = parse(`<list>@slot('row', { item, index }) { {{ item.name }} }</list>`, 'x.tscl')
  expect((p.nodes[0] as any).children[0]).toMatchObject({ type: 'fill', name: 'row', params: '{ item, index }' })
})

test('the page renders each row with the data the list passes; the list\'s markup stays around it', async () => {
  const html = await render(`@import list from './list.tscl'\n<list [rows]="${ROWS}">@slot('row', { item, index }) {<b>{{ index + 1 }}. {{ item.name }}</b>}</list>\n`)
  expect(html).toBe('<ul><li><b>1. Ada</b></li><li><b>2. Grace</b></li></ul>')
})

test('unfilled, the slot shows its fallback; a fill that takes no data works as before', async () => {
  expect(await render(`@import list from './list.tscl'\n<list [rows]="${ROWS}" />\n`)).toBe('<ul><li>Ada</li><li>Grace</li></ul>')
  expect(await render(`@import list from './list.tscl'\n<list [rows]="${ROWS}">@slot('row') {<i>row</i>}</list>\n`)).toBe('<ul><li><i>row</i></li><li><i>row</i></li></ul>')
})

test('the default slot can pass data too, and names can be renamed or defaulted as in JavaScript', async () => {
  const list = `@input rows: { id: number; name: string }[]\n<ol>@for (r of rows; track r.id) {<li><slot [item]="r" /></li>}</ol>\n`
  const html = await render(`@import list from './list.tscl'\n<list [rows]="${ROWS}">@slot('default', { item: person, extra = '!' }) {{{ person.name }}{{ extra }}}</list>\n`, list)
  expect(html).toBe('<ol><li>Ada!</li><li>Grace!</li></ol>')
})

test('the fill reads the page\'s own names too, next to the slot\'s', async () => {
  const html = await render(`@import list from './list.tscl'\n@input mark: string = '*'\n<list [rows]="${ROWS}">@slot('row', { item }) {{{ mark }}{{ item.name }}}</list>\n`)
  expect(html).toBe('<ul><li>*Ada</li><li>*Grace</li></ul>')
})

test('errors at their place: a handler in a fill with data inside an island (#472: showing it is fine), a pattern that isn\'t one', () => {
  expect(error(`@import list from './list.tscl'\n<script>\n  let n = state(0)\n</script>\n<div><list>@slot('row', { item }) {{{ item.name }}}</list></div>\n`)).toBe('')
  expect(error(`@import list from './list.tscl'\n<script>\n  let n = state(0)\n</script>\n<div><list>@slot('row', { item }) {<b (click)="n++">{{ item.name }}</b>}</list></div>\n`)).toMatch(/page\.tscl:5:39 a fill that receives data inside an island shows the data it receives: \(click\)/)
  expect(error(`@import list from './list.tscl'\n<list>@slot('row', 1 + 2) { }</list>\n`)).toMatch(/page\.tscl:2:20 a fill names what its slot passes like a function parameter/)
})

test('review: a slot passing [__proto__] gives the fill an own property, not a prototype', async () => {
  const child = compile('<p><slot name="x" [__proto__]="42" /></p>\n', { file: 'child.tscl', target: 'server', scope: 'c' }).code
  const page = compile("@import child from './child.tscl'\n<child>@slot('x', props) {{{ Object.hasOwn(props, '__proto__') ? props['__proto__'] : 'lost' }}}</child>\n", { file: 'page.tscl', target: 'server', scope: 'p' }).code
  const { render } = await importCode(page, 'proto', { './child.tscl': child })
  expect(unscoped(await render({}))).toBe('<p>42</p>')
})
