// References and renames. A component's references are its tags in every file importing the same file (whatever name
// each gives it) and those import names. Renaming a tag or import name renames it in that file only (an import name
// is the file's own). Renaming or moving a .tscl file rewrites every @import that resolves to it, Markdown pages
// included, and the moved file's own relative imports.
import { dirname, relative, resolve } from 'node:path'
import type { Location, Range, WorkspaceEdit } from '@volar/language-service'
import { URI } from 'vscode-uri'
import { positionAt } from './positions.ts'
import type { Import, Project } from './project.ts'

const rangeOf = (text: string, start: number, end: number): Range => ({ start: positionAt(text, start), end: positionAt(text, end) })

/** Offsets of `<name` / `</name` tag names in `text`. */
function tagsNamed(text: string, name: string): number[] {
  const out: number[] = []
  const re = new RegExp(`</?(${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=[\\s/>])`, 'g')
  for (const m of text.matchAll(re)) out.push(m.index! + m[0].length - name.length)
  return out
}

/** The import a cursor names: on its import name, or on one of its tags. */
function importAt(project: Project, path: string, text: string, offset: number): Import | undefined {
  const imports = project.importsOf(path)
  const onName = imports.find((i) => offset >= i.nameStart && offset <= i.nameStart + i.name.length)
  if (onName) return onName
  for (const m of text.matchAll(/<\/?([A-Za-z][\w.-]*)/g)) {
    const start = m.index! + m[0].length - m[1]!.length
    if (offset >= start && offset <= start + m[1]!.length) return imports.find((i) => i.name === m[1])
    if (start > offset) break
  }
}

export function references(project: Project, path: string, text: string, offset: number): Location[] {
  const imp = importAt(project, path, text, offset)
  if (!imp?.target) return []
  const out: Location[] = []
  for (const file of project.importersOf(imp.target)) {
    const fileText = file === path ? text : project.textOf(file) ?? ''
    const uri = URI.file(file).toString()
    for (const i of project.importsOf(file).filter((x) => x.target === imp.target)) {
      out.push({ uri, range: rangeOf(fileText, i.nameStart, i.nameStart + i.name.length) })
      for (const at of tagsNamed(fileText, i.name)) out.push({ uri, range: rangeOf(fileText, at, at + i.name.length) })
    }
  }
  return out
}

/** The range renaming would change (the name under the cursor), for prepareRename. */
export function renameRange(project: Project, path: string, text: string, offset: number): Range | undefined {
  const imp = importAt(project, path, text, offset)
  if (!imp) return undefined
  const at = [imp.nameStart, ...tagsNamed(text, imp.name)].find((s) => offset >= s && offset <= s + imp.name.length)
  return at === undefined ? undefined : rangeOf(text, at, at + imp.name.length)
}

export function renameEdits(project: Project, path: string, text: string, offset: number, newName: string): WorkspaceEdit | undefined {
  const imp = importAt(project, path, text, offset)
  if (!imp) return undefined
  const edits = [imp.nameStart, ...tagsNamed(text, imp.name)].map((at) => ({ range: rangeOf(text, at, at + imp.name.length), newText: newName }))
  return { changes: { [URI.file(path).toString()]: edits } }
}

/** A specifier for `target` from `importer`, in the style of `previous` (~/ stays ~/; otherwise relative). */
function specifierFor(project: Project, importer: string, target: string, previous: string): string {
  if (previous.startsWith('~/')) return `~/${relative(resolve(project.root, 'src'), target).split('\\').join('/')}`
  const rel = relative(dirname(importer), target).split('\\').join('/')
  return rel.startsWith('.') ? rel : `./${rel}`
}

export function fileRenameEdits(project: Project, oldPath: string, newPath: string): WorkspaceEdit {
  const changes: NonNullable<WorkspaceEdit['changes']> = {}
  const add = (file: string, start: number, end: number, newText: string) => {
    const text = project.textOf(file) ?? ''
    ;(changes[URI.file(file).toString()] ??= []).push({ range: rangeOf(text, start, end), newText })
  }
  for (const file of project.importersOf(oldPath)) {
    for (const i of project.importsOf(file).filter((x) => x.target === oldPath)) {
      // A package or tsconfig-paths specifier that still reaches the file stays; the rest are rewritten.
      const kept = !i.specifier.startsWith('.') && !i.specifier.startsWith('~/') && project.resolve(i.specifier, file) === newPath
      if (!kept) add(file, i.start, i.end, specifierFor(project, file === oldPath ? newPath : file, newPath, i.specifier))
    }
  }
  // The moved file's own relative imports, from its new folder.
  for (const i of project.importsOf(oldPath)) {
    if (!i.target || !i.specifier.startsWith('.')) continue
    const next = specifierFor(project, newPath, i.target, i.specifier)
    if (next !== i.specifier) add(oldPath, i.start, i.end, next)
  }
  return { changes }
}
