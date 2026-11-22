// <icon name="…">: completion of the installed sets and their icons, a preview on hover, and unknown icons as errors.
// The cursor is `§`.
import { mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { expect, test } from 'vitest'
import { loadCompiler } from '../src/compiler.ts'
import { completions, hover } from '../src/components.ts'
import { contextAt } from '../src/context.ts'
import { diagnosticsFor } from '../src/plugin/diagnostics.ts'
import { Project } from '../src/project.ts'

async function setup() {
  const root = mkdtempSync(resolve(tmpdir(), 'cl-ls-icons-'))
  writeFileSync(resolve(root, 'package.json'), JSON.stringify({ devDependencies: { '@iconify-json/test': '*' } }))
  const set = resolve(root, 'node_modules/@iconify-json/test')
  mkdirSync(set, { recursive: true })
  writeFileSync(resolve(set, 'package.json'), JSON.stringify({ name: '@iconify-json/test', exports: { './icons.json': './icons.json' } }))
  writeFileSync(resolve(set, 'icons.json'), JSON.stringify({ prefix: 'test', info: { name: 'Test', total: 3 }, width: 24, height: 24, icons: { rocket: { body: '<path fill="currentColor" d="M1 1"/>' }, ruler: { body: '<path/>' } }, aliases: { ship: { parent: 'rocket' } } }))
  mkdirSync(resolve(root, 'src/pages'), { recursive: true })
  const page = resolve(root, 'src/pages/index.tscl')
  writeFileSync(page, '<p></p>\n')
  const project = new Project(root, await loadCompiler(root, false, () => {}))
  await project.load()
  const at = <T>(marked: string, fn: (p: Project, path: string, text: string, offset: number) => T) => {
    const offset = marked.indexOf('§')
    const text = marked.replace('§', '')
    project.update(page, text)
    return fn(project, page, text, offset)
  }
  return { project, page, at }
}

test('the cursor in an attribute value knows what was typed before it', () => {
  expect(contextAt('<icon name="test:ro', 19)).toMatchObject({ kind: 'attr-value', tag: 'icon', attr: 'name', prefix: 'test:ro', start: 12 })
})

test('name="§": the installed sets, inserting set: and asking for the icons next', async () => {
  const { at } = await setup()
  const list = at('<p><icon name="§" /></p>\n', completions)
  expect(list.items.map((i) => [i.label, i.detail])).toEqual([['test', 'Test · 3 icons']])
  expect(list.items[0]!.textEdit).toMatchObject({ newText: 'test:' })
  expect(list.items[0]!.command).toMatchObject({ command: 'editor.action.triggerSuggest' })
})

test('name="test:§" and name="test:r§": the icons of the set, replacing only what follows the colon', async () => {
  const { at } = await setup()
  expect(at('<p><icon name="test:§" /></p>\n', completions).items.map((i) => i.label)).toEqual(['rocket', 'ruler', 'ship'])
  const typed = at('<p><icon name="test:r§" /></p>\n', completions)
  expect(typed.items.map((i) => i.label)).toEqual(['rocket', 'ruler'])
  expect(typed.items[0]!.textEdit).toMatchObject({ newText: 'rocket', range: { start: { line: 0, character: 20 }, end: { line: 0, character: 21 } } })
})

test('other attribute values complete nothing new', async () => {
  const { at } = await setup()
  expect(at('<p><icon class="§" /></p>\n', completions).items).toEqual([])
  expect(at('<p><span name="§"></span></p>\n', completions).items).toEqual([])
})

test('hover on an icon name: a preview and its name', async () => {
  const { at } = await setup()
  const h = at('<p><icon name="test:ro§cket" /></p>\n', hover)
  const value = (h!.contents as { value: string }).value
  expect(value).toContain('`test:rocket`')
  const uri = /!\[[^\]]*\]\(data:image\/svg\+xml;base64,([^)]+)\)/.exec(value)![1]!
  const svg = Buffer.from(uri, 'base64').toString('utf8')
  expect(svg).toContain('viewBox="0 0 24 24" width="48" height="48"')
  expect(svg).not.toContain('currentColor') // a colour that shows in light and dark editors
})

test('an unknown icon is an error, with the closest name', async () => {
  const { project, page } = await setup()
  const [d] = diagnosticsFor(project, page, '<p><icon name="test:rockt" /></p>\n')
  expect(d!.message).toBe("no icon 'rockt' in test (did you mean 'rocket'?)")
  expect(d!.range.start).toEqual({ line: 0, character: 3 })
})

test("hover only on <icon name>, in single or double quotes; not <icon-button name> or data-name", async () => {
  const { at } = await setup()
  expect(at("<p><icon name='test:ro§cket' /></p>\n", hover)).toBeDefined()
  expect(at('<p><icon-button name="test:ro§cket"></icon-button></p>\n', hover)).toBeUndefined()
  expect(at('<p><icon data-name="test:ro§cket" name="test:ship" /></p>\n', hover)).toBeUndefined()
})

test("a project's older compiler (no icons) gets no icon completion or hover", async () => {
  const { project, at } = await setup()
  const { checkIcons: _, ...older } = project.compiler
  Object.defineProperty(project, 'compiler', { value: older })
  expect(at('<p><icon name="§" /></p>\n', completions).items).toEqual([])
  expect(at('<p><icon name="test:ro§cket" /></p>\n', hover)).toBeUndefined()
})

test('every icon error in the file, not just the first', async () => {
  const { project, page } = await setup()
  const ds = diagnosticsFor(project, page, '<p><icon name="test:rockt" /></p>\n<p><icon name="nope:x" /></p>\n')
  expect(ds.map((d) => [d.range.start.line, d.message])).toEqual([
    [0, "no icon 'rockt' in test (did you mean 'rocket'?)"],
    [1, "no icon set 'nope': install it with pnpm add -D @iconify-json/nope"],
  ])
})

/** The text after applying a completion item's edit (single line). */
const applied = (text: string, item: { textEdit?: unknown }) => {
  const e = item.textEdit as { range: { start: { character: number }; end: { character: number } }; newText: string }
  return text.slice(0, e.range.start.character) + e.newText + text.slice(e.range.end.character)
}

test('a completion replaces the whole name, not just up to the cursor', async () => {
  const { at } = await setup()
  const mid = '<p><icon name="test:ro§cket" /></p>'
  const rocket = at(mid, completions).items.find((i) => i.label === 'rocket')!
  expect(applied(mid.replace('§', ''), rocket)).toBe('<p><icon name="test:rocket" /></p>')
  const inSet = '<p><icon name="te§st:rocket" /></p>'
  const set = at(inSet, completions).items.find((i) => i.label === 'test')!
  expect(applied(inSet.replace('§', ''), set)).toBe('<p><icon name="test:rocket" /></p>') // no second colon
})

test('hover on an alias the editor can\'t draw (a rotated one) shows nothing instead of failing', async () => {
  const { project, page } = await setup()
  const icons = resolve(dirname(dirname(dirname(page))), 'node_modules/@iconify-json/test/icons.json')
  const set = JSON.parse(readFileSync(icons, 'utf8'))
  set.aliases.turned = { parent: 'rocket', rotate: 1 }
  writeFileSync(icons, JSON.stringify(set))
  const later = new Date(Date.now() + 5000)
  utimesSync(icons, later, later)
  const text = '<p><icon name="test:turned" /></p>\n'
  project.update(page, text)
  expect(hover(project, page, text, text.indexOf('turned'))).toBeUndefined()
})
