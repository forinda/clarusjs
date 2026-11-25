// Components in templates: completion of tags, their inputs, models and events; hover; go to definition; directives
// and import paths. The cursor is `§`.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { expect, test } from 'vitest'
import { URI } from 'vscode-uri'
import { loadCompiler } from '../src/compiler.ts'
import { completions, definition, hover } from '../src/components.ts'
import { contextAt } from '../src/context.ts'
import { Project } from '../src/project.ts'
import { bindingsProvider } from '../src/bindings.ts'

const CARD = `@input title: string
@input user: {
  name: string
  admin: boolean
}
@model open: boolean = false
<script>
  function rate(el) { el.dispatchEvent(new CustomEvent('rate', { bubbles: true, detail: 5 })) }
</script>
<h2>{{ title }}</h2>
`

async function setup() {
  const root = mkdtempSync(resolve(tmpdir(), 'cl-ls-comp-'))
  const files: Record<string, string> = { 'src/components/card.tscl': CARD, 'src/components/badge.tscl': '<i></i>\n', 'src/pages/index.tscl': '<p></p>\n' }
  for (const [p, t] of Object.entries(files)) { mkdirSync(dirname(resolve(root, p)), { recursive: true }); writeFileSync(resolve(root, p), t) }
  const project = new Project(root, await loadCompiler(root, false, () => {}))
  await project.load()
  const page = resolve(root, 'src/pages/index.tscl')
  /** Run `fn` on `marked` (with `§` as the cursor) as the page's text. */
  const at = <T>(marked: string, fn: (p: Project, path: string, text: string, offset: number) => T) => {
    const offset = marked.indexOf('§')
    const text = marked.replace('§', '')
    project.update(page, text)
    return fn(project, page, text, offset)
  }
  return { root, project, page, at }
}
const IMPORT = "@import card from '../components/card.tscl'\n"
const labels = (list: { items: { label: string }[] } | undefined) => (list?.items ?? []).map((i) => i.label)

test('the cursor context, lexically, in a file that doesn\'t parse', () => {
  expect(contextAt('<ca', 3)).toMatchObject({ kind: 'tag-name', prefix: 'ca' })
  expect(contextAt('<card [ti', 9)).toMatchObject({ kind: 'attr-name', tag: 'card', prefix: '[ti' })
  expect(contextAt('<card [title]="x', 16)).toMatchObject({ kind: 'attr-value', tag: 'card', attr: '[title]' })
  expect(contextAt("@import card from '../co", 24)).toMatchObject({ kind: 'import-path', prefix: '../co' })
  expect(contextAt('<p>\n  @i', 8)).toMatchObject({ kind: 'directive', prefix: '@i' })
  expect(contextAt('<div>\n  @if (x {\n  <p>{{ a.', 26)).toMatchObject({ kind: 'text' })
})

test('completion: component tags, then their inputs, models and events as bindings', async () => {
  const { at } = await setup()
  expect(labels(at(`${IMPORT}<ca§`, completions))).toContain('card')
  const attrs = labels(at(`${IMPORT}<card §`, completions))
  expect(attrs).toEqual(expect.arrayContaining(['[title]', '[user]', '[open]', '[(open)]', '(rate)']))
})

test('completion: directives, and import paths to .tscl files', async () => {
  const { at } = await setup()
  expect(labels(at('<p>\n@i§', completions))).toEqual(expect.arrayContaining(['@if', '@import', '@input']))
  expect(labels(at("@import x from '../components/§'\n", completions))).toEqual(expect.arrayContaining(['../components/card.tscl', '../components/badge.tscl']))
})

test('hover on a component tag: where it comes from, its inputs with whole types (multi-line too), models, events', async () => {
  const { at } = await setup()
  const shown = at(`${IMPORT}<ca§rd [title]="'x'" />\n`, hover)?.contents as { value: string }
  expect(shown.value).toContain('../components/card.tscl')
  expect(shown.value).toContain('title: string')
  expect(shown.value).toContain('user: {\n  name: string\n  admin: boolean\n}') // whole (closes #242)
  expect(shown.value).toContain('`[(open)]`')
  expect(shown.value).toContain('`(rate)`')
})

