// @vitest-environment happy-dom
// #465 review: what the menu and radio group islands do in the browser, on hand-written server HTML.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { compile } from 'clarusjs/compiler'
import { afterEach, expect, test } from 'vitest'

afterEach(() => { document.body.innerHTML = '' })
const href = (path: string) => pathToFileURL(path).href
const clarus = (path: string) => href(resolve(import.meta.dirname, '../node_modules/clarusjs/src', path))

/** A part's client module (its attach()), imported from test/.tmp. */
async function client(name: string) {
  const source = readFileSync(resolve(import.meta.dirname, '../src', `${name}.tscl`), 'utf8')
  const code = compile(source, { file: `${name}.tscl`, target: 'client' }).code
    .replaceAll("'clarusjs/runtime'", `'${clarus('runtime/index.ts')}'`)
    .replaceAll("'@clarusjs/ui-primitives'", `'${href(resolve(import.meta.dirname, '../src/index.js'))}'`)
  mkdirSync(resolve(import.meta.dirname, '.tmp'), { recursive: true })
  const dir = mkdtempSync(resolve(import.meta.dirname, `.tmp/${name}-`))
  writeFileSync(resolve(dir, 'part.mjs'), code)
  return (await import(href(resolve(dir, 'part.mjs')))) as { attach(root: Element, props: object): void }
}
const key = (el: Element, k: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
const byText = (t: string) => [...document.querySelectorAll('button')].find((b) => b.textContent === t)!

test('menu: arrow keys and typeahead move through its own items, past a closed menu nested between them', async () => {
  const { attach } = await client('menu')
  document.body.innerHTML = '<cl-island c="menu"><div data-part="menu" data-cl-u="0"><button aria-haspopup="menu">File</button>'
    + '<div id="file-list" role="menu" popover="auto"><button role="menuitem" tabindex="-1" data-menu="file">Alpha</button>'
    + '<div data-part="menu"><button aria-haspopup="menu">More</button><div id="more-list" role="menu" popover="auto"><button role="menuitem" tabindex="-1" data-menu="more">Xray</button></div></div>'
    + '<button role="menuitem" tabindex="-1" data-menu="file">Bravo</button></div></div></cl-island>'
  attach(document.querySelector('cl-island')!, { id: 'file' })
  byText('Alpha').focus()
  key(byText('Alpha'), 'ArrowDown')
  expect(document.activeElement?.textContent).toBe('Bravo')
  key(byText('Bravo'), 'x') // Xray is the nested menu's
  expect(document.activeElement?.textContent).toBe('Bravo')
  byText('Xray').focus()
  key(byText('Xray'), 'b') // typed in the nested menu: not this menu's to handle
  expect(document.activeElement?.textContent).toBe('Xray')
})

test('radio group: after its form resets, the checked radio and data-checked follow value again', async () => {
  const { attach } = await client('radio-group')
  document.body.innerHTML = '<form><cl-island c="radio-group"><fieldset data-part="radio-group" data-cl-u="0"><legend><!--[0-->Size<!--]--></legend>'
    + '<label data-part="radio" data-checked><input type="radio" name="size" value="m" checked></label>'
    + '<label data-part="radio"><input type="radio" name="size" value="s"></label></fieldset></cl-island></form>'
  attach(document.querySelector('cl-island')!, { name: 'size', label: 'Size', value: 'm' })
  const [m, s] = [...document.querySelectorAll('input')] as HTMLInputElement[]
  s!.click()
  expect(s!.checked).toBe(true)
  document.querySelector('form')!.reset()
  await new Promise((r) => setTimeout(r, 10))
  expect([m!.checked, s!.checked]).toEqual([false, true])
  expect([...document.querySelectorAll('label')].map((l) => l.hasAttribute('data-checked'))).toEqual([false, true])
})

test('#465 review: a radio group moved into another form follows that form\'s reset', async () => {
  const { attach } = await client('radio-group')
  document.body.innerHTML = '<form id="a"><cl-island c="radio-group"><fieldset data-part="radio-group" data-cl-u="0"><legend><!--[0-->Size<!--]--></legend>'
    + '<label data-part="radio" data-checked><input type="radio" name="size" value="m" checked></label>'
    + '<label data-part="radio"><input type="radio" name="size" value="s"></label></fieldset></cl-island></form><form id="b"></form>'
  attach(document.querySelector('cl-island')!, { name: 'size', label: 'Size', value: 'm' })
  const b = document.getElementById('b') as HTMLFormElement
  b.append(document.querySelector('cl-island')!) // a fragment swap kept it (data-cl-persist) in a new form
  const [m, s] = [...document.querySelectorAll('input')] as HTMLInputElement[]
  s!.click()
  b.reset()
  await new Promise((r) => setTimeout(r, 10))
  expect([m!.checked, s!.checked]).toEqual([false, true])
})

const groupHtml = (type: string, pressed: string[]) => '<cl-island c="toggle-group"><div role="group" aria-label="Format" data-part="toggle-group" data-type="' + type + '" data-cl-u="0">'
  + ['bold', 'italic', 'underline'].map((v, i) => `<button type="button" aria-pressed="${pressed.includes(v)}" data-state="${pressed.includes(v) ? 'on' : 'off'}" tabindex="${i === 0 ? 0 : -1}" data-value="${v}" data-part="toggle-item">${v}</button>`).join('')
  + '</div></cl-island>'
const pressedItems = () => [...document.querySelectorAll('[data-part="toggle-item"]')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => (b as HTMLElement).dataset.value)

test('toggle group single: pressing one releases the others; pressing the pressed one keeps it', async () => {
  const { attach } = await client('toggle-group')
  document.body.innerHTML = groupHtml('single', ['bold'])
  attach(document.querySelector('cl-island')!, { label: 'Format', type: 'single', value: 'bold', values: [] })
  byText('italic').click()
  expect(pressedItems()).toEqual(['italic'])
  byText('italic').click()
  expect(pressedItems()).toEqual(['italic'])
})

test('toggle group multiple: each item toggles on its own', async () => {
  const { attach } = await client('toggle-group')
  document.body.innerHTML = groupHtml('multiple', [])
  attach(document.querySelector('cl-island')!, { label: 'Format', type: 'multiple', value: '', values: [] })
  byText('bold').click()
  byText('underline').click()
  expect(pressedItems()).toEqual(['bold', 'underline'])
  byText('bold').click()
  expect(pressedItems()).toEqual(['underline'])
})

test('toggle group: arrow keys move focus between items (one tab stop), Home and End too', async () => {
  const { attach } = await client('toggle-group')
  document.body.innerHTML = groupHtml('single', ['bold'])
  attach(document.querySelector('cl-island')!, { label: 'Format', type: 'single', value: 'bold', values: [] })
  byText('bold').focus()
  key(byText('bold'), 'ArrowRight')
  expect(document.activeElement).toBe(byText('italic'))
  key(byText('italic'), 'End')
  expect(document.activeElement).toBe(byText('underline'))
})
