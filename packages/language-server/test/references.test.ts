// References and renames: a component's uses across the project; renaming a tag or import name (one file); renaming
// or moving a .tscl file (every @import that resolves to it, Markdown pages included, and the moved file's own).
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { expect, test } from 'vitest'
import { URI } from 'vscode-uri'
import { loadCompiler } from '../src/compiler.ts'
import { Project } from '../src/project.ts'
import { fileRenameEdits, references, renameEdits } from '../src/references.ts'

async function setup(files: Record<string, string>) {
  const root = mkdtempSync(resolve(tmpdir(), 'cl-ls-refs-'))
  for (const [p, t] of Object.entries(files)) { mkdirSync(dirname(resolve(root, p)), { recursive: true }); writeFileSync(resolve(root, p), t) }
  const project = new Project(root, await loadCompiler(root, false, () => {}))
  await project.load()
  const at = (p: string) => resolve(root, p)
  return { project, at, uri: (p: string) => URI.file(at(p)).toString() }
}
/** Each edit applied to its file's indexed text. */
const apply = (project: Project, edit: { changes?: Record<string, { range: { start: { line: number; character: number }; end: { line: number; character: number } }; newText: string }[]> }) =>
  Object.fromEntries(Object.entries(edit.changes ?? {}).map(([uri, edits]) => {
    const path = URI.parse(uri).fsPath
    let text = project.textOf(path)!
    const lines = () => text.split('\n')
    const off = (p: { line: number; character: number }) => lines().slice(0, p.line).reduce((n, l) => n + l.length + 1, 0) + p.character
    for (const e of [...edits].sort((a, b) => off(b.range.start) - off(a.range.start))) text = text.slice(0, off(e.range.start)) + e.newText + text.slice(off(e.range.end))
    return [path, text]
  }))

const files = {
  'src/components/card.tscl': "@import badge from './badge.tscl'\n<div><badge /></div>\n",
  'src/components/badge.tscl': '<i></i>\n',
  'src/pages/index.tscl': "@import card from '../components/card.tscl'\n<card></card>\n<card />\n",
  'src/pages/about.tscl': "@import Tile from '~/components/card.tscl'\n<Tile />\n",
  'src/pages/guide.md': "---\ntitle: G\n---\n@import card from '../components/card.tscl'\n\n<card />\n",
}

test('references: the component\'s tags in every file importing it (whatever its name there), and the import lines', async () => {
  const { project, at } = await setup(files)
  const text = project.textOf(at('src/pages/index.tscl'))!
  const found = references(project, at('src/pages/index.tscl'), text, text.indexOf('<card') + 2)
  const where = found.map((l) => `${URI.parse(l.uri).fsPath.slice(at('src').length + 1)}:${l.range.start.line}`)
  expect(where.sort()).toEqual(['pages/about.tscl:0', 'pages/about.tscl:1', 'pages/guide.md:3', 'pages/guide.md:5', 'pages/index.tscl:0', 'pages/index.tscl:1', 'pages/index.tscl:1', 'pages/index.tscl:2'])
})

test('rename a tag or import name: that file\'s import name and tags only', async () => {
  const { project, at, uri } = await setup(files)
  const text = project.textOf(at('src/pages/index.tscl'))!
  const edit = renameEdits(project, at('src/pages/index.tscl'), text, text.indexOf('<card') + 2, 'panel')!
  expect(Object.keys(edit.changes!)).toEqual([uri('src/pages/index.tscl')])
  expect(apply(project, edit)[at('src/pages/index.tscl')]).toBe("@import panel from '../components/card.tscl'\n<panel></panel>\n<panel />\n")
})

test('rename/move a file: importers\' specifiers follow (relative recomputed, ~/ kept as ~/, Markdown too), and its own relative imports', async () => {
  const { project, at } = await setup(files)
  const edit = fileRenameEdits([project], [[at('src/components/card.tscl'), at('src/ui/panels/card.tscl')]])
  const after = apply(project, edit)
  expect(after[at('src/pages/index.tscl')]).toContain("@import card from '../ui/panels/card.tscl'")
  expect(after[at('src/pages/about.tscl')]).toContain("@import Tile from '~/ui/panels/card.tscl'")
  expect(after[at('src/pages/guide.md')]).toContain("@import card from '../ui/panels/card.tscl'")
  expect(after[at('src/components/card.tscl')]).toContain("@import badge from '../../components/badge.tscl'") // the moved file's own
})
