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

// A page made of several parts: every module written to a temp folder, its ./x.tscl imports pointing at the others.
async function renderPage(page: string, parts: string[]): Promise<string> {
  const { mkdirSync, mkdtempSync, writeFileSync } = await import('node:fs')
  mkdirSync(resolve(import.meta.dirname, '.tmp'), { recursive: true })
  const dir = mkdtempSync(resolve(import.meta.dirname, '.tmp/page-'))
  const fix = (code: string) => code.replaceAll("'clarusjs/runtime/server'", `'${runtime}'`).replaceAll("'clarusjs/runtime'", `'${clarus('runtime/index.ts')}'`)
    .replaceAll("'@clarusjs/ui-primitives'", `'${pathToFileURL(resolve(import.meta.dirname, '../src/index.js')).href}'`)
    .replace(/from '\.\/([\w-]+)\.tscl'/g, (_, f) => `from './${f}.mjs'`)
  const server = (source: string, file: string) => compile(source, { file, target: 'server', clientUrl: `/${file}.js`, collapseWhitespace: true }).code
  for (const name of parts) writeFileSync(resolve(dir, `${name}.mjs`), fix(server(part(name), `${name}.tscl`)))
  writeFileSync(resolve(dir, 'page.mjs'), fix(server(page, 'page.tscl')))
  const mod = await import(pathToFileURL(resolve(dir, 'page.mjs')).href)
  return unscoped(await mod.render({}))
}

test('tabs: Radix-shaped, on context; the server writes every ARIA attribute and hidden; only the root is an island', async () => {
  const page = `@import tabs from './tabs.tscl'
@import tabList from './tab-list.tscl'
@import tab from './tab.tscl'
@import tabPanel from './tab-panel.tscl'
<tabs id="install" label="Install" value="pnpm">
  <tabList><tab value="npm">npm</tab><tab value="pnpm">pnpm</tab></tabList>
  <tabPanel value="npm">a</tabPanel><tabPanel value="pnpm">b</tabPanel>
</tabs>
`
  const tab = (v: string, on: boolean) => `<button type="button" role="tab" id="install-tab-${v}" aria-controls="install-panel-${v}" aria-selected="${on}" tabindex="${on ? 0 : -1}" data-value="${v}" data-part="tab">${v}</button>`
  const panel = (v: string, text: string, on: boolean) => `<div role="tabpanel" id="install-panel-${v}" aria-labelledby="install-tab-${v}" tabindex="0"${on ? '' : ' hidden'} data-part="panel">${text}</div>`
  expect(await renderPage(page, ['tabs', 'tab-list', 'tab', 'tab-panel'])).toBe('<div data-part="tabs"><div role="tablist" aria-label="Install" data-part="list">'
    + tab('npm', false) + tab('pnpm', true) + '</div>' + panel('npm', 'a', false) + panel('pnpm', 'b', true) + '</div>')
  expect(statefulOf('tabs')).toBe(true)
  for (const p of ['tab-list', 'tab', 'tab-panel']) expect(statefulOf(p)).toBe(false)
})

test('radio group: native radios in a fieldset, named and checked from context; only the group is an island', async () => {
  const page = `@import radioGroup from './radio-group.tscl'
@import radio from './radio.tscl'
<radioGroup name="size" label="Size" value="m">
  <radio value="s" label="Small" /><radio value="m" label="Medium" /><radio value="l" label="Large" [disabled]="true" />
</radioGroup>
`
  const radio = (v: string, label: string, on: boolean, off = false) => `<label data-part="radio"${on ? ' data-checked=""' : ''}${off ? ' data-disabled=""' : ''}><input type="radio" name="size"${off ? ' disabled' : ''} value="${v}"${on ? ' checked' : ''}><span data-part="label">${label}</span></label>`
  expect(await renderPage(page, ['radio-group', 'radio'])).toBe('<fieldset data-part="radio-group"><legend data-part="legend">Size</legend>'
    + radio('s', 'Small', false) + radio('m', 'Medium', true) + radio('l', 'Large', false, true) + '</fieldset>')
  expect(statefulOf('radio-group')).toBe(true)
  expect(statefulOf('radio')).toBe(false)
})
