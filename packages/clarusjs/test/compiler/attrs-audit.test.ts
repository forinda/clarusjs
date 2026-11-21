// @vitest-environment happy-dom
// #241: property vs attribute, checked against vue-core's exceptions (runtime-dom patchProp shouldSetAsProp,
// value set last, vModel details). clarusjs always sets attributes (plus the value/checked properties of fields), so
// most of Vue's exceptions can't happen here; these tests pin that, and the cases that needed a fix.
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { importCode } from '../helpers.ts'

async function mount(source: string) {
  const s = await importCode(compile(source, { file: 'x.tscl', target: 'server', clientUrl: '/x' }).code, 'audit-s')
  const c = await importCode(compile(source, { file: 'x.tscl', target: 'client' }).code, 'audit-c')
  document.body.innerHTML = s.render({})
  const island = document.querySelector('cl-island')!
  c.attach(island, {})
  return { island, html: s.render({}) as string, $: <E extends Element = HTMLInputElement>(sel: string) => island.querySelector(sel) as unknown as E }
}
const fire = (el: Element, type: string, init: EventInit & { isComposing?: boolean } = {}) => {
  const e = new Event(type, { bubbles: true, ...init })
  if (init.isComposing) Object.defineProperty(e, 'isComposing', { value: true })
  el.dispatchEvent(e)
}

test('always attributes: form, list, textarea type, width/height, svg (case kept)', async () => {
  const { $, html } = await mount(`<script>
  let f = state('f1'); let w = state(10)
</script>
<div><input class="a" [form]="f" [list]="'opts'"><textarea [type]="'x'"></textarea><img [width]="w" [height]="w" alt="">
<svg [viewBox]="'0 0 ' + w + ' ' + w"><circle [r]="w" /></svg></div>`)
  expect($('input.a').getAttribute('form')).toBe('f1')
  expect($('input.a').getAttribute('list')).toBe('opts')
  expect($('textarea').getAttribute('type')).toBe('x')
  expect($('img').getAttribute('width')).toBe('10')
  expect(html).toContain('viewBox="0 0 10 10"')
  expect($('circle').getAttribute('r')).toBe('10')
})

test('enumerated attributes and ARIA states keep false as "false"; aria-current false still removes it', async () => {
  const { $, html } = await mount(`<script>
  let on = state(false)
</script>
<div><p class="p" [spellcheck]="on" [draggable]="on" [contenteditable]="on" [translate]="on" [aria-expanded]="on" [aria-current]="on && 'page'" [hidden]="on">x</p>
<button (click)="on = !on">t</button></div>`)
  expect(html).toContain('spellcheck="false" draggable="false" contenteditable="false" translate="no" aria-expanded="false"')
  expect($('p').hasAttribute('hidden')).toBe(false) // a boolean attribute: false removes it
  expect($('p').hasAttribute('aria-current')).toBe(false) // the `active ? 'page' : false` idiom
  $('button').dispatchEvent(new Event('click', { bubbles: true }))
  const p = $('p')
  expect([p.getAttribute('spellcheck'), p.getAttribute('draggable'), p.getAttribute('contenteditable'), p.getAttribute('translate'), p.getAttribute('aria-expanded')]).toEqual(['true', 'true', 'true', 'yes', 'true'])
  expect(p.getAttribute('hidden')).toBe('')
})

test('value is set after type, min, max and step, whatever their order in the tag (a browser clamps it otherwise)', () => {
  const code = compile('<script>\n  let v = state(150); let max = state(200)\n</script>\n<div><input type="range" [value]="v" [max]="max"></div>', { file: 'x.tscl', target: 'client' }).code
  expect(code.indexOf('"max"')).toBeGreaterThan(-1)
  expect(code.indexOf('"max"')).toBeLessThan(code.indexOf('"value"'))
})

test('<option [value]>, and a null value is an empty field', async () => {
  const { $ } = await mount(`<script>
  let opt = state('b'); let v = state(null)
</script>
<div><select [(value)]="opt"><option [value]="'a'">A</option><option [value]="'b'">B</option></select><input class="n" [value]="v"></div>`)
  expect($<HTMLSelectElement>('select').value).toBe('b')
  expect($('input.n').value).toBe('')
})

test('[(value)] on a text field doesn\'t write mid-composition (IME); it writes when composition ends', async () => {
  const { $ } = await mount(`<script>
  let t = state('')
</script>
<div><input [(value)]="t"><p class="out">{{ t }}</p></div>`)
  const input = $('input')
  input.value = 'ｋ'
  fire(input, 'input', { isComposing: true })
  expect($('p.out').textContent).toBe('')
  input.value = 'か'
  fire(input, 'compositionend')
  expect($('p.out').textContent).toBe('か')
})

test('[(value)] on number and range inputs writes numbers (an empty field stays "")', async () => {
  const { $ } = await mount(`<script>
  let n = state(1)
</script>
<div><input type="number" [(value)]="n"><p class="out">{{ typeof n }} {{ n }}</p></div>`)
  const input = $('input')
  input.value = '42'
  fire(input, 'input')
  expect($('p.out').textContent).toBe('number 42')
  input.value = ''
  fire(input, 'input')
  expect($('p.out').textContent).toBe('string ')
})

test('[(value)] on checkboxes with a value binds an array: checked when it includes the value; toggling adds or removes', async () => {
  const { $ } = await mount(`<script>
  let tags = state(['a'])
</script>
<div><input class="a" type="checkbox" value="a" [(value)]="tags"><input class="b" type="checkbox" value="b" [(value)]="tags"><p class="out">{{ tags.join(',') }}</p></div>`)
  expect($('input.a').checked).toBe(true)
  expect($('input.b').checked).toBe(false)
  $('input.b').click()
  expect($('p.out').textContent).toBe('a,b')
  $('input.a').click()
  expect($('p.out').textContent).toBe('b')
})

test('[(value)] on <select multiple> binds an array of the selected values', async () => {
  const { $ } = await mount(`<script>
  let picked = state(['b'])
</script>
<div><select multiple [(value)]="picked"><option value="a">A</option><option value="b">B</option><option value="c">C</option></select><p class="out">{{ picked.join(',') }}</p></div>`)
  const select = $<HTMLSelectElement>('select')
  expect([...select.options].map((o) => o.selected)).toEqual([false, true, false])
  select.options[2]!.selected = true
  fire(select, 'change')
  expect($('p.out').textContent).toBe('b,c')
})
