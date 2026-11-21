// The lexical layer as the compiler reads templates: tags, quotes, holes, comments, directives and bodies, so
// completion, tokens, references and renames act only on real template syntax. (Review findings on #271.)
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { expect, test } from 'vitest'
import { URI } from 'vscode-uri'
import { htmlView } from '../src/blank.ts'
import { loadCompiler } from '../src/compiler.ts'
import { completions } from '../src/components.ts'
import { contextAt } from '../src/context.ts'
import { Project } from '../src/project.ts'
import { fileRenameEdits, renameEdits } from '../src/references.ts'
import { tokensOf, TOKEN_TYPES } from '../src/tokens.ts'

async function setup(files: Record<string, string>) {
  const root = mkdtempSync(resolve(tmpdir(), 'cl-ls-lex-'))
  const write = (p: string, t: string) => { mkdirSync(dirname(resolve(root, p)), { recursive: true }); writeFileSync(resolve(root, p), t) }
  for (const [p, t] of Object.entries(files)) write(p, t)
  const project = new Project(root, await loadCompiler(root, false, () => {}))
  await project.load()
  return { project, root, write, at: (p: string) => resolve(root, p) }
}

test('a lone < answers (no endless search back)', () => {
  expect(contextAt('<', 1)).toEqual({ kind: 'tag-name', prefix: '', start: 1 })
})

test('a < inside a quoted value isn\'t a tag; a real one after text is', () => {
  expect(contextAt('<card [value]="a<b', 18)).toMatchObject({ kind: 'attr-value', tag: 'card', attr: '[value]' })
  expect(contextAt('<p>a</p>\n<b', 11)).toMatchObject({ kind: 'tag-name', prefix: 'b' })
})

test('single-quoted attribute values are values', () => {
  const text = "<card title='hello wor"
  expect(contextAt(text, text.length)).toMatchObject({ kind: 'attr-value', tag: 'card', attr: 'title' })
})

test('an @import inside a {{-- --}} comment isn\'t one', async () => {
  const { project, at } = await setup({ 'src/a.tscl': "{{--\n@import card from './old.tscl'\n--}}\n@import card from './card.tscl'\n<card />\n" })
  expect(project.importsOf(at('src/a.tscl')).map((i) => i.specifier)).toEqual(['./card.tscl'])
})

test('renaming a component changes its real tags only: not script strings, attribute values, comments or code samples', async () => {
  const text = "@import card from './card.tscl'\n<card title=\"<card>\"></card>\n{{-- <card> --}}\n<!-- <card /> -->\n<script>\n  const html = '<card />'\n</script>\n"
  const { project, at } = await setup({ 'src/card.tscl': '<i></i>\n', 'src/a.tscl': text })
  const edits = renameEdits(project, at('src/a.tscl'), text, text.indexOf('<card') + 2, 'tile')!.changes![URI.file(at('src/a.tscl')).toString()]!
  expect(edits).toHaveLength(3) // the import name, <card and </card>
})

test('tsconfig paths as the build reads them: the most specific alias, baseUrl, jsconfig.json', async () => {
  const ts = await setup({
    'tsconfig.json': JSON.stringify({ compilerOptions: { paths: { '@ui/*': ['src/ui/*'], '@ui/special/*': ['src/special/*'] } } }),
    'src/ui/special/card.tscl': '<i></i>\n',
    'src/special/card.tscl': '<b></b>\n',
  })
  expect(ts.project.resolve('@ui/special/card.tscl', ts.at('src/a.tscl'))).toBe(ts.at('src/special/card.tscl'))
  const js = await setup({ 'jsconfig.json': JSON.stringify({ compilerOptions: { baseUrl: 'src', paths: { '@c/*': ['comp/*'] } } }), 'src/comp/card.tscl': '<i></i>\n' })
  expect(js.project.resolve('@c/card.tscl', js.at('src/a.tscl'))).toBe(js.at('src/comp/card.tscl'))
})

test('a changed tsconfig re-resolves the imports already indexed', async () => {
  const { project, write, at } = await setup({
    'tsconfig.json': JSON.stringify({ compilerOptions: { paths: { '@ui/*': ['src/old/*'] } } }),
    'src/old/card.tscl': '<i></i>\n',
    'src/new/card.tscl': '<i></i>\n',
    'src/a.tscl': "@import card from '@ui/card.tscl'\n<card />\n",
  })
  write('tsconfig.json', JSON.stringify({ compilerOptions: { paths: { '@ui/*': ['src/new/*'] } } }))
  project.forgetConfig()
  expect(project.importsOf(at('src/a.tscl'))[0]!.target).toBe(at('src/new/card.tscl'))
})

test('an unreadable file (a dangling symlink) doesn\'t stop indexing', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'cl-ls-lex-'))
  symlinkSync(resolve(root, 'gone.tscl'), resolve(root, 'a.tscl'))
  writeFileSync(resolve(root, 'b.tscl'), '<p></p>\n')
  const project = new Project(root, await loadCompiler(root, false, () => {}))
  await project.load()
  expect(project.files()).toEqual([resolve(root, 'b.tscl')])
})

test('tokens: a > in a binding value doesn\'t end the tag; a {{ in a script string doesn\'t stop the scan', () => {
  const names = (source: string, type: (typeof TOKEN_TYPES)[number]) => tokensOf(source, new Set(['card'])).filter((t) => t.type === TOKEN_TYPES.indexOf(type)).map((t) => source.split('\n')[t.line]!.slice(t.character, t.character + t.length))
  expect(names('<card (click)="xs.map((x) => x)" [title]="t"/>\n', 'variable')).toEqual(['click', 'title'])
  expect(names('<script>\n  const m = "{{"\n</script>\n<card />\n', 'type')).toEqual(['card'])
})

test('holes with nested braces and directives with multi-line generic types are blanked whole', () => {
  const hole = '{{ {x: {}}.x ? "<b>" : "" }}'
  expect(htmlView(`<p>${hole}</p>\n`)).toBe(`<p>${' '.repeat(hole.length)}</p>\n`)
  expect(htmlView('@input names: Array<\n  string\n>\n<p></p>\n')).toBe(`${' '.repeat(20)}\n${' '.repeat(8)}\n \n<p></p>\n`)
  expect(htmlView("@input f: (a: string) => void = () => {}\n<p></p>\n")).toBe(`${' '.repeat(40)}\n<p></p>\n`)
})

test('completing a tag name replaces the whole name', async () => {
  const text = "@import card from './card.tscl'\n<ca"
  const { project, at } = await setup({ 'src/card.tscl': '<i></i>\n' })
  const source = `${text}rd />\n`
  project.update(at('src/a.tscl'), source)
  const item = completions(project, at('src/a.tscl'), source, text.length).items.find((i) => i.label === 'card')!
  expect((item.textEdit as { range: { end: { character: number } } }).range.end.character).toBe(5) // after "card"
})

test('moving a file: importers in every workspace project are updated', async () => {
  const a = await setup({ 'card.tscl': '<i></i>\n' })
  const b = new Project(resolve(a.root, '../', `${a.root.split('/').pop()}-b`), a.project.compiler)
  mkdirSync(b.root, { recursive: true })
  const page = resolve(b.root, 'page.tscl')
  writeFileSync(page, `@import card from '${a.at('card.tscl')}'\n<card />\n`.replace(`'${a.at('card.tscl')}'`, `'../${a.root.split('/').pop()}/card.tscl'`))
  await b.load()
  const edit = fileRenameEdits([a.project, b], [[a.at('card.tscl'), a.at('ui/card.tscl')]])
  expect(Object.keys(edit.changes!)).toContain(URI.file(page).toString())
})
