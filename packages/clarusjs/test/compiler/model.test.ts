// @vitest-environment happy-dom
// #219: two-way binding. [(x)]="path" passes path as x and writes back copy-on-write (the previous state is the old
// value, so reset and undo need no cloning); @model x is the only kind of input a child may write.
import { afterEach, expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { ClarusError } from '../../src/compiler/errors.ts'
import { parse } from '../../src/compiler/parse.ts'
import { attachAll } from '../../src/runtime/loader.ts'
import { importCode } from '../helpers.ts'

afterEach(() => { document.body.innerHTML = '' })
const compileError = (source: string): ClarusError => {
  try { compile(source, { file: 'x.tscl', target: 'client' }) } catch (e) { return e as ClarusError }
  throw new Error('expected compile to throw')
}
const type = (el: Element, value: string) => {
  ;(el as HTMLInputElement).value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

test('parsing: @model is an input that may be written; [(x)] is a two-way binding', () => {
  const parsed = parse("@input label: string\n@model value: string = ''\n<field [(value)]=\"form.name\" />\n", 'x.tscl')
  expect(parsed.inputs.map((i) => [i.name, !!i.model])).toEqual([['label', false], ['value', true]])
  expect((parsed.nodes[0] as { attrs: unknown[] }).attrs).toEqual([{ kind: 'model', name: 'value', expr: 'form.name', start: 54 }])
})

const field = `@input label: string
@model value: string = ''
<label class="field">{{ label }} <input [value]="value" (input)="value = $event.target.value"></label>
`
const form = `@import field from './field.tscl'
<script>
  let form = state({ name: 'Ada', plan: { tier: 'free' } })
  const initial = form // the baseline, taken from the state (which the browser restores from the server)
  let seen = state([])
  function reset() { form = initial }
  function keep() { seen = [...seen, form] }
</script>
<div><field [label]="'Name'" [(value)]="form.name" /> <field [label]="'Tier'" [(value)]="form.plan.tier" />
<p class="out">{{ form.name }}/{{ form.plan.tier }}</p> <button class="reset" (click)="reset()">reset</button> <button class="keep" (click)="keep()">keep</button>
<p class="same">{{ seen.length ? String(seen[0] === initial) : '' }}</p></div>
`

async function mountForm() {
  const fieldServer = compile(field, { file: 'field.tscl', target: 'server', clientUrl: '/field.js' }).code
  const deps = { './field.tscl': fieldServer, './field.tscl?render': fieldServer }
  const s = await importCode(compile(form, { file: 'form.tscl', target: 'server', clientUrl: '/form.js' }).code, 'model-s', deps)
  const pc = await importCode(compile(form, { file: 'form.tscl', target: 'client' }).code, 'model-pc', deps)
  const fc = await importCode(compile(field, { file: 'field.tscl', target: 'client' }).code, 'model-fc')
  document.body.innerHTML = s.render({})
  await attachAll(document, async (src) => (src === '/form.js' ? pc : fc))
}

test('a child writing its @model updates the parent copy-on-write, also along a longer path; reset goes back without cloning', async () => {
  await mountForm()
  const [name, tier] = [...document.querySelectorAll('input')]
  expect(name!.value).toBe('Ada')
  ;(document.querySelector('.keep') as HTMLElement).click() // remember the starting value
  type(name!, 'Grace')
  type(document.querySelectorAll('input')[1]!, 'pro')
  expect(document.querySelector('.out')!.textContent).toBe('Grace/pro')
  ;(document.querySelector('.reset') as HTMLElement).click()
  expect(document.querySelector('.out')!.textContent).toBe('Ada/free')
  expect([...document.querySelectorAll('input')].map((i) => i.value)).toEqual(['Ada', 'free']) // the fields follow
  expect(document.querySelectorAll('input')[0]).toBe(name) // in place
  expect(document.querySelector('.same')!.textContent).toBe('true') // the kept value was never changed
  void tier
})

test('a top-level island with a @model (no parent to update) keeps the value itself', async () => {
  const s = await importCode(compile(field, { file: 'field.tscl', target: 'server', clientUrl: '/field.js' }).code, 'model-ts')
  const c = await importCode(compile(field, { file: 'field.tscl', target: 'client' }).code, 'model-tc')
  document.body.innerHTML = s.render({ label: 'Alone', value: 'a' })
  await attachAll(document, async () => c)
  const input = document.querySelector('input')!
  type(input, 'b')
  expect(input.value).toBe('b')
})

test('native inputs: [(value)] on text inputs and selects, [(checked)] on checkboxes', async () => {
  const src = `<script>
  let form = state({ name: '', size: 's', agree: false })
</script>
<div><input class="name" [(value)]="form.name"> <select class="size" [(value)]="form.size"><option value="s">s</option><option value="l">l</option></select>
<input class="agree" type="checkbox" [(checked)]="form.agree"> <p class="out">{{ form.name }}|{{ form.size }}|{{ String(form.agree) }}</p></div>
`
  const s = await importCode(compile(src, { file: 'x.tscl', target: 'server', clientUrl: '/x.js' }).code, 'model-ns')
  const c = await importCode(compile(src, { file: 'x.tscl', target: 'client' }).code, 'model-nc')
  document.body.innerHTML = s.render({})
  c.attach(document.querySelector('cl-island')!, {})
  type(document.querySelector('.name')!, 'Lin')
  const size = document.querySelector('.size') as HTMLSelectElement
  size.value = 'l'
  size.dispatchEvent(new Event('change', { bubbles: true }))
  ;(document.querySelector('.agree') as HTMLElement).click()
  expect(document.querySelector('.out')!.textContent).toBe('Lin|l|true')
})

test('errors: [(x)] needs a variable or property path, a script with state, and a bindable native property', () => {
  expect(compileError("@import f from './f.tscl'\n<script>let a = state(1)</script>\n<f [(value)]=\"a + 1\" />\n").message)
    .toBe('x.tscl:3:4 [(value)] needs a variable or a property path (form.name, rows[$index].name) to write back to, not "a + 1"')
  expect(() => compile("@import f from './f.tscl'\n<f [(value)]=\"x\" />\n", { file: 'x.tscl', target: 'server' })).toThrow('x.tscl:2:4 [(value)] needs a <script> with state to write back to')
  expect(compileError('<script>let a = state(1)</script>\n<div [(title)]="a"></div>\n').message)
    .toBe('x.tscl:2:6 [(title)] on <div>: an element binds two ways only with [(value)] (input, select, textarea) or [(checked)]')
})

test('rows: [(value)]="rows[$index].name" writes back into the list, copy-on-write; a row variable is a located error', async () => {
  const src = `<script>
  let rows = state([{ name: 'a' }, { name: 'b' }])
  const first = rows
</script>
<div>@for (row of rows; track $index) {<input class="row" [(value)]="rows[$index].name">}<p class="out">{{ rows.map((r) => r.name).join(',') }}</p><p class="kept">{{ String(first[1].name) }}</p></div>
`
  const s = await importCode(compile(src, { file: 'x.tscl', target: 'server', clientUrl: '/x.js' }).code, 'model-rs')
  const c = await importCode(compile(src, { file: 'x.tscl', target: 'client' }).code, 'model-rc')
  document.body.innerHTML = s.render({})
  c.attach(document.querySelector('cl-island')!, {})
  type(document.querySelectorAll('.row')[1]!, 'B')
  expect(document.querySelector('.out')!.textContent).toBe('a,B')
  expect(document.querySelector('.kept')!.textContent).toBe('b') // the old list is untouched
  expect(compileError('<script>let rows = state([{ name: \'a\' }])</script>\n@for (row of rows; track $index) {<input [(value)]="row.name">}\n').message)
    .toBe('x.tscl:2:42 [(value)] can\'t write back to the row variable "row": bind the list by index, like [(value)]="rows[$index].name"')
})

test('#267: radio groups: [(value)] on radios binds one value; checked when equal, writes its value when picked', async () => {
  const src = `<script>
  let plan = state('free')
  const tiers = ['team', 'enterprise']
  let tier = state('team')
</script>
<div><label><input class="free" type="radio" name="plan" value="free" [(value)]="plan"> Free</label>
<label><input class="pro" type="radio" name="plan" value="pro" [(value)]="plan"> Pro</label>
@for (t of tiers; track t) { <input [class]="t" type="radio" name="tier" [value]="t" [(value)]="tier"> }
<p class="out">{{ plan }}|{{ tier }}</p>
<button class="reset" (click)="plan = 'free'">reset</button></div>
`
  const server = compile(src, { file: 'x.tscl', target: 'server', clientUrl: '/x.js' }).code
  const s = await importCode(server, 'radio-s', {}, true)
  const html = s.render({}) as string
  expect(html).toMatch(/<input class="free[^>]*value="free"[^>]* checked/)
  expect(html).not.toMatch(/value="pro"[^>]* checked/)
  expect(html).toContain('data-cl-path=""') // the path without its root name: the whole of plan
  const c = await importCode(compile(src, { file: 'x.tscl', target: 'client' }).code, 'radio-c')
  document.body.innerHTML = html
  c.attach(document.querySelector('cl-island')!, {})
  ;(document.querySelector('input.pro') as HTMLElement).click()
  ;(document.querySelector('input.enterprise') as HTMLElement).click()
  expect(document.querySelector('.out')!.textContent).toBe('pro|enterprise')
  ;(document.querySelector('.reset') as HTMLElement).click()
  expect((document.querySelector('input.free') as HTMLInputElement).checked).toBe(true)
  expect((document.querySelector('input.pro') as HTMLInputElement).checked).toBe(false)
})

test('#267: a radio bound with [(value)] needs a value (static or [value])', () => {
  expect(compileError('<script>let plan = state("a")</script>\n<input type="radio" [(value)]="plan">\n').message)
    .toBe('x.tscl:2:21 a radio bound with [(value)] needs a value (value="…" or [value]): it\'s what the radio writes when picked')
})

test('a textarea\'s [value] or [(value)] is its text in the HTML (a value attribute means nothing on a textarea)', async () => {
  const src = `@input start: string = ''
<script>
  let note = state(start)
  let open = state(true)
</script>
<div><textarea class="a" [(value)]="note"></textarea>
@if (open) { <textarea class="b" [value]="note + '!'"></textarea> }</div>
`
  const s = await importCode(compile(src, { file: 'x.tscl', target: 'server', clientUrl: '/x.js' }).code, 'model-tas')
  const c = await importCode(compile(src, { file: 'x.tscl', target: 'client' }).code, 'model-tac')
  const html = s.render({ start: '</textarea><b>&' })
  expect(html).not.toContain('value=')
  expect(html).toMatch(/<textarea class="a[^"]*"[^>]*>&lt;\/textarea&gt;&lt;b&gt;&amp;<\/textarea>/)
  document.body.innerHTML = html
  c.attach(document.querySelector('cl-island')!, { start: '</textarea><b>&' })
  const [a, b] = [...document.querySelectorAll('textarea')]
  expect([a!.value, b!.value]).toEqual(['</textarea><b>&', '</textarea><b>&!'])
  type(a!, 'next')
  expect(document.querySelector<HTMLTextAreaElement>('.b')!.value).toBe('next!')
  // outside an island too
  const plain = await importCode(compile('@input v: string = \'\'\n<textarea [value]="v"></textarea>\n', { file: 'p.tscl', target: 'server' }).code, 'model-tap')
  expect(plain.render({ v: 'x < y' })).toMatch(/<textarea[^>]*>x &lt; y<\/textarea>/)
})