test('hover on a component\'s prop: the input\'s declared type and default, two-way models, events', async () => {
  const { at } = await setup()
  const text = (marked: string) => (at(marked, hover)?.contents as { value: string } | undefined)?.value ?? ''
  // [title]: a required input; the hover covers the whole attribute name.
  const title = at(`${IMPORT}<card [ti§tle]="'x'" />\n`, hover)!
  expect((title.contents as { value: string }).value).toContain('title: string')
  expect((title.contents as { value: string }).value).toContain('Input of `<card>`')
  expect(title.range).toEqual({ start: { line: 1, character: 6 }, end: { line: 1, character: 13 } })
  // A static attribute names the same input.
  expect(text(`${IMPORT}<card ti§tle="x" />\n`)).toContain('title: string')
  // A multi-line type is shown whole.
  expect(text(`${IMPORT}<card [us§er]="u" />\n`)).toContain('user: {\n  name: string\n  admin: boolean\n}')
  // A model, two-way, with its default.
  const open = text(`${IMPORT}<card [(op§en)]="o" />\n`)
  expect(open).toContain('open?: boolean = false')
  expect(open).toContain('two-way')
  // An event the component sends.
  expect(text(`${IMPORT}<card (ra§te)="go($event)" />\n`)).toContain('`$event.detail`')
  // Not a component's attribute: nothing (HTML hovers are the HTML service's).
  expect(at(`${IMPORT}<p cl§ass="x"></p>\n`, hover)).toBeUndefined()
  expect(at(`${IMPORT}<card [unk§nown]="1" />\n`, hover)).toBeUndefined()
})

test('go to definition: a component tag, and its @import specifier, lead to the file', async () => {
  const { at, root } = await setup()
  const card = resolve(root, 'src/components/card.tscl')
  expect(at(`${IMPORT}<ca§rd />\n`, definition)?.[0]?.targetUri).toBe(URI.file(card).toString())
  expect(at("@import card from '../comp§onents/card.tscl'\n<card />\n", definition)?.[0]?.targetUri).toBe(URI.file(card).toString())
})

test('while typing (unclosed <div, @if (, {{): no throws, and answers where they still make sense', async () => {
  const { at } = await setup()
  expect(() => at(`${IMPORT}<div>\n  @if (x {\n  <card §`, completions)).not.toThrow()
  expect(labels(at(`${IMPORT}<div>\n  @if (x {\n  <card §`, completions))).toContain('[title]')
  expect(() => at(`${IMPORT}<div>\n  {{ a.§`, hover)).not.toThrow()
})

test('binding forms of HTML attributes, as extra HTML data (textarea and select get [value])', () => {
  const b = bindingsProvider()
  const names = (tag: string) => b.provideAttributes(tag).map((a) => a.name)
  expect(names('button')).toEqual(expect.arrayContaining(['[disabled]', '(click)', '[class]']))
  expect(names('input')).toEqual(expect.arrayContaining(['[(value)]', '[(checked)]']))
  for (const tag of ['textarea', 'select']) expect(names(tag)).toEqual(expect.arrayContaining(['[value]', '[(value)]']))
  expect(names('div')).not.toContain('[(value)]')
})

test('#458 automatic components: completed, hovered and followed by name, without @import', async () => {
  const { root, project, at } = await setup()
  mkdirSync(resolve(root, 'src/components/forms'), { recursive: true })
  writeFileSync(resolve(root, 'src/components/forms/text-field.tscl'), '@input label: string\n<b>{{ label }}</b>\n')
  project.update(resolve(root, 'src/components/forms/text-field.tscl'), '@input label: string\n<b>{{ label }}</b>\n')
  expect(labels(at('<§', completions))).toEqual(expect.arrayContaining(['text-field', 'forms-text-field']))
  expect(labels(at('<text-field §', completions))).toContain('[label]')
  const shown = at(`<text-fi§eld [label]="'x'" />\n`, hover)?.contents as { value: string }
  expect(shown.value).toContain('label: string')
  const [link] = at(`<forms-text-fi§eld />\n`, definition) ?? []
  expect(link?.targetUri).toContain('src/components/forms/text-field.tscl')
})

