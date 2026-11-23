// Components in a template: completion (directives, the file's imported components as tags, their inputs, models and
// events as bindings, @import paths), hover on a component tag, and go to definition from a tag or its specifier. Read
import { iconNames, iconSets, iconSvg, resolveIcon } from 'clarusjs/icons'
// with the compiler's parser (each component's last good parse); the cursor's context is lexical.
import { dirname, relative, sep } from 'node:path'
import type { CompletionItem, CompletionList, Hover, LocationLink } from '@volar/language-service'
import { URI } from 'vscode-uri'
import { tagsIn } from './blank.ts'
import { contextAt } from './context.ts'
import { positionAt } from './positions.ts'
import type { Import, Project } from './project.ts'

// ponytail: events a component sends, found by their literal name in its script; a name built at runtime isn't listed.
const EVENT = /new\s+CustomEvent\(\s*(['"])([^'"]+)\1/g
const DIRECTIVES = ['@if', '@else', '@for', '@empty', '@await', '@then', '@catch', '@slot', '@import', '@input', '@model', '@type', '@interface']
const Kind = { Property: 10, Event: 23, Keyword: 14, File: 17, Class: 7, Module: 9, Value: 12 } as const

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
    return list(project.importsOf(path).filter((i) => i.name.startsWith(ctx.prefix)).map((i) => ({ label: i.name, kind: Kind.Class, detail: `Component from ${i.specifier}`, textEdit: { range: range(ctx.start, offset + /^[\w:.-]*/.exec(text.slice(offset))![0].length), newText: i.name } }))) // the whole name, typed in its middle
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
  // <icon name="…">: the installed sets, then the icons of the chosen set (a component imported as icon wins).
  if (ctx.kind === 'attr-value' && ctx.tag === 'icon' && ctx.attr === 'name' && project.compiler.checkIcons && !importNamed(project, path, 'icon')) {
    // The whole value, the cursor anywhere in it: an edit replaces the word it's in, not just what's before the cursor.
    const close = text.indexOf(text[ctx.start - 1]!, ctx.start)
    const value = text.slice(ctx.start, close === -1 ? offset : close)
    const colon = ctx.prefix.indexOf(':')
    if (colon === -1) {
      const after = value.indexOf(':') // a set already followed by :icon keeps its colon
      return list(iconSets(path).filter((s) => s.prefix.startsWith(ctx.prefix)).map((s) => ({
        label: s.prefix,
        kind: Kind.Module,
        detail: `${s.name} · ${s.total} icons`,
        textEdit: { range: range(ctx.start, ctx.start + (after === -1 ? value.length : after)), newText: after === -1 ? `${s.prefix}:` : s.prefix },
        ...(after === -1 ? { command: { title: 'Icons', command: 'editor.action.triggerSuggest' } } : {}),
      })))
    }
    const set = ctx.prefix.slice(0, colon)
    const typed = ctx.prefix.slice(colon + 1)
    return list(iconNames(set, path).filter((n) => n.startsWith(typed)).map((n) => ({ label: n, kind: Kind.Value, detail: set, textEdit: { range: range(ctx.start + colon + 1, ctx.start + value.length), newText: n } })))
  }
  if (ctx.kind === 'import-path') {
    const dir = dirname(path)
    const specifiers = project.files().filter((f) => f.endsWith('.tscl') && f !== path).map((f) => { const r = relative(dir, f).split(sep).join('/'); return r.startsWith('.') ? r : `./${r}` })
    return list(specifiers.filter((s) => s.startsWith(ctx.prefix)).map((s) => ({ label: s, kind: Kind.File, textEdit: { range: range(ctx.start, ctx.end), newText: s } })))
  }
  return list([])
}

/** The component tag (open or close) whose name covers `offset`, with its name's range. */
const tagAt = (text: string, offset: number) => tagsIn(text).find((t) => offset >= t.start && offset <= t.end)

export function hover(project: Project, path: string, text: string, offset: number): Hover | undefined {
  const icon = iconAt(project, path, text, offset)
  if (icon) return icon
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

/** Hover on `<icon name="set:name">`: a preview of the icon and its name. */
function iconAt(project: Project, path: string, text: string, offset: number): Hover | undefined {
  if (!project.compiler.checkIcons || importNamed(project, path, 'icon')) return undefined
  // The value of name="…" on an <icon> (either quote), the cursor in it: the same reading as completion.
  const ctx = contextAt(text, offset)
  if (ctx.kind !== 'attr-value' || ctx.tag !== 'icon' || ctx.attr !== 'name') return undefined
  const close = text.indexOf(text[ctx.start - 1]!, ctx.start)
  const name = text.slice(ctx.start, close === -1 ? offset : close)
  let found: ReturnType<typeof resolveIcon>
  try {
    found = resolveIcon(name, path)
  } catch {
    return undefined // an icon <icon> can't draw yet (a rotated alias): the diagnostic says so
  }
  if (!('data' in found)) return undefined
  // A grey that shows on light and dark editors, for icons drawn in the text colour.
  const svg = iconSvg(found.data, 'width="48" height="48"').replaceAll('currentColor', '#888')
  const value = `![${name}](data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')})\n\n\`${name}\``
  return { contents: { kind: 'markdown', value }, range: { start: positionAt(text, ctx.start), end: positionAt(text, ctx.start + name.length) } }
}
