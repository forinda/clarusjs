// Components in a template: completion (directives, the file's imported components as tags, their inputs, models and
// events as bindings, @import paths), hover on a component tag, and go to definition from a tag or its specifier. Read
// with the compiler's parser (each component's last good parse); the cursor's context is lexical.
import { dirname, relative } from 'node:path'
import type { CompletionItem, CompletionList, Hover, LocationLink } from '@volar/language-service'
import { URI } from 'vscode-uri'
import { contextAt } from './context.ts'
import { positionAt } from './positions.ts'
import type { Import, Project } from './project.ts'

// ponytail: events a component sends, found by their literal name in its script; a name built at runtime isn't listed.
const EVENT = /new\s+CustomEvent\(\s*(['"])([^'"]+)\1/g
const DIRECTIVES = ['@if', '@else', '@for', '@empty', '@slot', '@import', '@input', '@model', '@type', '@interface']
const Kind = { Property: 10, Event: 23, Keyword: 14, File: 17, Class: 7 } as const

type Info = { inputs: { name: string; type: string; optional: boolean; model: boolean }[]; events: string[] }

/** What the component an import names takes: its inputs and models (whole types) and the events its script sends. */
function interfaceOf(project: Project, imp: Import): Info | undefined {
  const parsed = imp.target ? project.componentAt(imp.target) : undefined
  if (!parsed) return undefined
  const script = parsed.script?.code ?? ''
  return {
    inputs: parsed.inputs.map((i) => ({ name: i.name, type: i.type, optional: i.default !== undefined, model: !!i.model })),
    events: [...new Set([...script.matchAll(EVENT)].map((m) => m[2]!))],
  }
}

const importNamed = (project: Project, path: string, name: string) => project.importsOf(path).find((i) => i.name === name)

export function completions(project: Project, path: string, text: string, offset: number): CompletionList {
  const ctx = contextAt(text, offset)
  const list = (items: CompletionItem[]): CompletionList => ({ isIncomplete: false, items })
  const range = (start: number, end = offset) => ({ start: positionAt(text, start), end: positionAt(text, end) })
  if (ctx.kind === 'directive') {
    return list(DIRECTIVES.filter((d) => d.startsWith(ctx.prefix)).map((d) => ({ label: d, kind: Kind.Keyword, textEdit: { range: range(ctx.start), newText: d } })))
  }
  if (ctx.kind === 'tag-name') {
    return list(project.importsOf(path).filter((i) => i.name.startsWith(ctx.prefix)).map((i) => ({ label: i.name, kind: Kind.Class, detail: `Component from ${i.specifier}`, textEdit: { range: range(ctx.start), newText: i.name } })))
  }
  if (ctx.kind === 'attr-name') {
    const imp = importNamed(project, path, ctx.tag)
    const info = imp && interfaceOf(project, imp)
    if (!info) return list([])
    const item = (label: string, kind: CompletionItem['kind'], detail: string): CompletionItem => ({ label, kind, detail, insertTextFormat: 2, textEdit: { range: range(ctx.start), newText: `${label}="$1"` } })
    return list([
      ...info.inputs.flatMap((i) => [item(`[${i.name}]`, Kind.Property, `${i.name}${i.optional ? '?' : ''}: ${i.type}`), ...(i.model ? [item(`[(${i.name})]`, Kind.Property, `${i.name}: ${i.type} (two-way)`)] : [])]),
      ...info.events.map((e) => item(`(${e})`, Kind.Event, `Event from ${ctx.tag}; its data is $event.detail`)),
    ].filter((c) => c.label.startsWith(ctx.prefix)))
  }
  if (ctx.kind === 'import-path') {
    const dir = dirname(path)
    const specifiers = project.files().filter((f) => f.endsWith('.tscl') && f !== path).map((f) => { const r = relative(dir, f); return r.startsWith('.') ? r : `./${r}` })
    return list(specifiers.filter((s) => s.startsWith(ctx.prefix)).map((s) => ({ label: s, kind: Kind.File, textEdit: { range: range(ctx.start, ctx.end), newText: s } })))
  }
  return list([])
}

/** The component tag (open or close) whose name covers `offset`, with its name's range. */
function tagAt(text: string, offset: number): { name: string; start: number; end: number } | undefined {
  for (const m of text.matchAll(/<\/?([A-Za-z][\w.-]*)/g)) {
    const start = m.index! + m[0].length - m[1]!.length
    const end = start + m[1]!.length
    if (offset >= start && offset <= end) return { name: m[1]!, start, end }
    if (start > offset) break
  }
}

export function hover(project: Project, path: string, text: string, offset: number): Hover | undefined {
  const tag = tagAt(text, offset)
  const imp = tag && importNamed(project, path, tag.name)
  if (!tag || !imp) return undefined
  const info = interfaceOf(project, imp)
  const lines = info?.inputs.map((i) => `${i.name}${i.optional ? '?' : ''}: ${i.type}`) ?? []
  const models = info?.inputs.filter((i) => i.model).map((i) => `\`[(${i.name})]\``) ?? []
  const value = [
    `Component from \`${imp.specifier}\``,
    ...(lines.length ? ['```ts\n' + lines.join('\n') + '\n```'] : info ? ['No inputs.'] : []),
    ...(models.length ? [`Two-way: ${models.join(', ')}`] : []),
    ...(info?.events.length ? [`Events: ${info.events.map((e) => `\`(${e})\``).join(', ')}`] : []),
  ].join('\n\n')
  return { contents: { kind: 'markdown', value }, range: { start: positionAt(text, tag.start), end: positionAt(text, tag.end) } }
}

export function definition(project: Project, path: string, text: string, offset: number): LocationLink[] | undefined {
  const onSpecifier = project.importsOf(path).find((i) => offset >= i.start && offset <= i.end)
  const tag = onSpecifier ? undefined : tagAt(text, offset)
  const imp = onSpecifier ?? (tag && importNamed(project, path, tag.name))
  if (!imp?.target) return undefined
  const [start, end] = onSpecifier ? [imp.start, imp.end] : [tag!.start, tag!.end]
  const origin = { start: positionAt(text, start), end: positionAt(text, end) }
  const top = { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }
  return [{ originSelectionRange: origin, targetUri: URI.file(imp.target).toString(), targetRange: top, targetSelectionRange: top }]
}