test('library components (from .clarusjs/components.json, written by the plugin or check): completed, hovered, followed', async () => {
  const { root, at } = await setup()
  const lib = resolve(root, 'node_modules/@acme/ui')
  mkdirSync(resolve(lib, 'src'), { recursive: true })
  writeFileSync(resolve(lib, 'package.json'), JSON.stringify({ name: '@acme/ui', exports: { './*': './src/*' }, clarusjs: { components: './src', prefix: 'acme' } }))
  writeFileSync(resolve(lib, 'src/dialog.tscl'), '@input heading: string\n<dialog>{{ heading }}</dialog>\n')
  mkdirSync(resolve(root, '.clarusjs'), { recursive: true })
  writeFileSync(resolve(root, '.clarusjs/components.json'), JSON.stringify({ names: { 'acme-dialog': '@acme/ui/dialog.tscl', 'badge-x': '/src/components/gone.tscl' } }))
  expect(labels(at('<§', completions))).toContain('acme-dialog')
  expect(labels(at('<§', completions))).not.toContain('badge-x') // the app's own come from its files, not the last run
  expect(labels(at('<acme-dialog §', completions))).toContain('[heading]')
  const [link] = at(`<acme-dia§log />\n`, definition) ?? []
  expect(decodeURIComponent(link?.targetUri ?? '')).toContain('node_modules/@acme/ui/src/dialog.tscl')
})

test('#review: a components.json without names, or with odd values, is ignored (own components still complete)', async () => {
  const { root, at } = await setup()
  mkdirSync(resolve(root, '.clarusjs'), { recursive: true })
  for (const text of ['{}', '{"names":null}', '{"names":{"a-b":5}}']) {
    writeFileSync(resolve(root, '.clarusjs/components.json'), text)
    expect(() => at('<§', completions), text).not.toThrow()
  }
})

test('#review: the app\'s own components come from the folders components.json lists (the config\'s components.dirs)', async () => {
  const { root, project, at } = await setup()
  for (const file of ['src/widgets/user-card.tscl', 'src/components/old-card.tscl'].map((f) => resolve(root, f))) {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, '<div></div>\n')
    project.update(file, '<div></div>\n')
  }
  expect(labels(at('<§', completions))).toContain('old-card') // the default folders, before any run
  mkdirSync(resolve(root, '.clarusjs'), { recursive: true })
  writeFileSync(resolve(root, '.clarusjs/components.json'), JSON.stringify({ dirs: ['src/widgets'], names: {} }))
  expect(labels(at('<§', completions))).toContain('user-card')
  expect(labels(at('<§', completions))).not.toContain('old-card')
})

test('#442 @event: completed as a binding with its value type, and hovered', async () => {
  const { root, project, at } = await setup()
  const file = resolve(root, 'src/components/stepper.tscl')
  const text = '@event change: number\n<script>\n  let n = state(0)\n</script>\n<button (click)="emit(\'change\', n)">{{ n }}</button>\n'
  writeFileSync(file, text)
  project.update(file, text)
  const IMP = "@import stepper from '../components/stepper.tscl'\n"
  const items = at(`${IMP}<stepper §`, completions).items
  expect(items.find((i) => i.label === '(change)')?.detail).toContain('$event is number')
  const shown = at(`${IMP}<stepper (cha§nge)="x" />\n`, hover)?.contents as { value: string }
  expect(shown.value).toContain('@event change: number')
})

test('#465 @context is offered as a directive', async () => {
  const { at } = await setup()
  expect(labels(at('<p>\n@c§', completions))).toContain('@context')
})
