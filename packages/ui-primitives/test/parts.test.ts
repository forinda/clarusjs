// @vitest-environment happy-dom
// #465 parts, native-first: the server renders the platform's own elements and attributes (dialog with command
// invokers, popover with anchor positioning, details name), so they work without JavaScript; ARIA and state attributes
// are in the HTML. Form controls are small islands (@model).
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { compile } from 'clarusjs/compiler'
import { expect, test } from 'vitest'

const part = (name: string) => readFileSync(resolve(import.meta.dirname, '../src', `${name}.tscl`), 'utf8')
// The HTML without what clarusjs adds for itself: scope classes, island wrappers, markers.
const unscoped = (html: string) => html.replace(/ class="cl-c-[\w-]+"/g, '').replace(/ cl-c-[\w-]+(?=[" ])/g, '')
  .replace(/<\/?cl-island[^>]*>/g, '').replace(/<!--[^>]*-->/g, '').replace(/ data-cl-[\w-]+="[^"]*"/g, '')
  .replace(/>\s+/g, '>').replace(/\s+</g, '<')
const clarus = (path: string) => pathToFileURL(resolve(import.meta.dirname, '../node_modules/clarusjs/src', path)).href
const runtime = clarus('runtime/server.ts')
async function render(name: string, props: Record<string, unknown>, slots?: Record<string, string>): Promise<string> {
  const { code, stateful } = compile(part(name), { file: `${name}.tscl`, target: 'server', clientUrl: `/${name}.js`, collapseWhitespace: true })
  const mod = await import(`data:text/javascript,${encodeURIComponent(code.replaceAll("'clarusjs/runtime/server'", `'${runtime}'`).replaceAll("'clarusjs/fetch'", `'${clarus('fetch/index.ts')}'`).replaceAll("'clarusjs/runtime'", `'${clarus('runtime/index.ts')}'`).replaceAll("'@clarusjs/ui-primitives'", `'${pathToFileURL(resolve(import.meta.dirname, '../src/index.js')).href}'`))}`)
  void stateful
  return unscoped(await mod.render(props, slots))
}
const statefulOf = (name: string) => compile(part(name), { file: `${name}.tscl`, target: 'client' }).stateful

test('dialog: a native <dialog>, labelled by its title; its trigger and close are command invokers (no JavaScript)', async () => {
  const html = await render('dialog', { id: 'd' }, { title: 'Delete file?', default: '<p>Gone for good.</p>' })
  expect(html).toBe('<dialog id="d" aria-labelledby="d-title" closedby="any" data-part="dialog"><h2 id="d-title" data-part="title">Delete file?</h2><p>Gone for good.</p></dialog>')
  expect(await render('dialog-trigger', { target: 'd' }, { default: 'Delete' })).toBe('<button type="button" commandfor="d" command="show-modal" aria-haspopup="dialog" data-part="trigger">Delete</button>')
  expect(await render('dialog-close', { target: 'd' }, { default: 'Cancel' })).toBe('<button type="button" commandfor="d" command="close" data-part="close">Cancel</button>')
  expect(await render('dialog', { id: 'd', dismissible: false }, { title: 't' })).toContain('closedby="closerequest"')
  for (const p of ['dialog', 'dialog-trigger', 'dialog-close']) expect(statefulOf(p)).toBe(false) // nothing ships
})

test('popover: the popover attribute, anchored to its trigger with CSS anchor positioning; side and align as data-', async () => {
  const pop = await render('popover', { id: 'p', side: 'top', align: 'start' }, { default: 'Hi' })
  expect(pop).toBe('<div id="p" popover="auto" data-part="popover" data-side="top" data-align="start" style="position-anchor: --p; position-area: top span-right; position-try-fallbacks: flip-block, flip-inline">Hi</div>')
  expect(await render('popover-trigger', { target: 'p' }, { default: 'Open' })).toBe('<button type="button" popovertarget="p" style="anchor-name: --p" data-part="trigger">Open</button>')
  expect(await render('popover', { id: 'p' }, { default: 'x' })).toContain('position-area: bottom;')
  expect(statefulOf('popover')).toBe(false)
})

test('accordion item: <details>, one open at a time in a named group', async () => {
  const html = await render('accordion-item', { group: 'faq', open: true }, { trigger: 'Why?', default: 'Because.' })
  expect(html).toBe('<details name="faq" open data-part="accordion-item"><summary data-part="trigger">Why?</summary><div data-part="panel">Because.</div></details>')
  expect(await render('accordion-item', {}, { trigger: 'a', default: 'b' })).toBe('<details data-part="accordion-item"><summary data-part="trigger">a</summary><div data-part="panel">b</div></details>')
})

test('switch and checkbox: native inputs in a label, state as data- attributes, two-way with [(checked)] (islands)', async () => {
  const sw = await render('switch', { label: 'Wi-Fi', checked: true, name: 'wifi' })
  expect(sw).toMatch(/<label data-part="switch" data-checked=""><input type="checkbox" role="switch" name="wifi" checked[^>]*><span data-part="label">Wi-Fi<\/span><\/label>/)
  const cb = await render('checkbox', { label: 'Terms', disabled: true })
  expect(cb).toMatch(/<label data-part="checkbox" data-disabled=""><input type="checkbox" disabled[^>]*><span data-part="label">Terms<\/span><\/label>/)
  expect(statefulOf('switch')).toBe(true)
})

test('field: label, control, description and error wired by id; the error shows once touched (or [show])', async () => {
  const quiet = await render('field', { id: 'email', label: 'Email', description: 'We never share it.', error: 'Required' })
  expect(quiet).toContain('<label for="email" data-part="label">Email</label>')
  expect(quiet).toMatch(/<input id="email" type="text"[^>]* aria-describedby="email-description"/)
  expect(quiet).not.toContain('Required') // not touched yet
  const shown = await render('field', { id: 'email', label: 'Email', error: 'Required', show: true })
  expect(shown).toContain('data-invalid')
  expect(shown).toMatch(/aria-invalid="true"/)
  expect(shown).toMatch(/aria-describedby="email-error"/)
  expect(shown).toContain('<p id="email-error" data-part="error" role="alert">Required</p>')
})

test('every part type-checks and lints clean (clarusjs check --strict, as a project of them)', async () => {
  const { check } = await import(pathToFileURL(resolve(import.meta.dirname, '../node_modules/clarusjs/src/cli/check.ts')).href)
  const { cpSync, mkdirSync, mkdtempSync, readdirSync, symlinkSync, writeFileSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const root = mkdtempSync(resolve(tmpdir(), 'ui-parts-'))
  mkdirSync(resolve(root, 'src/components'), { recursive: true })
  writeFileSync(resolve(root, 'package.json'), '{}')
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '../node_modules/clarusjs'), resolve(root, 'node_modules/clarusjs'), 'junction') // the combobox imports clarusjs/fetch
  mkdirSync(resolve(root, 'node_modules/@clarusjs'))
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/@clarusjs/ui-primitives'), 'junction') // tabs import its behaviours
  for (const f of readdirSync(resolve(import.meta.dirname, '../src')).filter((f: string) => f.endsWith('.tscl'))) {
    cpSync(resolve(import.meta.dirname, '../src', f), resolve(root, 'src/components', f))
  }
  const typescript = resolve(import.meta.dirname, '../node_modules/typescript')
  const result = check({ root, typescript, strict: true })
  expect(result.diagnostics).toEqual([])
}, 60_000)

test('select: a native <select> (customizable with appearance: base-select where supported), labelled, [(value)]', async () => {
  const options = [{ value: 's', label: 'Small' }, { value: 'm', label: 'Medium', disabled: true }]
  const html = await render('select', { id: 'size', label: 'Size', options, value: 's', placeholder: 'Pick a size' })
  expect(html).toContain('<label for="size" data-part="label">Size</label>')
  expect(html).toMatch(/<select id="size"[^>]*data-part="control"/)
  expect(html).toContain('<option disabled value="">Pick a size</option>')
  expect(html).toContain('<option data-part="option" value="s" selected>Small</option>')
  expect(html).toContain('<option disabled data-part="option" value="m">Medium</option>')
  expect(statefulOf('select')).toBe(true)
  expect(compile(part('select'), { file: 'select.tscl', target: 'client' }).css).toContain('base-select')
})

test('combobox: headless, data-part on each element and data-highlighted on the active option', async () => {
  const html = await render('combobox', { id: 'c', label: 'Fruit', options: [{ value: 'a', label: 'Apple' }] })
  for (const p of ['combobox', 'label', 'control', 'input', 'listbox', 'option', 'status']) expect(html).toContain(`data-part="${p}"`)
  expect(html).toContain('role="combobox"')
})

test('tabs: the tab list is an island; each panel is server HTML with its ARIA and hidden (no jump, nothing ships)', async () => {
  const panel = (index: number, selected?: number) => render('tab-panel', { group: 'i', index, ...(selected !== undefined && { selected }) }, { default: `p${index}` })
  expect(await panel(0)).toBe('<div role="tabpanel" id="i-panel-0" aria-labelledby="i-tab-0" tabindex="0" data-part="panel">p0</div>')
  expect(await panel(1)).toBe('<div role="tabpanel" id="i-panel-1" aria-labelledby="i-tab-1" tabindex="0" hidden data-part="panel">p1</div>')
  expect(await panel(1, 1)).not.toContain('hidden')
  expect(statefulOf('tab-panel')).toBe(false)
  const tabs = await render('tabs', { id: 'i', label: 'Install', tabs: ['npm', 'pnpm'], value: 1 }, { default: '<p>panels</p>' })
  expect(tabs).toBe('<div data-part="tabs"><div role="tablist" aria-label="Install" data-part="list">'
    + '<button type="button" role="tab" id="i-tab-0" aria-controls="i-panel-0" aria-selected="false" tabindex="-1" data-part="tab">npm</button>'
    + '<button type="button" role="tab" id="i-tab-1" aria-controls="i-panel-1" aria-selected="true" tabindex="0" data-part="tab">pnpm</button>'
    + '</div><p>panels</p></div>')
  expect(statefulOf('tabs')).toBe(true)
})
