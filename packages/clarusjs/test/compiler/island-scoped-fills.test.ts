// @vitest-environment happy-dom
// #472: inside an island, a fill may receive the slot's data (@slot('row', { item }) { … }) when it shows it: the
// island re-renders the component, fill included, when what they read changes. Handlers and bindings in such a fill
// are still an error (the browser would need the slot's data to wire them).
import { afterEach, expect, test } from 'vitest'
import { ClarusError, compile } from '../../src/compiler/index.ts'
import { attachAll } from '../../src/runtime/loader.ts'
import { importCode } from '../helpers.ts'

afterEach(() => { document.body.innerHTML = '' })

const LIST = `@input rows: { id: number; name: string }[]
<ul>@for (r of rows; track r.id) {<li><slot name="row" [item]="r" [index]="$index">{{ r.name }}</slot></li>}</ul>
`
const page = (fill: string) => `@import list from './list.tscl'
<script>
  let rows = state([{ id: 1, name: 'Ada' }, { id: 2, name: 'Grace' }])
  let mark = state('-')
  function more() { rows = [...rows, { id: 3, name: 'Edsger' }]; mark = '+' }
</script>
<list [rows]="rows">${fill}</list>
<button (click)="more()">more</button>
`
let n = 0
async function mount(src: string) {
  const list = compile(LIST, { file: 'list.tscl', target: 'server', clientUrl: '/list.js' }).code
  const deps = { './list.tscl': list, './list.tscl?render': list }
  const s = await importCode(compile(src, { file: 'page.tscl', target: 'server', clientUrl: '/page.js' }).code, `isf-s-${n}`, deps)
  const c = await importCode(compile(src, { file: 'page.tscl', target: 'client' }).code, `isf-c-${n++}`, deps)
  document.body.innerHTML = s.render({})
  await attachAll(document, async () => c)
}
const rows = () => [...document.querySelectorAll('li')].map((l) => l.textContent!.trim())
const error = (src: string) => { try { compile(src, { file: 'page.tscl', target: 'client' }); return '' } catch (e) { return e instanceof ClarusError ? e.message : String(e) } }

test('an island fills a slot with the data it passes, and the fill follows the island\'s state', async () => {
  await mount(page("@slot('row', { item, index }) {<b>{{ mark }}{{ index + 1 }} {{ item.name }}</b>}"))
  expect(rows()).toEqual(['-1 Ada', '-2 Grace'])
  document.querySelector('button')!.click()
  await Promise.resolve()
  expect(rows()).toEqual(['+1 Ada', '+2 Grace', '+3 Edsger'])
})

test('@if and @for inside such a fill render with the data, and re-render with it', async () => {
  await mount(page("@slot('row', { item }) {@if (item.id > 2) {<i>new</i>} @for (c of item.name.split('').slice(0, 2); track $index) {<s>{{ c }}</s>}}"))
  expect(rows()).toEqual(['Ad', 'Gr'])
  document.querySelector('button')!.click()
  await Promise.resolve()
  expect(rows()).toEqual(['Ad', 'Gr', 'new Ed'])
})

test('a handler or binding in a fill that receives data inside an island is an error at its place', () => {
  expect(error(page("@slot('row', { item }) {<button (click)=\"mark = item.name\">x</button>}"))).toMatch(/^page\.tscl:7:\d+ .*shows the data it receives.*\(click\)/)
  expect(error(page("@slot('row', { item }) {<input [(value)]=\"mark\">}"))).toMatch(/^page\.tscl:7:\d+ .*shows the data it receives/)
  expect(error(page("@slot('row', { item }) {<b [use]=\"(el) => el\">{{ item.name }}</b>}"))).toMatch(/^page\.tscl:7:\d+ .*shows the data it receives/)
})
