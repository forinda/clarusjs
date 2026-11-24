import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { compile } from 'clarusjs/compiler'
import { expect, test } from 'vitest'
import { registry } from '../src/registry.ts'
import { registryDir, render, source } from './render.ts'
import { globalStyle, uiSection } from './css.ts'

const page = (name: string) => resolve(import.meta.dirname, '../src/pages/components', `${name}.md`)
const files = registry.flatMap((e) => e.files.map((f) => ({ entry: e, file: `${e.name}/${f}` })))

test('every entry\'s files exist, and every registry folder has an entry', () => {
  for (const { file } of files) expect(existsSync(resolve(registryDir, file)), file).toBe(true)
  expect(readdirSync(registryDir).sort()).toEqual(registry.map((e) => e.name).sort())
})

test('every entry has a page at src/pages/components/<name>.md that shows each of its files with <<<', () => {
  for (const e of registry) {
    const md = readFileSync(page(e.name), 'utf8')
    for (const f of e.files) expect(md, `${e.name}: ${f}`).toMatch(new RegExp(`^<<< \\.\\./\\.\\./registry/${e.name}/${f.replace('.', '\\.')}`, 'm'))
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
    if (entry.island) continue
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
    expect(await render('button/button.tscl', { variant }, { default: 'Save' })).toBe(`<button type="button" data-part="button" data-variant="${variant}" data-size="md">Save</button>`)
  }
  for (const size of ['sm', 'md', 'lg']) expect(await render('button/button.tscl', { size }, { default: 'x' })).toContain(`data-size="${size}"`)
  expect(await render('button/button.tscl', { type: 'submit' }, { default: 'Send' })).toContain('type="submit"')
  // Attributes it doesn't declare land on the <button> (#463).
  const pressed = await render('button/button.tscl', { 'aria-pressed': 'true', disabled: true }, { default: 'B' })
  expect(pressed).toMatch(/<button [^>]*aria-pressed="true"/)
  expect(pressed).toMatch(/<button [^>]* disabled[ >]/)
})

test('input: a native <input> with data-part="input", type defaults to text, aria-invalid passes through', async () => {
  expect(await render('input/input.tscl', { id: 'email' })).toBe('<input type="text" data-part="input" id="email">')
  expect(await render('input/input.tscl', { type: 'email', 'aria-invalid': 'true' })).toMatch(/^<input [^>]*type="email"[^>]*aria-invalid="true"|^<input [^>]*aria-invalid="true"[^>]*type="email"/)
})

test('textarea: a native <textarea>, rows defaults to 3', async () => {
  expect(await render('textarea/textarea.tscl', { id: 'bio' })).toBe('<textarea rows="3" data-part="textarea" id="bio"></textarea>')
  expect(await render('textarea/textarea.tscl', { rows: 6 })).toContain('rows="6"')
})

test('label: a native <label>; control names the field it labels (for)', async () => {
  expect(await render('label/label.tscl', { control: 'email' }, { default: 'Email' })).toBe('<label for="email" data-part="label">Email</label>')
  expect(await render('label/label.tscl', {}, { default: 'Email' })).toBe('<label data-part="label">Email</label>')
})

test('card: an <article>; header, body and footer in order, and an unfilled header or footer is hidden', async () => {
  expect(await render('card/card.tscl', {}, { header: '<h3>Plan</h3>', default: '<p>Body</p>', footer: '<p>Foot</p>' }))
    .toBe('<article data-part="card"><header data-part="card-header"><h3>Plan</h3></header><div data-part="card-body"><p>Body</p></div><footer data-part="card-footer"><p>Foot</p></footer></article>')
  expect(await render('card/card.tscl', {}, { default: 'x' })).toContain('<header data-part="card-header"></header>')
  expect(source('card/card.tscl')).toMatch(/\[data-part='card-header'\]:empty,\s*\[data-part='card-footer'\]:empty\s*\{\s*display: none/)
})

test('badge: variants default, secondary, outline, destructive as data-variant on a <span>', async () => {
  for (const variant of ['default', 'secondary', 'outline', 'destructive']) {
    expect(await render('badge/badge.tscl', { variant }, { default: 'New' })).toBe(`<span data-part="badge" data-variant="${variant}">New</span>`)
  }
})

test('alert: role="alert" only with [live]="true"; variants default, destructive; a title slot as <p data-part="title">', async () => {
  expect(await render('alert/alert.tscl', {}, { title: 'Heads up', default: 'Saved.' })).toBe('<div data-part="alert" data-variant="default"><p data-part="title">Heads up</p><div data-part="description">Saved.</div></div>')
  expect(await render('alert/alert.tscl', { live: true, variant: 'destructive' }, { default: 'Failed.' })).toMatch(/^<div role="alert" data-part="alert" data-variant="destructive">|^<div data-part="alert" data-variant="destructive" role="alert">/)
})

test('separator: role="separator" with aria-orientation; [decorative]="true" renders role="none"', async () => {
  expect(await render('separator/separator.tscl')).toBe('<div role="separator" aria-orientation="horizontal" data-part="separator" data-orientation="horizontal"></div>')
  expect(await render('separator/separator.tscl', { orientation: 'vertical' })).toContain('aria-orientation="vertical"')
  expect(await render('separator/separator.tscl', { decorative: true })).toBe('<div role="none" data-part="separator" data-orientation="horizontal"></div>')
})

test('skeleton: aria-hidden="true", its width and height as --ui-skeleton-* custom properties', async () => {
  expect(await render('skeleton/skeleton.tscl', { width: '120px', height: '16px' })).toBe('<div aria-hidden="true" data-part="skeleton" style="--ui-skeleton-w: 120px; --ui-skeleton-h: 16px"></div>')
})

test('avatar: an <img> with alt when src is given, else the initials from [fallback] in a role="img" <span> named by alt', async () => {
  expect(await render('avatar/avatar.tscl', { src: '/ada.png', alt: 'Ada Lovelace' })).toBe('<span data-part="avatar"><img src="/ada.png" alt="Ada Lovelace" data-part="avatar-image"></span>')
  expect(await render('avatar/avatar.tscl', { alt: 'Ada Lovelace', fallback: 'AL' })).toBe('<span data-part="avatar"><span role="img" aria-label="Ada Lovelace" data-part="avatar-fallback">AL</span></span>')
})

test('kbd: a <kbd>', async () => {
  expect(await render('kbd/kbd.tscl', {}, { default: 'Ctrl' })).toBe('<kbd data-part="kbd">Ctrl</kbd>')
})

test('table: a <table> in a scrolling region that is focusable and named; caption renders <caption>', async () => {
  expect(await render('table/table.tscl', { caption: 'Invoices' }, { default: '<tr><td>1</td></tr>' }))
    .toBe('<div role="region" aria-label="Invoices" tabindex="0" data-part="table-scroll"><table data-part="table"><caption>Invoices</caption><tr><td>1</td></tr></table></div>')
  expect(await render('table/table.tscl', { label: 'Orders' }, { default: '' })).toBe('<div role="region" aria-label="Orders" tabindex="0" data-part="table-scroll"><table data-part="table"></table></div>')
})

test('a styled part\'s <style global> equals ui.css\'s sections for it, in order', () => {
  const styled = registry.filter((e) => e.sections?.length)
  expect(styled.map((e) => e.name)).toEqual(expect.arrayContaining(['accordion', 'checkbox', 'switch', 'radio-group', 'field']))
  for (const e of styled) expect(globalStyle(source(`${e.name}/${e.files[0]}`)), e.name).toBe(e.sections!.map(uiSection).join(' '))
})
