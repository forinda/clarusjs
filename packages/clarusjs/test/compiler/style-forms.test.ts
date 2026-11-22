// @vitest-environment happy-dom
// #404: [style.prop]="value" sets one property (custom properties too; null/undefined/false remove it), and a bound
// [style] takes an object (camelCase keys → kebab-case, values as written, no units added).
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { attrValue, styleValue } from '../../src/runtime/attrs.ts'
import { parse as parseProps } from '../../src/runtime/serialize.ts'
import { importCode } from '../helpers.ts'

const html = async (src: string, props: object = {}) => {
  const { code } = compile(src, { file: 'c.tscl', target: 'server', scope: 's', clientUrl: '/c.js' })
  return ((await importCode(code, 'sty', {}, true)) as { render: (p: object) => string }).render(props).replace(/ class="cl-c-s"/g, '')
}

test('styleValue: an object as declarations (camelCase to kebab-case, custom properties kept), strings as written', () => {
  expect(styleValue({ color: 'red', fontSize: '2em', '--accent': '#0b6e70', WebkitLineClamp: 2 })).toBe('color: red; font-size: 2em; --accent: #0b6e70; -webkit-line-clamp: 2;')
  expect(styleValue({ color: null, margin: false, padding: undefined, opacity: 0 })).toBe('opacity: 0;')
  expect(styleValue(['color: red', { margin: 0 }])).toBe('color: red; margin: 0;')
  expect(styleValue('color: red;')).toBe('color: red;')
  expect(styleValue(null)).toBe('')
  expect(attrValue('style', { color: 'red' })).toBe('color: red;')
})

test('[style.prop] sets one property, merged with the written style; null removes it', async () => {
  const src = "@input c: string | null\n<p style=\"margin: 0\" [style.color]=\"c\" [style.--accent]=\"c\" [style.fontSize]=\"'2em'\">x</p>"
  expect(await html(src, { c: 'red' })).toBe('<p style="margin: 0; color: red; --accent: red; font-size: 2em;">x</p>')
  expect(await html(src, { c: null })).toBe('<p style="margin: 0; font-size: 2em;">x</p>')
})

test('[style] with an object, merged with the written style', async () => {
  expect(await html("@input big: boolean\n<p style=\"margin: 0\" [style]=\"{ fontSize: big ? '2em' : null, color: 'red' }\">x</p>", { big: true })).toBe('<p style="margin: 0; font-size: 2em; color: red;">x</p>')
  expect(await html("<p [style]=\"{ color: 'red' }\">x</p>")).toBe('<p style="color: red;">x</p>')
})

test('in an island, a style property updates when state changes', async () => {
  const src = "<script>\n  let on = state(false)\n</script>\n<button type=\"button\" [style.color]=\"on ? 'red' : null\" (click)=\"on = !on\">x</button>\n"
  const s = await importCode(compile(src, { file: 'i.tscl', target: 'server', scope: 'i', clientUrl: '/i.js' }).code, 'sty-is', {}, true)
  const c = await importCode(compile(src, { file: 'i.tscl', target: 'client', scope: 'i' }).code, 'sty-ic')
  document.body.innerHTML = s.render({})
  const root = document.querySelector('cl-island')!
  const button = root.querySelector('button')!
  c.attach(root, parseProps(root.getAttribute('p')!))
  button.click()
  expect(button.getAttribute('style')).toBe('color: red;')
  button.click()
  expect(button.getAttribute('style') ?? '').toBe('')
})
