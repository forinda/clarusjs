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

const navHtml = '<cl-island c="sidebar-trigger"><button type="button" aria-controls="nav" popovertarget="nav" data-part="sidebar-trigger" data-cl-u="0" data-cl-e="0">Menu</button></cl-island><nav id="nav" aria-label="Sidebar" popover="auto" data-part="sidebar" data-state="open"></nav>'
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

test('sidebar: on a phone the trigger leaves the click to the browser (its popovertarget opens the panel)', async () => {
  wide(false)
  const { attach } = await client('sidebar-trigger')
  document.body.innerHTML = navHtml
  const nav = document.getElementById('nav') as HTMLElement
  nav.matches = ((sel: string) => sel === ':popover-open' ? false : HTMLElement.prototype.matches.call(nav, sel)) as typeof nav.matches
  attach(document.querySelector('cl-island')!, { target: 'nav' })
  const event = new MouseEvent('click', { bubbles: true, cancelable: true })
  byText('Menu').dispatchEvent(event)
  expect(event.defaultPrevented).toBe(false)
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

test('#review: on a wide screen the trigger cancels the popover toggle and keeps aria-expanded in step', async () => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-sidebar')
  wide(true)
  const { attach } = await client('sidebar-trigger')
  document.body.innerHTML = navHtml.replace('data-cl-e="0"', 'aria-expanded="true" data-cl-e="0"')
  attach(document.querySelector('cl-island')!, { target: 'nav' })
  const event = new MouseEvent('click', { bubbles: true, cancelable: true })
  byText('Menu').dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true)
  expect(byText('Menu').getAttribute('aria-expanded')).toBe('false')
  vi.restoreAllMocks()
})

test('#review: toasts with an action stay until dismissed; Infinity never times out; focus moves on dismiss', async () => {
  const { toast, clearToasts } = await import('../src/toast.js')
  clearToasts()
  vi.useFakeTimers()
  const { attach } = await client('toast-region')
  document.body.innerHTML = '<button id="origin">o</button>' + regionHtml
  attach(document.querySelector('cl-island')!, {})
  toast('Deleted', { action: { label: 'Undo', onClick: () => {} } })
  toast('Pinned', { duration: Infinity })
  toast('Plain')
  vi.advanceTimersByTime(60_000)
  expect(shown()).toEqual(['Deleted', 'Pinned'])
  const [first] = [...document.querySelectorAll('[data-part="toast"]')] as HTMLElement[]
  ;(document.getElementById('origin') as HTMLElement).focus()
  first!.focus()
  first!.dispatchEvent(new FocusEvent('focusin', { bubbles: true, relatedTarget: document.getElementById('origin') }))
  key(first!, 'Escape')
  expect(shown()).toEqual(['Pinned'])
  expect((document.activeElement as HTMLElement).dataset.part).toBe('toast') // moved to the next toast
  const second = document.activeElement as HTMLElement
  key(second, 'Escape')
  expect(document.activeElement?.id).toBe('origin') // none left: back where it came from
  vi.useRealTimers()
})

test('#review: leaving with the pointer while the toast has focus keeps it', async () => {
  const { toast, clearToasts } = await import('../src/toast.js')
  clearToasts()
  vi.useFakeTimers()
  const { attach } = await client('toast-region')
  document.body.innerHTML = regionHtml
  attach(document.querySelector('cl-island')!, {})
  toast('Hold', { duration: 1000 })
  const item = document.querySelector('[data-part="toast"]') as HTMLElement
  item.focus()
  item.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
  item.dispatchEvent(new Event('pointerleave'))
  vi.advanceTimersByTime(5000)
  expect(shown()).toEqual(['Hold'])
  vi.useRealTimers()
})

const regionWith = (templates: string) => '<cl-island c="toast-region"><section aria-label="Notifications" data-part="toast-region" data-cl-u="0">' + templates + '<ol aria-live="polite" data-part="toast-list"></ol></section></cl-island>'
async function region(templates = '') {
  const { toast, clearToasts } = await import('../src/toast.js')
  clearToasts()
  const { attach } = await client('toast-region')
  document.body.innerHTML = regionWith(templates)
  attach(document.querySelector('cl-island')!, {})
  return toast
}
const item = () => document.querySelector('[data-part="toast"]') as HTMLElement

test('toast types: data-type, a default icon per kind (hidden), the kind said in words', async () => {
  const toast = await region()
  toast('Upload failed', { type: 'error' })
  expect(item().dataset.type).toBe('error')
  expect(item().querySelector('[data-part="toast-icon"] svg')).not.toBeNull()
  expect(item().querySelector('[data-part="toast-icon"]')!.getAttribute('aria-hidden')).toBe('true')
  expect(item().querySelector('[data-part="toast-kind"]')!.textContent).toBe('Error:')
  expect(item().querySelector('[data-part="toast-message"]')!.textContent).toBe('Upload failed')
})

test('toast templates: the general template replaces the default markup; parts are filled; no action, no action button', async () => {
  const toast = await region('<template data-type="toast"><div class="mine"><p data-part="toast-message"></p><button data-part="toast-action"></button><button data-part="toast-close" aria-label="Close">x</button></div></template>')
  toast('Saved')
  expect(item().querySelector('.mine')).not.toBeNull()
  expect(item().querySelector('[data-part="toast-message"]')!.textContent).toBe('Saved')
  expect(item().querySelector('[data-part="toast-action"]')).toBeNull()
  ;(item().querySelector('[data-part="toast-close"]') as HTMLElement).click()
  expect(document.querySelector('[data-part="toast"]')).toBeNull()
})

test("toast templates: a kind's template wins for that kind only; its own icon stays", async () => {
  const toast = await region('<template data-type="toast"><div class="general"><p data-part="toast-message"></p></div></template><template data-type="error"><div class="err"><span data-part="toast-icon">!</span><p data-part="toast-message"></p></div></template>')
  toast('Bad', { type: 'error' })
  toast('Fine', { type: 'success' })
  const [bad, fine] = [...document.querySelectorAll('[data-part="toast"]')] as HTMLElement[]
  expect(bad!.querySelector('.err')).not.toBeNull()
  expect(bad!.querySelector('[data-part="toast-icon"]')!.textContent).toBe('!')
  expect(fine!.querySelector('.general')).not.toBeNull()
})

test('toast: the message is text, never markup; icon: false leaves the icon out', async () => {
  const toast = await region()
  toast('<img src=x onerror=alert(1)>', { type: 'info', icon: false })
  expect(item().querySelector('img')).toBeNull()
  expect(item().querySelector('[data-part="toast-message"]')!.textContent).toBe('<img src=x onerror=alert(1)>')
  expect(item().querySelector('[data-part="toast-icon"] svg')).toBeNull()
})
