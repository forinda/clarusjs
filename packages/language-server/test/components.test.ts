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
