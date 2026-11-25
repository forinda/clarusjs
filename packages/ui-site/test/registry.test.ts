import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { compile } from 'clarusjs/compiler'
import { expect, test } from 'vitest'
import { COMPONENT_GROUPS, blocks, codeFiles, components, registry } from '../src/registry.ts'
import { registryDir, render, source } from './render.ts'
import { globalStyle, uiSection } from './css.ts'

const pages = resolve(import.meta.dirname, '../src/pages')
const page = (name: string) => resolve(pages, 'components', `${name}.md`)
const files = registry.flatMap((e) => e.files.map((f) => ({ entry: e, file: f })))

test('blocks: registry entries of their own kind, apart from the components', () => {
  expect(blocks.map((b) => b.name)).toContain('login')
  expect(components.every((e) => e.kind !== 'block')).toBe(true)
  expect(blocks.every((e) => e.kind === 'block')).toBe(true)
  expect(components.length + blocks.length).toBe(registry.length)
})

test('every entry\'s files exist, and every file in src/registry is an entry\'s file or usage example', () => {
  for (const { file } of files) expect(existsSync(resolve(registryDir, file)), file).toBe(true)
  const known = [...files.map((f) => f.file), ...components.flatMap((e) => [`${e.name}-demo.tscl`, ...(e.examples ?? []).map((x) => `${e.name}-${x}-demo.tscl`)])].sort()
  const found = (readdirSync(registryDir, { recursive: true }) as string[]).map((f) => f.replaceAll('\\', '/')).filter((f) => statSync(resolve(registryDir, f)).isFile())
  expect(found.sort()).toEqual(known)
})

test('every component has a page at src/pages/components/<name>.md that shows each of its files with <<<', () => {
  for (const e of components) {
    const md = readFileSync(page(e.name), 'utf8')
    for (const f of e.files) expect(md, `${e.name}: ${f}`).toMatch(new RegExp(`^<<< \\.\\./\\.\\./registry/${f.replace('.', '\\.')}`, 'm'))
  }
})

test('every block has a page at src/pages/blocks/<name>.md showing every file to copy, in the Code tree\'s order, and a view', () => {
  for (const e of blocks) {
    const md = readFileSync(resolve(pages, 'blocks', `${e.name}.md`), 'utf8')
    const shown = [...md.matchAll(/^<<< \.\.\/\.\.\/registry\/(\S+)/gm)].map((m) => m[1])
    expect(shown, e.name).toEqual(codeFiles(e).map((f) => f.file))
    expect(existsSync(resolve(pages, 'view', `${e.name}.tscl`)), e.name).toBe(true)
  }
})

