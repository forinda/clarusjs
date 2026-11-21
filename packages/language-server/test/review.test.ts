// Fixes from the final review: several files moved at once, a closed buffer's discarded text, workspace folders,
// script/style bodies, repeated updates, Markdown code fences.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { expect, test, vi } from 'vitest'
import { URI } from 'vscode-uri'
import { loadCompiler } from '../src/compiler.ts'
import { contextAt } from '../src/context.ts'
import { Project, pickProject } from '../src/project.ts'
import { fileRenameEdits } from '../src/references.ts'
import { tokensOf } from '../src/tokens.ts'

async function setup(files: Record<string, string>) {
  const root = mkdtempSync(resolve(tmpdir(), 'cl-ls-review-'))
  for (const [p, t] of Object.entries(files)) { mkdirSync(dirname(resolve(root, p)), { recursive: true }); writeFileSync(resolve(root, p), t) }
  const project = new Project(root, await loadCompiler(root, false, () => {}))
  await project.load()
  return { project, root, at: (p: string) => resolve(root, p) }
}
const applied = (project: Project, edit: ReturnType<typeof fileRenameEdits>) => Object.fromEntries(Object.entries(edit.changes ?? {}).map(([uri, edits]) => {
  const path = URI.parse(uri).fsPath
  let text = project.textOf(path)!
  const off = (p: { line: number; character: number }) => text.split('\n').slice(0, p.line).reduce((n, l) => n + l.length + 1, 0) + p.character
  for (const e of [...edits].sort((a, b) => off(b.range.start) - off(a.range.start))) text = text.slice(0, off(e.range.start)) + e.newText + text.slice(off(e.range.end))
  return [path, text]
}))

test('moving two files that import each other: one edit set, from their final places, no overlapping edits', async () => {
  const { project, at } = await setup({
    'src/a.tscl': "@import b from './b.tscl'\n<b />\n",
    'src/b.tscl': '<i></i>\n',
    'src/page.tscl': "@import a from './a.tscl'\n@import b from './b.tscl'\n<a /><b />\n",
  })
  const edit = fileRenameEdits(project, [[at('src/a.tscl'), at('src/ui/a.tscl')], [at('src/b.tscl'), at('src/ui/b.tscl')]])
  for (const edits of Object.values(edit.changes!)) {
    const starts = edits.map((e) => `${e.range.start.line}:${e.range.start.character}`)
    expect(new Set(starts).size).toBe(starts.length) // no two edits on one range
  }
  const after = applied(project, edit)
  expect(after[at('src/a.tscl')]).toBeUndefined() // still beside each other: './b.tscl' needs no edit
  expect(after[at('src/page.tscl')]).toContain("@import a from './ui/a.tscl'\n@import b from './ui/b.tscl'")
})

test('a closed buffer whose changes were discarded: the index goes back to the file on disk', async () => {
  const { project, at } = await setup({ 'src/a.tscl': "@import b from './b.tscl'\n<b />\n", 'src/b.tscl': '<i></i>\n' })
  project.update(at('src/a.tscl'), "\n\n@import b from './b.tscl'\n<b />\n") // edited in the editor, never saved
  project.restore(at('src/a.tscl'))
  expect(project.textOf(at('src/a.tscl'))).toBe("@import b from './b.tscl'\n<b />\n")
  expect(project.importsOf(at('src/a.tscl'))[0]!.start).toBe(16)
})

test('workspace folders: the deepest folder holding a file is its project; outside every folder, the loose one', async () => {
  const outer = await setup({ 'src/a.tscl': '<p></p>\n' })
  const inner = new Project(resolve(outer.root, 'packages/ui'), outer.project.compiler)
  const loose = new Project('/', outer.project.compiler)
  const projects = [outer.project, inner]
  expect(pickProject(projects, resolve(outer.root, 'packages/ui/src/b.tscl'), loose)).toBe(inner)
  expect(pickProject(projects, resolve(outer.root, 'src/a.tscl'), loose)).toBe(outer.project)
  expect(pickProject(projects, '/elsewhere/c.tscl', loose)).toBe(loose)
})

test('inside <script> and <style>, no template completions or tokens', () => {
  const source = "<script>\n  /** @m */\n  const m = new Map<string, number>()\n  const s = '{{ x }}'\n</script>\n<style>\n  @import 'a.css';\n</style>\n<p>{{ y }}</p>\n"
  const at = (needle: string, delta = needle.length) => contextAt(source, source.indexOf(needle) + delta)
  expect(at('@m').kind).toBe('text')
  expect(at('<string').kind).toBe('text')
  expect(at("@import 'a").kind).toBe('text')
  const tokens = tokensOf(source, new Set())
  expect(tokens.map((t) => t.line)).toEqual([8, 8]) // only the {{ }} of the last line
})

test('an update with the same text doesn\'t parse again', async () => {
  const { project, at } = await setup({ 'src/a.tscl': '<p></p>\n' })
  const parse = vi.spyOn(project.compiler, 'parse')
  project.update(at('src/a.tscl'), '<p></p>\n')
  expect(parse).not.toHaveBeenCalled()
})

test('Markdown: @import lines inside code fences are examples, not imports', async () => {
  const { project, at } = await setup({
    'src/components/card.tscl': '<i></i>\n',
    'src/pages/guide.md': "---\ntitle: G\n---\n@import card from '../components/card.tscl'\n\n```tscl\n@import card from '../components/card.tscl'\n```\n",
  })
  expect(project.importsOf(at('src/pages/guide.md'))).toHaveLength(1)
})

test('minor: block keywords as the compiler reads them: an email isn\'t @if, @else only after a block', async () => {
  const { htmlView } = await import('../src/blank.ts')
  for (const text of ['<p>me@if.com and you@for.net</p>\n', '<p>see @else here</p>\n', '<p>me@empty.io</p>\n']) expect(htmlView(text)).toBe(text)
  expect(htmlView('@if (a) {<i></i>} @else {<b></b>}\n')).toBe('         <i></i>         <b></b> \n')
})

test('minor: a } inside an element within a block is text, not the block\'s end', async () => {
  const { htmlView } = await import('../src/blank.ts')
  expect(htmlView('@if (a) {<p>}</p>}\n')).toBe('         <p>}</p> \n')
})

test('minor: a > inside a binding value doesn\'t end the tag for completion', () => {
  const text = '<card (click)="xs.map((x) => x)" [ti'
  expect(contextAt(text, text.length)).toMatchObject({ kind: 'attr-name', tag: 'card', prefix: '[ti' })
})

test('minor: moving a file keeps a /-rooted specifier /-rooted, and a ~/ one leaving src becomes relative', async () => {
  const { project, at } = await setup({
    'src/card.tscl': '<i></i>\n',
    'src/a.tscl': "@import card from '/src/card.tscl'\n<card />\n",
    'src/b.tscl': "@import card from '~/card.tscl'\n<card />\n",
  })
  const after = applied(project, fileRenameEdits(project, [[at('src/card.tscl'), at('lib/card.tscl')]]))
  expect(after[at('src/a.tscl')]).toContain("from '/lib/card.tscl'")
  expect(after[at('src/b.tscl')]).toContain("from '../lib/card.tscl'")
})
