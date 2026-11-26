// @vitest-environment happy-dom
// @for (…; let s = $index): a row's implicit names under names of their own, so a nested loop can reach the outer
// loop's index. Without it, an inner loop's $index indexing an outer loop's list is an error, not a silent wrong row.
import { afterEach, expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { ClarusError } from '../../src/compiler/errors.ts'
import { attachAll } from '../../src/runtime/loader.ts'
import { importCode } from '../helpers.ts'

afterEach(() => { document.body.innerHTML = '' })

async function mount(src: string, name: string) {
  const s = await importCode(compile(src, { file: 'x.tscl', target: 'server', clientUrl: '/x.js' }).code, name + '-s')
  const c = await importCode(compile(src, { file: 'x.tscl', target: 'client' }).code, name + '-c')
  document.body.innerHTML = s.render({})
  await attachAll(document, async () => c)
}
const $$ = (sel: string) => [...document.querySelectorAll(sel)] as HTMLInputElement[]
const type = (el: HTMLInputElement, value: string) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })) }
const error = (src: string) => { try { compile(src, { file: 'x.tscl', target: 'client' }); return '' } catch (e) { return (e as ClarusError).message } }

const nested = `<script>
  let order = state({ sections: [{ title: 'A', items: [{ name: 'a0' }, { name: 'a1' }] }, { title: 'B', items: [{ name: 'b0' }] }] })
  function addSection() { order = { sections: [{ title: 'New', items: [{ name: 'n0' }] }, ...order.sections] } }
</script>
@for (section of order.sections; track $index; let s = $index, last = $last) {
  <fieldset>
    <input class="title" [(value)]="order.sections[s].title">
    @for (item of section.items; track $index) {
      <label class="row">{{ s + 1 }}.{{ $index + 1 }}{{ last ? ' (last)' : '' }} <input class="name" [(value)]="order.sections[s].items[$index].name"></label>
    }
  </fieldset>
}
<button (click)="addSection()">add</button>
<output>{{ JSON.stringify(order) }}</output>
`

test('let s = $index: an inner row binds through the outer row\'s index, and reads it', async () => {
  await mount(nested, 'let')
  expect($$('.row').map((r) => r.textContent!.trim())).toEqual(['1.1', '1.2', '2.1 (last)'])
  type($$('.name')[2]!, 'B0') // section 1, item 0
  type($$('.title')[1]!, 'BB')
  expect(JSON.parse(document.querySelector('output')!.textContent!)).toEqual({ sections: [{ title: 'A', items: [{ name: 'a0' }, { name: 'a1' }] }, { title: 'BB', items: [{ name: 'B0' }] }] })
})

test('the alias follows its row when rows move: a section added above renumbers the rows below', async () => {
  await mount(nested, 'move')
  document.querySelector('button')!.click()
  expect($$('.row').map((r) => r.textContent!.trim())).toEqual(['1.1', '2.1', '2.2', '3.1 (last)'])
  type($$('.name')[3]!, 'B0!') // now section 2, item 0
  expect(JSON.parse(document.querySelector('output')!.textContent!).sections[2].items[0].name).toBe('B0!')
})

test('let in a static component (no script): the server renders the aliases', async () => {
  const s = await importCode(compile(`@for (row of [['a', 'b'], ['c']]; track $index; let r = $index, n = $count) {
  @for (cell of row; track $index) {<i>{{ r }}/{{ n }}:{{ $index }}{{ cell }}</i>}
}`, { file: 'x.tscl', target: 'server' }).code, 'static')
  expect(s.render({}).replace(/<!--.*?-->/g, '').replace(/\s+/g, '')).toBe('<i>0/2:0a</i><i>0/2:1b</i><i>1/2:0c</i>')
})

test('let errors: only an implicit name, a name of its own, one each', () => {
  const at = (head: string) => error(`<script>\n  let rows = state([1])\n</script>\n@for (${head}) {<i>{{ row }}</i>}\n`)
  expect(at('row of rows; track $index; let i = $index')).toBe('')
  expect(at('row of rows; track $index; let i = index')).toMatch(/let takes the row's \$index, \$count, \$first, \$last, \$even or \$odd: i = index/)
  expect(at('row of rows; track $index; let row = $index')).toMatch(/"row" is this @for's item/)
  expect(at('row of rows; track $index; let $count = $index')).toMatch(/"\$count" is an implicit @for variable/)
  expect(at('row of rows; track $index; let i = $index, i = $count')).toMatch(/"i" is named twice/)
  expect(at('row of rows; track $index; let i')).toMatch(/let takes name = \$index/)
})

test('an inner loop\'s $index indexing an outer loop\'s list is an error that names let, in a binding and in a read', () => {
  const src = (inner: string) => `<script>
  let order = state({ sections: [{ items: [{ name: '' }] }] })
</script>
@for (section of order.sections; track $index) {
  @for (item of section.items; track $index) {
    ${inner}
  }
}
`
  expect(error(src('<input [(value)]="order.sections[$index].items[$index].name">'))).toMatch(/^x\.tscl:6:\d+ .*\$index here is the inner @for's, not the one over order\.sections: name that one's index, @for \(section of order\.sections; …; let i = \$index\), and write order\.sections\[i\]/)
  expect(error(src('<b>{{ order.sections[$index].items.length }}</b>'))).toMatch(/\$index here is the inner @for's/)
  expect(error(src('<button (click)="order.sections[$index] = null">x</button>'))).toMatch(/\$index here is the inner @for's/)
  // Its own list, by its own index: fine.
  expect(error(src('<input [(value)]="order.sections[0].items[$index].name">'))).toBe('')
})

test('a nested loop over the same list may index it with its own $index', () => {
  expect(error(`<script>\n  let rows = state([1, 2])\n</script>\n@for (a of rows; track $index) {\n  @for (b of rows; track $index) {<i>{{ rows[$index] }}</i>}\n}\n`)).toBe('')
})