const specifiers = (file: string) => [...source(file).matchAll(/(?:@import|^\s*import)\s[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]!)
const shared = (s: string) => /^@clarusjs\/ui-primitives(\/|$)/.test(s) || /^clarusjs(\/|$)/.test(s)

test('copied files import only ui-primitives, clarusjs, their own files and those of the entries they list in uses', () => {
  for (const { entry, file } of files) {
    if (entry.kind === 'block') continue
    for (const s of specifiers(file)) {
      // ./x: one of its own files, or of an entry it uses (chart-interactive takes chart-geometry.ts's types).
      const local = /^\.\/([\w.-]+)$/.exec(s)?.[1]
      const copied = [...entry.files, ...entry.uses.flatMap((u) => registry.find((e) => e.name === u)?.files ?? [])]
      const ok = shared(s) || (!!local && copied.includes(local))
      expect(ok, `${file} imports ${s}`).toBe(true)
    }
  }
})

test('a block imports what works once pasted: components as the ~/components/ui/ files they copy, its own files as ./, npm packages listed in packages', () => {
  for (const { entry, file } of files) {
    if (entry.kind !== 'block') continue
    const dir = file.slice(0, file.lastIndexOf('/') + 1)
    for (const s of specifiers(file)) {
      // A component's file only if it is one that gets copied (card has card.tscl, no card.css).
      const copied = /^~\/components\/ui\/([a-z-]+\.(?:tscl|css|ts))$/.exec(s)?.[1]
      const own = /^\.\/([\w.-]+)$/.exec(s)?.[1]
      const ok = shared(s) || (!!copied && codeFiles(entry).some((f) => f.path === `components/ui/${copied}`)) || (!!own && entry.files.includes(dir + own)) || (entry.packages ?? []).includes(s)
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

test('button: loading shows a spinner, marks it busy and disables it; block, shape and dashed are data attributes', async () => {
  const loading = await render('button.tscl', { loading: true }, { default: 'Save' })
  expect(loading).toMatch(/<button [^>]*aria-busy="true"/)
  expect(loading).toMatch(/<button [^>]* disabled[ >]/)
  expect(loading).toContain('<span data-part="button-spinner" aria-hidden="true"></span>Save')
  expect(await render('button.tscl', {}, { default: 'x' })).not.toContain('button-spinner')
  expect(await render('button.tscl', { block: true }, { default: 'x' })).toContain('data-block="true"')
  expect(await render('button.tscl', { shape: 'circle' }, { default: 'x' })).toContain('data-shape="circle"')
  expect(await render('button.tscl', { shape: 'round' }, { default: 'x' })).toContain('data-shape="round"')
  expect(await render('button.tscl', { variant: 'dashed' }, { default: 'x' })).toContain('data-variant="dashed"')
})

test('a component page shows each of its examples (examples: [...]) under Examples, with its code', () => {
  for (const e of components) for (const x of e.examples ?? []) {
    const md = readFileSync(page(e.name), 'utf8')
    expect(md, `${e.name}: ${x}`).toContain(`<<< ../../registry/${e.name}-${x}-demo.tscl`)
    expect(md, `${e.name}: ${x}`).toMatch(new RegExp(`^## Examples$`, 'm'))
  }
  expect(components.find((e) => e.name === 'input')!.examples).toEqual(['variants', 'sizes', 'icons', 'addons', 'states', 'password', 'clear', 'count', 'search'])
  expect(components.find((e) => e.name === 'button')!.examples).toEqual(['variants', 'sizes', 'icons', 'loading', 'shapes', 'block', 'disabled', 'actions'])
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

test('input: size sm or lg sets data-size; without it, none (a [data-size] around it decides)', async () => {
  expect(await render('input.tscl', { size: 'sm' })).toContain('data-size="sm"')
  expect(await render('input.tscl', { size: 'lg' })).toContain('data-size="lg"')
  expect(await render('input.tscl', {})).not.toContain('data-size')
})

test('input: variant filled, borderless or underlined and status warning are data attributes; outline adds none', async () => {
  for (const variant of ['filled', 'borderless', 'underlined']) expect(await render('input.tscl', { variant })).toContain(`data-variant="${variant}"`)
  expect(await render('input.tscl', { variant: 'outline' })).not.toContain('data-variant')
  expect(await render('input.tscl', { status: 'warning' })).toContain('data-status="warning"')
  expect(await render('input-group.tscl', { variant: 'filled' }, { default: '' })).toContain('data-variant="filled"')
  expect(source('input-group.tscl')).toMatch(/:has\(\[aria-invalid='true'\]\)/)
})

test('sizes: every control takes its height from --ui-control-sm|md|lg, under [data-size] on itself or around it', () => {
  for (const f of ['input.tscl', 'field.tscl', 'select.css', 'combobox.css', 'toggle.css', 'button.tscl']) {
    const css = source(f)
    expect(css, f).not.toMatch(/min-height: (30|34|36|44)px/)
    for (const size of ['sm', 'lg']) expect(css, `${f} ${size}`).toContain(`var(--ui-control-${size})`)
  }
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
  expect(source('card.tscl')).toMatch(/:where\(\[data-part='card-header'\]:empty\),\s*:where\(\[data-part='card-footer'\]:empty\)\s*\{\s*display: none/)
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
  expect(styled.map((e) => e.name)).toEqual(expect.arrayContaining(['accordion', 'checkbox', 'switch', 'radio-group', 'field', 'dialog', 'popover', 'tooltip', 'menu', 'tabs', 'select', 'combobox', 'sheet']))
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
  for (const e of components) {
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

const pageText = (name: string) => readFileSync(resolve(import.meta.dirname, '../src/pages/components', `${name}.md`), 'utf8')
const styling = (name: string) => /## Styling\n([\s\S]*?)(\n## |$)/.exec(pageText(name))?.[1] ?? ''
const tsclFiles = components.flatMap((e) => e.files.filter((f) => f.endsWith('.tscl')).map((f) => ({ e, f })))

test('#overrides: every selector in a component\'s <style scoped> has zero specificity', () => {
  for (const f of registry.flatMap((e) => e.files.filter((x) => x.endsWith('.tscl')))) {
    const css = scoped(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '')
    for (const [, list] of css.matchAll(/(?:^|[;{}])\s*([^;{}@]+?)\s*\{/g)) {
      for (const sel of list!.split(',').map((x) => x.trim())) expect(sel, `${f}: ${sel}`).toMatch(/^:where\(.*\)(::[\w-]+)?$/)
    }
  }
})

test('#overrides: class on the tag lands on the root, merged', async () => {
  for (const [f, slots] of [['button.tscl', { default: 'x' }], ['card.tscl', { default: 'x' }], ['input.tscl', undefined], ['alert.tscl', { default: 'x' }], ['table.tscl', { default: '' }]] as const) {
    const html = await render(f, {}, slots as Record<string, string> | undefined, { class: 'mine' })
    expect(/^<[^>]*class="([^"]*)"/.exec(html)?.[1]?.split(' '), f).toContain('mine')
  }
})

test('#overrides: parts spreads onto inner pieces, class and style merged', async () => {
  const attrs = { class: 'h', style: 'color: red', 'data-x': '1' }
  const cases = [['card.tscl', 'header', 'card-header', { default: 'x' }, {}], ['alert.tscl', 'title', 'alert-title', { default: 'x', title: 't' }, {}], ['table.tscl', 'table', 'table', { default: '' }, {}], ['avatar.tscl', 'fallback', 'avatar-fallback', undefined, { alt: 'A', fallback: 'A' }]] as const
  for (const [f, part, dataPart, slots, props] of cases) {
    const html = await render(f, { ...props, parts: { [part]: attrs } }, slots as Record<string, string> | undefined)
    const el = new RegExp(`<[a-z]+ [^>]*data-part="${dataPart}"[^>]*>`).exec(html)?.[0] ?? ''
    expect(el, f).toMatch(/class="[^"]*\bh\b/)
    expect(el, f).toContain('color: red')
    expect(el, f).toContain('data-x="1"')
  }
  expect(await render('card.tscl', { parts: { header: { onclick: 'x' } } }, { default: 'x' })).not.toContain('onclick')
})

test('#overrides: every <style scoped>, <style global> and copied .css puts its rules in @layer components', () => {
  for (const e of registry) for (const f of e.files) {
    const s = source(f)
    const blocks = f.endsWith('.css') ? [s.replace(/^\/\*[\s\S]*?\*\/\s*/, '')] : [...s.matchAll(/<style (?:scoped|global)>([\s\S]*?)<\/style>/g)].map((m) => m[1]!)
    for (const b of blocks) expect(b.trim(), f).toMatch(/^(\/\*[\s\S]*?\*\/\s*)?(@layer theme, base, components, utilities;\s*)?@layer components \{[\s\S]*\}$/)
  }
})

test('every component page has a Styling section naming class, style, its parts keys and data-part names', () => {
  for (const e of components) {
    const text = styling(e.name)
    expect(text, e.name).toContain('`class`')
    expect(text, e.name).toContain('`style`')
    const src = e.files.map(source).join('\n')
    for (const [, k] of src.matchAll(/parts\.(\w+)/g)) expect(text, `${e.name}: parts.${k}`).toContain(`\`${k}\``)
    for (const [, p] of src.matchAll(/data-part(?:="|=')([\w-]+)/g)) expect(text, `${e.name}: ${p}`).toContain(`\`${p}\``)
  }
})

test('every Styling section lists the component\'s state attributes', () => {
  for (const { e, f } of tsclFiles) {
    const markup = source(f).replace(/<style[\s\S]*$/, '')
    for (const [, a] of markup.matchAll(/\[?(data-(?!part\b|cl-)[\w-]+)\]?=/g)) expect(styling(e.name), `${e.name}: ${a}`).toContain(`\`${a}\``)
  }
})

test('button: with href it renders <a> with the same data attributes', async () => {
  expect(await render('button.tscl', { href: '/docs', variant: 'outline' }, { default: 'Docs' })).toBe('<a href="/docs" data-part="button" data-variant="outline" data-size="md">Docs</a>')
  expect(await render('button.tscl', {}, { default: 'Go' })).toMatch(/^<button type="button"/)
  expect(await render('button.tscl', { href: 'javascript:alert(1)' }, { default: 'x' })).toContain('href="about:invalid#unsafe"')
  expect(await render('button.tscl', { href: '/d' }, { default: 'x' }, { class: 'mine' })).toMatch(/^<a [^>]*class="[^"]*mine/)
})

test('#review: every layered block declares Tailwind\'s layer order first', () => {
  for (const e of registry) for (const f of e.files) {
    const s = source(f)
    const blocks = f.endsWith('.css') ? [s.replace(/^\/\*[\s\S]*?\*\/\s*/, '')] : [...s.matchAll(/<style (?:scoped|global)>([\s\S]*?)<\/style>/g)].map((m) => m[1]!.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''))
    for (const b of blocks) expect(b.trim(), f).toMatch(/^@layer theme, base, components, utilities;\s*@layer components \{/)
  }
})

test('progress: a native <progress> with value and max, named by label; no value is indeterminate', async () => {
  expect(await render('progress.tscl', { value: 40, label: 'Upload' })).toBe('<progress max="100" aria-label="Upload" data-part="progress" value="40"></progress>')
  expect(await render('progress.tscl', { label: 'Loading' })).toBe('<progress max="100" aria-label="Loading" data-part="progress"></progress>')
})

test('meter: a native <meter> with value, min, max, low, high, optimum', async () => {
  const html = await render('meter.tscl', { value: 0.7, low: 0.3, high: 0.8, optimum: 1, label: 'Storage' })
  expect(html).toMatch(/^<meter /)
  for (const a of ['value="0.7"', 'min="0"', 'max="1"', 'low="0.3"', 'high="0.8"', 'optimum="1"', 'aria-label="Storage"', 'data-part="meter"']) expect(html).toContain(a)
})

test('spinner: role="status" with a hidden label; the mark is aria-hidden; no spin under reduced motion', async () => {
  expect(await render('spinner.tscl')).toBe('<span role="status" data-part="spinner"><span aria-hidden="true" data-part="spinner-mark"></span><span data-part="spinner-label">Loading</span></span>')
  expect(await render('spinner.tscl', { label: 'Saving' })).toContain('>Saving</span>')
  expect(source('spinner.tscl')).toContain('prefers-reduced-motion')
})

test('slider: <input type="range"> with value, min, max, step, name, disabled', async () => {
  const html = await render('slider.tscl', { value: 30, step: 5, name: 'volume', 'aria-label': 'Volume' })
  expect(html).toMatch(/^<input type="range" /)
  for (const a of ['value="30"', 'min="0"', 'max="100"', 'step="5"', 'name="volume"', 'data-part="slider"', 'aria-label="Volume"']) expect(html).toContain(a)
  expect(await render('slider.tscl', { disabled: true })).toContain(' disabled')
})

test('breadcrumb: a labelled nav with an ordered list; the last item is the current page, not a link', async () => {
  const html = await render('breadcrumb.tscl', { items: [{ label: 'Home', href: '/' }, { label: 'Docs', href: '/docs' }, { label: 'Button' }] })
  expect(html).toMatch(/^<nav aria-label="Breadcrumb" data-part="breadcrumb"><ol/)
  expect(html).toContain('<a href="/">Home</a>')
  expect(html).toContain('<a href="/docs">Docs</a>')
  expect(html).toMatch(/<span aria-current="page"[^>]*>Button<\/span>/)
})

const pageLabels = (html: string) => [...html.matchAll(/<(?:a|span)[^>]*data-part="pagination-(?:link|current|ellipsis|prev|next)"[^>]*>([^<]*)</g)].map((m) => m[1]!.trim())

test('pagination: links from an href pattern; previous/next absent at the ends; the current page marked', async () => {
  const first = await render('pagination.tscl', { page: 1, pages: 5, href: '/blog?page={page}' })
  expect(first).toMatch(/^<nav aria-label="Pagination" data-part="pagination">/)
  expect(pageLabels(first)).toEqual(['1', '2', '3', '4', '5', 'Next'])
  expect(first).toMatch(/<span aria-current="page"[^>]*>1</)
  expect(first).toContain('href="/blog?page=2"')
  expect(first).toMatch(/<a [^>]*rel="next"/)
  const last = await render('pagination.tscl', { page: 5, pages: 5, href: '/p/{page}' })
  expect(pageLabels(last)).toEqual(['Previous', '1', '2', '3', '4', '5'])
  expect(last).toMatch(/<a [^>]*rel="prev"[^>]*href="\/p\/4"|<a [^>]*href="\/p\/4"[^>]*rel="prev"/)
})

test('pagination: one page shows just the current; a hundred pages around 50 stay short with ellipses', async () => {
  expect(pageLabels(await render('pagination.tscl', { page: 1, pages: 1, href: '?p={page}' }))).toEqual(['1'])
  const many = pageLabels(await render('pagination.tscl', { page: 50, pages: 100, href: '?p={page}' }))
  expect(many).toEqual(['Previous', '1', '…', '49', '50', '51', '…', '100', 'Next'])
  expect(pageLabels(await render('pagination.tscl', { page: 2, pages: 100, href: '?p={page}' }))).toEqual(['Previous', '1', '2', '3', '…', '100', 'Next'])
})

test('collapsible: a <details> with its trigger in <summary>; [open]', async () => {
  expect(await render('collapsible.tscl', {}, { trigger: 'More', default: 'Body' })).toBe('<details data-part="collapsible"><summary data-part="collapsible-trigger">More</summary><div data-part="collapsible-content">Body</div></details>')
  expect(await render('collapsible.tscl', { open: true }, { trigger: 'x', default: 'y' })).toMatch(/^<details open /)
})

test('empty: an icon, a title, a description and an action; unfilled ones hidden', async () => {
  const html = await render('empty.tscl', {}, { icon: '<svg></svg>', title: 'No projects', default: 'Create one to start.', action: '<button>New</button>' })
  expect(html).toBe('<div data-part="empty"><div aria-hidden="true" data-part="empty-icon"><svg></svg></div><p data-part="empty-title">No projects</p><div data-part="empty-description">Create one to start.</div><div data-part="empty-action"><button>New</button></div></div>')
  expect(source('empty.tscl')).toMatch(/:where\(\[data-part='empty-icon'\]:empty\)/)
})

test('button group: role="group" named by label, joining what it holds', async () => {
  expect(await render('button-group.tscl', { label: 'Text alignment' }, { default: '<button>L</button>' })).toBe('<div role="group" aria-label="Text alignment" data-part="button-group"><button>L</button></div>')
})

test('input group: start and end addons around the field', async () => {
  expect(await render('input-group.tscl', {}, { start: 'https://', default: '<input id="u">', end: '.com' }))
    .toBe('<div data-part="input-group"><span data-part="input-group-start">https://</span><input id="u"><span data-part="input-group-end">.com</span></div>')
})

test('aspect ratio: a box that keeps [ratio], 16/9 by default', async () => {
  expect(await render('aspect-ratio.tscl', {}, { default: '<img alt="">' })).toBe('<div data-part="aspect-ratio" style="aspect-ratio: 16/9"><img alt=""></div>')
  expect(await render('aspect-ratio.tscl', { ratio: '1/1' }, { default: '' })).toContain('aspect-ratio: 1/1')
})

test('alert dialog: the Dialog part as role="alertdialog" that a click outside never closes, described by its message', () => {
  const src = source('alert-dialog.tscl')
  expect(src).toContain('role="alertdialog"')
  expect(src).toContain('[dismissible]="false"')
  expect(src).toMatch(/\[aria-describedby\]="id \+ '-description'"/)
})

test('#review: breadcrumb marks only the last item current; a middle item without href is plain text', async () => {
  const html = await render('breadcrumb.tscl', { items: [{ label: 'Home', href: '/' }, { label: 'Section' }, { label: 'Page' }] })
  expect(html.match(/aria-current="page"/g)).toHaveLength(1)
  expect(html).toMatch(/aria-current="page"[^>]*>Page</)
  expect(source('breadcrumb.tscl')).toContain("content: '/' / ''")
})

test('#review: pagination never puts an ellipsis for a single page', async () => {
  expect(pageLabels(await render('pagination.tscl', { page: 4, pages: 9, href: '?p={page}' }))).toEqual(['Previous', '1', '2', '3', '4', '5', '…', '9', 'Next'])
})

test('#review: the spinner positions its hidden label inside itself', () => {
  expect(source('spinner.tscl')).toMatch(/:where\(:scope\) \{[^}]*position: relative/)
})

test('spacing: padding, margin and gap come from the --ui-space scale, never raw pixels', () => {
  const props = /(?<![-\w])(padding|margin|gap|row-gap|column-gap|padding-[a-z-]+|margin-[a-z-]+|inset|top|right|bottom|left)\s*:\s*([^;}]+)/g
  for (const e of registry) for (const f of e.files.filter((x) => /\.(tscl|css)$/.test(x))) {
    const css = [...source(f).matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n') || (f.endsWith('.css') ? source(f) : '')
    for (const [, prop, value] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(props)) {
      if (/^(top|right|bottom|left|inset)$/.test(prop!) ) continue // positions, not spacing
      expect(value!.replace(/var\(--ui-space[\w-]*\)/g, '').match(/-?\d*\.?\d+px/g), `${f}: ${prop}: ${value}`).toBeNull()
    }
  }
})

test('every block has a category, for /blocks to group and filter by', () => {
  for (const b of blocks) expect(b.category, b.name).toMatch(/^[A-Z][a-z]+$/)
})

test('codeFiles: a block\'s own files, then each component it uses, named as they are copied', () => {
  const login = blocks.find((b) => b.name === 'login')!
  expect(codeFiles(login).map((f) => f.path)).toEqual(['login.tscl', 'login-form.tscl', 'data.ts', 'components/ui/card.tscl', 'components/ui/field.tscl', 'components/ui/button.tscl', 'components/ui/toast.css'])
  expect(codeFiles(login)[3]!.file).toBe('card.tscl')
  const checkout = blocks.find((b) => b.name === 'checkout')!
  expect(codeFiles(checkout).map((f) => f.path)).toEqual(['checkout.tscl', 'checkout-form.tscl', 'data.ts', 'components/ui/field.tscl', 'components/ui/input.tscl', 'components/ui/button.tscl', 'components/ui/separator.tscl', 'components/ui/select.css', 'components/ui/toast.css'])
})

test('every component sits in one of the groups (PrimeVue\'s), and its page\'s frontmatter group says the same', () => {
  expect(COMPONENT_GROUPS).toEqual(['Form', 'Button', 'Data', 'Panel', 'Overlay', 'Menu', 'Chart', 'Messages', 'Media', 'Misc'])
  for (const c of components) {
    expect(COMPONENT_GROUPS, c.name).toContain(c.group)
    const page = readFileSync(resolve(import.meta.dirname, `../src/pages/components/${c.name}.md`), 'utf8')
    expect(/^group: "([^"]+)"$/m.exec(page)?.[1], c.name).toBe(c.group)
  }
  const used = new Set(components.map((c) => c.group))
  for (const g of COMPONENT_GROUPS) expect(used.has(g), g).toBe(true)
})

test('file upload: without JavaScript, a real file input in a labelled drop zone, sent with its form', async () => {
  const html = await render('file-upload.tscl', { id: 'docs', label: 'Attachments', name: 'attachments', accept: 'image/*,.pdf', multiple: true })
  expect(html).toMatch(/<label for="docs" data-part="file-drop"/)
  expect(html).toMatch(/<input type="file" id="docs" name="attachments" accept="image\/\*,\.pdf" multiple/)
  expect(html).toContain('Attachments')
  expect(html).not.toContain('data-part="file-list"')
})
