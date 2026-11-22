// <icon name="…">: completion of the installed sets and their icons, a preview on hover, and unknown icons as errors.
// The cursor is `§`.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
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
