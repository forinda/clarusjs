import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { compile } from 'clarusjs/compiler'
import { expect, test } from 'vitest'
import { registry } from '../src/registry.ts'
import { registryDir, render, source } from './render.ts'
import { globalStyle, uiSection } from './css.ts'

const page = (name: string) => resolve(import.meta.dirname, '../src/pages/components', `${name}.md`)
const files = registry.flatMap((e) => e.files.map((f) => ({ entry: e, file: f })))

test('every entry\'s files exist, and every file in src/registry is an entry\'s file or usage example', () => {
  for (const { file } of files) expect(existsSync(resolve(registryDir, file)), file).toBe(true)
  const known = [...files.map((f) => f.file), ...registry.map((e) => `${e.name}-demo.tscl`)].sort()
  expect(readdirSync(registryDir).sort()).toEqual(known)
})

test('every entry has a page at src/pages/components/<name>.md that shows each of its files with <<<', () => {
  for (const e of registry) {
    const md = readFileSync(page(e.name), 'utf8')
    for (const f of e.files) expect(md, `${e.name}: ${f}`).toMatch(new RegExp(`^<<< \\.\\./\\.\\./registry/${f.replace('.', '\\.')}`, 'm'))
  }
})

test('copied files import only ui-primitives, clarusjs and the entries they list in uses', () => {
  for (const { entry, file } of files) {
    const specifiers = [...source(file).matchAll(/(?:@import|^\s*import)\s[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]!)
    for (const s of specifiers) {
      const local = /^\.\/([a-z-]+)\.tscl$/.exec(s)?.[1]
      const ok = /^@clarusjs\/ui-primitives\//.test(s) || /^clarusjs(\/|$)/.test(s) || (!!local && (entry.uses.includes(local) || entry.files.includes(`${local}.tscl`)))
      expect(ok, `${file} imports ${s}`).toBe(true)
    }
  }
})

test('entries with island: false compile to no client code', () => {
  for (const { entry, file } of files) {
    if (entry.island || !file.endsWith('.tscl')) continue
    expect(compile(source(file), { file, target: 'client' }).code.trim(), file).toBe('export {}')
  }
})

test('styles use only --ui-* custom properties', () => {
  for (const { file } of files) {
    for (const [, name] of source(file).matchAll(/var\(--([\w-]+)/g)) expect(name, file).toMatch(/^ui-/)
  }
})

test('button: variants default, secondary, outline, ghost, destructive, link; sizes sm, md, lg', async () => {
  for (const variant of ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link']) {
    expect(await render('button.tscl', { variant }, { default: 'Save' })).toBe(`<button type="button" data-part="button" data-variant="${variant}" data-size="md">Save</button>`)
  }
  for (const size of ['sm', 'md', 'lg']) expect(await render('button.tscl', { size }, { default: 'x' })).toContain(`data-size="${size}"`)
  expect(await render('button.tscl', { type: 'submit' }, { default: 'Send' })).toContain('type="submit"')
  // Attributes it doesn't declare land on the <button> (#463).
  const pressed = await render('button.tscl', { 'aria-pressed': 'true', disabled: true }, { default: 'B' })
  expect(pressed).toMatch(/<button [^>]*aria-pressed="true"/)
  expect(pressed).toMatch(/<button [^>]* disabled[ >]/)
})

test('input: a native <input> with data-part="text-input", type defaults to text, aria-invalid passes through', async () => {
  expect(await render('input.tscl', { id: 'email' })).toBe('<input type="text" data-part="text-input" id="email">')
  expect(await render('input.tscl', { type: 'email', 'aria-invalid': 'true' })).toMatch(/^<input [^>]*type="email"[^>]*aria-invalid="true"|^<input [^>]*aria-invalid="true"[^>]*type="email"/)
})

test('textarea: a native <textarea>, rows defaults to 3', async () => {
  expect(await render('textarea.tscl', { id: 'bio' })).toBe('<textarea rows="3" data-part="textarea" id="bio"></textarea>')
  expect(await render('textarea.tscl', { rows: 6 })).toContain('rows="6"')
})

test('label: a native <label>; control names the field it labels (for)', async () => {
  expect(await render('label.tscl', { control: 'email' }, { default: 'Email' })).toBe('<label for="email" data-part="form-label">Email</label>')
  expect(await render('label.tscl', {}, { default: 'Email' })).toBe('<label data-part="form-label">Email</label>')
})

test('card: an <article>; header, body and footer in order, and an unfilled header or footer is hidden', async () => {
  expect(await render('card.tscl', {}, { header: '<h3>Plan</h3>', default: '<p>Body</p>', footer: '<p>Foot</p>' }))
    .toBe('<article data-part="card"><header data-part="card-header"><h3>Plan</h3></header><div data-part="card-body"><p>Body</p></div><footer data-part="card-footer"><p>Foot</p></footer></article>')
  expect(await render('card.tscl', {}, { default: 'x' })).toContain('<header data-part="card-header"></header>')
  expect(source('card.tscl')).toMatch(/\[data-part='card-header'\]:empty,\s*\[data-part='card-footer'\]:empty\s*\{\s*display: none/)
})

test('badge: variants default, secondary, outline, destructive as data-variant on a <span>', async () => {
  for (const variant of ['default', 'secondary', 'outline', 'destructive']) {
    expect(await render('badge.tscl', { variant }, { default: 'New' })).toBe(`<span data-part="badge" data-variant="${variant}">New</span>`)
  }
})

test('alert: role="alert" only with [live]="true"; variants default, destructive; a title slot as <p data-part="alert-title">', async () => {
  expect(await render('alert.tscl', {}, { title: 'Heads up', default: 'Saved.' })).toBe('<div data-part="alert" data-variant="default"><p data-part="alert-title">Heads up</p><div data-part="alert-description">Saved.</div></div>')
  expect(await render('alert.tscl', { live: true, variant: 'destructive' }, { default: 'Failed.' })).toMatch(/^<div role="alert" data-part="alert" data-variant="destructive">|^<div data-part="alert" data-variant="destructive" role="alert">/)
})

test('separator: role="separator" with aria-orientation; [decorative]="true" renders role="none"', async () => {
  expect(await render('separator.tscl')).toBe('<div role="separator" aria-orientation="horizontal" data-part="separator" data-orientation="horizontal"></div>')
  expect(await render('separator.tscl', { orientation: 'vertical' })).toContain('aria-orientation="vertical"')
  expect(await render('separator.tscl', { decorative: true })).toBe('<div role="none" data-part="separator" data-orientation="horizontal"></div>')
})

test('skeleton: aria-hidden="true", its width and height as --ui-skeleton-* custom properties', async () => {
  expect(await render('skeleton.tscl', { width: '120px', height: '16px' })).toBe('<div aria-hidden="true" data-part="skeleton" style="--ui-skeleton-w: 120px; --ui-skeleton-h: 16px"></div>')
})

test('avatar: an <img> with alt when src is given, else the initials from [fallback] in a role="img" <span> named by alt', async () => {
  expect(await render('avatar.tscl', { src: '/ada.png', alt: 'Ada Lovelace' })).toBe('<span data-part="avatar"><img src="/ada.png" alt="Ada Lovelace" data-part="avatar-image"></span>')
  expect(await render('avatar.tscl', { alt: 'Ada Lovelace', fallback: 'AL' })).toBe('<span data-part="avatar"><span role="img" aria-label="Ada Lovelace" data-part="avatar-fallback">AL</span></span>')
})

test('kbd: a <kbd>', async () => {
  expect(await render('kbd.tscl', {}, { default: 'Ctrl' })).toBe('<kbd data-part="kbd">Ctrl</kbd>')
})

test('table: a <table> in a scrolling region that is focusable and named; caption renders <caption>', async () => {
  expect(await render('table.tscl', { caption: 'Invoices' }, { default: '<tr><td>1</td></tr>' }))
    .toBe('<div role="region" aria-label="Invoices" tabindex="0" data-part="table-scroll"><table data-part="table"><caption>Invoices</caption><tr><td>1</td></tr></table></div>')
  expect(await render('table.tscl', { label: 'Orders' }, { default: '' })).toBe('<div role="region" aria-label="Orders" tabindex="0" data-part="table-scroll"><table data-part="table"></table></div>')
})

test('a styled part\'s <style global> equals ui.css\'s sections for it, in order', () => {
  const styled = registry.filter((e) => e.sections?.length)
  expect(styled.map((e) => e.name)).toEqual(expect.arrayContaining(['accordion', 'checkbox', 'switch', 'radio-group', 'field', 'dialog', 'popover', 'tooltip', 'menu', 'tabs', 'select', 'combobox']))
  for (const e of styled) expect(globalStyle(source(e.files[0]!), e.files[0]), e.name).toBe(e.sections!.map(uiSection).join(' '))
})

test('#review: a no-JavaScript component\'s data-part names are its own, never ones ui.css styles globally', () => {
  const styled = new Set([...readFileSync(resolve(import.meta.dirname, '../../ui/src/ui.css'), 'utf8').matchAll(/data-part='([\w-]+)'/g)].map((m) => m[1]!))
  for (const { entry, file } of files) {
    if (entry.sections || !file.endsWith('.tscl')) continue
    for (const [, part] of source(file).matchAll(/data-part="([\w-]+)"/g)) expect(styled.has(part!), `${file}: data-part="${part}"`).toBe(false)
  }
})

test('#review: each usage example sits next to its component and imports only what works once pasted, all listed in Needs', () => {
  for (const e of registry) {
    const demo = readFileSync(resolve(registryDir, `${e.name}-demo.tscl`), 'utf8')
    for (const [, s] of demo.matchAll(/@import\s+(?:[\w$]+\s+from\s+)?'([^']+)'/g)) {
      const local = /^\.\/([a-z-]+)\.(tscl|css)$/.exec(s!)
      const ok = /^@clarusjs\/ui-primitives\//.test(s!) || /^clarusjs(\/|$)/.test(s!)
        || (!!local && (e.files.includes(`${local[1]}.${local[2]}`) || [...e.uses, ...(e.example ?? [])].includes(local[1]!)))
      expect(ok, `${e.name}-demo.tscl imports ${s}`).toBe(true)
    }
  }
})

test('#review: a table with neither label nor caption is no nameless region (still focusable, to scroll)', async () => {
  expect(await render('table.tscl', {}, { default: '<tr><td>1</td></tr>' })).toBe('<div tabindex="0" data-part="table-scroll"><table data-part="table"><tr><td>1</td></tr></table></div>')
})

const scoped = (file: string) => /<style scoped>([\s\S]*?)<\/style>/.exec(source(file))?.[1] ?? ''

test('#tokens: components use the token for their role', () => {
  expect(scoped('card.tscl')).toMatch(/background: var\(--ui-card\)/)
  expect(scoped('card.tscl')).toMatch(/color: var\(--ui-card-fg\)/)
  expect(scoped('button.tscl')).toMatch(/\[data-variant='secondary'\][^}]*background: var\(--ui-secondary\);[^}]*color: var\(--ui-secondary-fg\)/)
  expect(scoped('button.tscl')).toMatch(/\[data-variant='destructive'\][^}]*color: var\(--ui-danger-fg\)/)
  expect(scoped('badge.tscl')).toMatch(/\[data-variant='destructive'\][^}]*color: var\(--ui-danger-fg\)/)
  for (const f of ['input.tscl', 'textarea.tscl']) expect(scoped(f), f).toMatch(/border: 1px solid var\(--ui-input\)/)
  expect(scoped('skeleton.tscl')).toContain('var(--ui-muted-bg)')
  expect(scoped('table.tscl')).toContain('var(--ui-card)')
  expect(scoped('kbd.tscl')).toContain('var(--ui-font-mono)')
  for (const e of registry) for (const f of e.files.filter((x) => x.endsWith('.tscl'))) {
    for (const [, o] of scoped(f).matchAll(/outline:\s*([^;]+);/g)) if (o !== 'none') expect(o, f).toContain('var(--ui-ring)')
  }
})

test('#tokens: text sizes scale from --ui-font-size', () => {
  for (const e of registry) for (const f of e.files.filter((x) => x.endsWith('.tscl'))) {
    const css = scoped(f)
    for (const [, v] of css.matchAll(/font-size:\s*([^;]+);/g)) expect(v, f).toMatch(/var\(--ui-font-size\)|^inherit$/)
    for (const [, v] of css.matchAll(/(?<![-\w])font:\s*([^;]+);/g)) expect(v, f).toMatch(/var\(--ui-font-size\)|^inherit$/)
  }
})

test('badge and alert: success and warning variants', async () => {
  for (const variant of ['success', 'warning']) {
    expect(await render('badge.tscl', { variant }, { default: 'x' })).toContain(`data-variant="${variant}"`)
    expect(await render('alert.tscl', { variant }, { default: 'x' })).toContain(`data-variant="${variant}"`)
    for (const f of ['badge.tscl', 'alert.tscl']) expect(scoped(f), f).toMatch(new RegExp(`\\[data-variant='${variant}'\\][^}]*var\\(--ui-${variant}`))
  }
  expect(scoped('badge.tscl')).toMatch(/\[data-variant='success'\][^}]*color: var\(--ui-success-fg\)/)
})
