// @vitest-environment happy-dom
// #465 review: what the menu and radio group islands do in the browser, on hand-written server HTML.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { compile } from 'clarusjs/compiler'
import { afterEach, expect, test, vi } from 'vitest'

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

const regionHtml = '<cl-island c="toast-region"><section aria-label="Notifications" data-part="toast-region" data-cl-u="0"><ol aria-live="polite" data-part="toast-list"></ol></section></cl-island>'
const shown = () => [...document.querySelectorAll('[data-part="toast"] [data-part="toast-message"]')].map((m) => m.textContent)

test('toast: a message sent before the region attaches is shown once it does; focus never moves', async () => {
  const { toast, clearToasts } = await import('../src/toast.js')
  clearToasts()
  const { attach } = await client('toast-region')
  document.body.innerHTML = '<button id="here">x</button>' + regionHtml
  ;(document.getElementById('here') as HTMLElement).focus()
  toast('Saved early')
  attach(document.querySelector('cl-island')!, {})
  expect(shown()).toEqual(['Saved early'])
  toast('Saved again')
  expect(shown()).toEqual(['Saved early', 'Saved again'])
  expect(document.activeElement?.id).toBe('here')
})

test('toast: dismissed after its duration, paused while hovered or focused', async () => {
  const { toast, clearToasts } = await import('../src/toast.js')
  clearToasts()
  vi.useFakeTimers()
  const { attach } = await client('toast-region')
  document.body.innerHTML = regionHtml
  attach(document.querySelector('cl-island')!, {})
  toast('Bye', { duration: 1000 })
  const item = document.querySelector('[data-part="toast"]') as HTMLElement
  item.dispatchEvent(new Event('pointerenter'))
  vi.advanceTimersByTime(3000)
  expect(shown()).toEqual(['Bye'])
  item.dispatchEvent(new Event('pointerleave'))
  vi.advanceTimersByTime(1100)
  expect(shown()).toEqual([])
  vi.useRealTimers()
})

test('toast: Escape dismisses the focused toast; an action runs, then dismisses', async () => {
  const { toast, clearToasts } = await import('../src/toast.js')
  clearToasts()
  const { attach } = await client('toast-region')
  document.body.innerHTML = regionHtml
  attach(document.querySelector('cl-island')!, {})
  let undone = 0
  toast('Deleted', { action: { label: 'Undo', onClick: () => undone++ } })
  toast('Other')
  const [first] = [...document.querySelectorAll('[data-part="toast"]')] as HTMLElement[]
  byText('Undo').click()
  expect(undone).toBe(1)
  expect(shown()).toEqual(['Other'])
  const other = document.querySelector('[data-part="toast"]') as HTMLElement
  other.focus()
  key(other, 'Escape')
  expect(shown()).toEqual([])
  void first
})

const navHtml = '<cl-island c="sidebar-trigger"><button type="button" aria-controls="nav" data-part="sidebar-trigger" data-cl-e="0">Menu</button></cl-island><nav id="nav" aria-label="Sidebar" popover="auto" data-part="sidebar" data-state="open"></nav>'
const wide = (yes: boolean) => vi.spyOn(window, 'matchMedia').mockImplementation((q) => ({ matches: yes && q.includes('min-width'), media: q } as MediaQueryList))

test('sidebar: on a wide screen the trigger collapses and reopens it, remembered', async () => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-sidebar')
  wide(true)
  const { attach } = await client('sidebar-trigger')
  document.body.innerHTML = navHtml
  attach(document.querySelector('cl-island')!, { target: 'nav' })
  byText('Menu').click()
  expect(document.documentElement.dataset.sidebar).toBe('collapsed')
  expect(localStorage.getItem('ui-sidebar')).toBe('collapsed')
  expect(document.getElementById('nav')!.dataset.state).toBe('collapsed')
  byText('Menu').click()
  expect(document.documentElement.dataset.sidebar).toBe('open')
  expect(localStorage.getItem('ui-sidebar')).toBe('open')
  vi.restoreAllMocks()
})

test('sidebar: on a phone the trigger opens it as a popover instead', async () => {
  wide(false)
  const { attach } = await client('sidebar-trigger')
  document.body.innerHTML = navHtml
  const nav = document.getElementById('nav') as HTMLElement
  let toggled = 0
  nav.togglePopover = () => { toggled++; return true }
  attach(document.querySelector('cl-island')!, { target: 'nav' })
  byText('Menu').click()
  expect(toggled).toBe(1)
  vi.restoreAllMocks()
})

test('sidebar: the head script applies a remembered collapse before paint', async () => {
  const { SIDEBAR_SCRIPT } = await import('../src/sidebar.js')
  document.documentElement.removeAttribute('data-sidebar')
  localStorage.setItem('ui-sidebar', 'collapsed')
  new Function(SIDEBAR_SCRIPT)()
  expect(document.documentElement.dataset.sidebar).toBe('collapsed')
  localStorage.setItem('ui-sidebar', '<x>')
  document.documentElement.removeAttribute('data-sidebar')
  new Function(SIDEBAR_SCRIPT)()
  expect(document.documentElement.dataset.sidebar).toBeUndefined()
})
