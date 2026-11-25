// Template lint (#304): rules only clarusjs understands, located like compile errors. Pure: a source string in,
// findings out. `clarusjs check` reports them, and editors show them through the language server. Each rule is a
// LintRuleDef: the built-in ones below, and a project's own (the plugin's `lintRules`).

import { ClarusError } from './errors.ts'
import { awaitLists, importNames, parse, rootNodes, type Attr, type ParsedFile, type TemplateNode } from './parse.ts'

/**
 * The built-in rules' names.
 * @see https://clarusjs.com/guide/lint#rules
 */
export type LintRule = 'unused-input' | 'unused-import' | 'img-alt' | 'label-field' | 'accessible-name' | 'one-root'
/**
 * Each rule's level, built-in or a project's, keyed by rule name.
 * @see https://clarusjs.com/guide/lint#warnings-and-errors
 */
export type LintConfig = Partial<Record<LintRule, LintLevel>> & Record<string, LintLevel>
/**
 * A rule's level: 'warn' (the default), 'error', or 'off'.
 * @see https://clarusjs.com/guide/lint#warnings-and-errors
 */
export type LintLevel = 'off' | 'warn' | 'error'
/**
 * A finding, at its 1-based line and column (`start`: its offset in the source).
 * @see https://clarusjs.com/reference/compiler#lint
 */
export type LintMessage = { rule: string; severity: 'warning' | 'error'; message: string; file: string; line: number; column: number; start: number; fix?: LintFix }
/**
 * An edit that fixes a finding: the source from `start` to `end` (offsets) becomes `text`. `clarusjs check --fix` and
 * the ESLint plugin apply them.
 * @since 0.16.0
 * @see https://clarusjs.com/guide/lint#fixes
 */
export type LintFix = { start: number; end: number; text: string }
/**
 * A template element, as `parse` returns it.
 * @see https://clarusjs.com/guide/lint#writing-a-rule
 */
export type LintElement = Extract<TemplateNode, { type: 'element' }>

/**
 * What a rule's check() gets: the file, its syntax tree, every element in it, and report().
 * @see https://clarusjs.com/guide/lint#writing-a-rule
 */
export type LintContext = {
  file: string
  source: string
  parsed: ParsedFile
  /** Every element, in branches, rows, empty content and slot fills too, in source order. */
  elements: LintElement[]
  /** The names of the components this file imports (their tags). */
  components: Set<string>
  /** Whether the template, the script, or an input's type or default reads `name`. */
  reads(name: string): boolean
  /** A finding at `start`, an offset in the source (an element's, an attribute's, an @input's). */
  report(start: number, message: string, fix?: LintFix): void
}
/**
 * A lint rule: a name (used in levels and ignore comments) and a check over one file.
 * @see https://clarusjs.com/guide/lint#writing-a-rule
 */
export type LintRuleDef = { name: string; check(context: LintContext): void }

const FIELDS = new Set(['input', 'select', 'textarea', 'meter', 'output', 'progress'])
const IGNORE_RE = /\{\{--\s*clarusjs-ignore\b([\w\s,-]*?)\s*--\}\}/g

function* elements(nodes: TemplateNode[]): Generator<LintElement> {
  for (const n of nodes) {
    if (n.type === 'element') { yield n; yield* elements(n.children) }
    else if (n.type === 'if') for (const b of n.branches) yield* elements(b.children)
    else if (n.type === 'for') { yield* elements(n.children); if (n.empty) yield* elements(n.empty) }
    else if (n.type === 'fill') yield* elements(n.children)
    else if (n.type === 'await') for (const kids of awaitLists(n)) yield* elements(kids)
  }
}

/** Every expression a template reads, as text: holes, bindings, conditions, lists. */
function* expressions(nodes: TemplateNode[]): Generator<string> {
  for (const n of nodes) {
    if (n.type === 'expr') yield n.expr
    else if (n.type === 'element') {
      for (const a of n.attrs) {
        if (a.kind === 'interp') for (const p of a.parts) { if (typeof p !== 'string') yield p.expr }
        else if (a.kind !== 'static') yield a.expr
      }
      yield* expressions(n.children)
    } else if (n.type === 'if') for (const b of n.branches) { if (b.cond) yield b.cond; yield* expressions(b.children) }
    else if (n.type === 'for') { yield n.list; if (n.track) yield n.track; yield* expressions(n.children); if (n.empty) yield* expressions(n.empty) }
    else if (n.type === 'fill') yield* expressions(n.children)
    else if (n.type === 'await') { yield n.expr; for (const kids of awaitLists(n)) yield* expressions(kids) }
  }
}

const has = (el: LintElement, name: string) => el.attrs.some((a: Attr) => a.name === name)
const labelled = (el: LintElement) => has(el, 'aria-label') || has(el, 'aria-labelledby') || has(el, 'title')

/** Whether content gives a name: text, a hole, a labelled descendant, or content lint can't see (a component, a slot). */
function named(nodes: TemplateNode[], components: Set<string>): boolean {
  return nodes.some((n) => {
    if (n.type === 'text') return n.value.trim() !== ''
    if (n.type === 'expr' || n.type === 'raw') return true
    if (n.type === 'if') return n.branches.some((b) => named(b.children, components))
    if (n.type === 'for') return named(n.children, components)
    if (n.type === 'await') return awaitLists(n).some((kids) => named(kids, components))
    if (n.type !== 'element') return false
    if (components.has(n.tag) || n.tag === 'slot' || n.tag === 'title' || labelled(n)) return true
    if (n.tag === 'img') return n.attrs.some((a) => a.name === 'alt' && !(a.kind === 'static' && (a.value === true || a.value.trim() === '')))
    return named(n.children, components)
  })
}

/**
 * The built-in rules, each written as a project's own would be.
 * @example
 * ```ts
 * import { lintRules } from 'clarusjs/compiler'
 * console.log(lintRules.map((r) => r.name)) // ['unused-input', 'unused-import', …]
 * ```
 * @see https://clarusjs.com/guide/lint#rules
 */
export const lintRules: LintRuleDef[] = [
  {
    // A component renders one root, so what a parent passes (attributes, class, events) has one place to land (Vue's
    // rule): one element, a <fragment>, a <slot />, or an @if … @else whose branches are one element each. Pages,
    // layouts and whole documents are exempt. ponytail: a warning for now; an error in the next minor. Layouts are known
    // by their folder: a config layout kept elsewhere is warned about; pass lint the layout list when one needs it.
    name: 'one-root',
    check({ file, source, parsed, report }) {
      if (/(^|[\\/])(pages|layouts)[\\/]/.test(file)) return
      const top = rootNodes
      const nodes = top(parsed.nodes)
      if (nodes.some((n) => n.type === 'element' && n.tag === 'html')) return
      const element = (list: TemplateNode[]) => list.length === 1 && list[0]!.type === 'element'
      if (element(nodes)) return
      // In a branch, a <fragment> is several elements, not one.
      const one = (list: TemplateNode[]) => element(list) && (list[0] as { tag: string }).tag !== 'fragment'
      const [first] = nodes
      if (nodes.length === 1 && first!.type === 'if' && first!.branches.at(-1)!.cond === null && first!.branches.every((b) => one(top(b.children)))) return
      const at = nodes.length > 1 && (first!.type === 'element') ? nodes[1]! : first
      if (!at) return
      // The fix wraps the roots in <fragment>: the same HTML. Not re-indented (that would change a <pre>'s text).
      const last = nodes.at(-1)!
      const blocks = [...parsed.styles.map((st) => st.tag), parsed.serverScript?.tag ?? -1, parsed.script ? source.lastIndexOf('<script', parsed.script.start) : -1]
      const after = [...parsed.nodes.map((n) => n.start), ...blocks].filter((x) => x > last.start)
      const rawEnd = after.length ? Math.min(...after) : source.length
      const end = source.slice(0, rawEnd).trimEnd().length
      // A <script>, <style> or declaration (@input, any @import, @event…) between the roots moves above them, in order:
      // inside a <fragment> it would no longer be the component's, and at the top level its place doesn't matter.
      // Every declaration the parser keeps: each field but the template (scripts and styles by their tags, above).
      const declared = Object.entries(parsed).flatMap(([key, value]) => {
        if (['nodes', 'script', 'serverScript', 'styles'].includes(key)) return []
        if (typeof value === 'number') return [value] // layoutStart
        const items: unknown[] = Array.isArray(value) ? value : [value]
        return items.flatMap((d) => (d && typeof d === 'object' && typeof (d as { start?: unknown }).start === 'number' ? [(d as { start: number }).start] : []))
      })
      const inside = (x: number) => x > first!.start && x < end
      const moving = new Set([...blocks, ...declared].filter(inside))
      // The span cut where each top-level thing starts; each piece runs to the next.
      const cuts = [...new Set([first!.start, ...parsed.nodes.map((n) => n.start).filter(inside), ...moving])].sort((a, b) => a - b)
      const pieces = cuts.map((c, i) => ({ c, text: source.slice(c, cuts[i + 1] ?? end) }))
      const nl = source.includes('\r\n') ? '\r\n' : '\n'
      const moved = pieces.filter((p) => moving.has(p.c)).map((p) => p.text.trimEnd() + nl).join('')
      // The whitespace before a declaration or <script> isn't part of the template: it goes with what moves. A line
      // break takes its place between two nodes that aren't text (a root <fragment> drops it); next to text it'd join it.
      const typeAt = new Map(parsed.nodes.map((n) => [n.start, n.type]))
      const stay = pieces.filter((p) => !moving.has(p.c))
      const kept = stay.map((p, i) => {
        const next = stay[i + 1]
        if (!next || next.c === pieces[pieces.indexOf(p) + 1]?.c || typeAt.get(p.c) === 'text') return p.text // text: its end is rendered
        const text = p.text.trimEnd()
        return typeAt.get(p.c) !== 'text' && typeAt.get(next.c) !== 'text' ? text + nl : text
      }).join('').trimEnd()
      // A line break before </fragment>, except after text that had none: it would become part of that text.
      const close = last.type !== 'text' || source.slice(end, rawEnd).includes('\n') ? nl : ''
      const fix = { start: first!.start, end, text: `${moved}<fragment>${nl}${kept}${close}</fragment>` }
      report(at.start, 'a component renders one root element, for what a parent passes it (attributes, class, events) to land on: wrap these in an element, or in <fragment> if no element is wanted', fix)
    },
  },
  {
    name: 'unused-input',
    check({ parsed, reads, report }) {
      for (const i of parsed.inputs) if (!reads(i.name)) report(i.start, `@${i.model ? 'model' : 'input'} ${i.name} is never used`)
    },
  },
  {
    name: 'unused-import',
    check({ parsed, elements, reads, report }) {
      const tags = new Set(elements.map((e) => e.tag))
      for (const i of parsed.imports) if (!tags.has(i.name) && !reads(i.name)) report(i.start, `'${i.name}' is imported but never used as <${i.name}>`)
      for (const d of parsed.dataImports) {
        const unused = importNames(d.clause).filter((name) => !reads(name))
        if (unused.length) report(d.start, `${unused.map((n) => `'${n}'`).join(', ')} ${unused.length === 1 ? 'is' : 'are'} imported but never used`)
      }
    },
  },
  {
    name: 'img-alt',
    check({ elements, report }) {
      for (const el of elements) if (el.tag === 'img' && !has(el, 'alt')) report(el.start, '<img> without alt: describe the image, or use alt="" when it is decoration')
    },
  },
  {
    name: 'label-field',
    check({ elements: all, components, report }) {
      for (const el of all) {
        if (el.tag !== 'label' || has(el, 'for')) continue
        // A component or a slot inside may render the field: given the benefit of the doubt.
        if (![...elements(el.children)].some((e) => FIELDS.has(e.tag) || components.has(e.tag) || e.tag === 'slot')) {
          report(el.start, '<label> names no field: put the field inside it, or point to one with for="id"')
        }
      }
    },
  },
  {
    name: 'accessible-name',
    check({ elements, components, report }) {
      for (const el of elements) {
        if (el.tag !== 'button' && !(el.tag === 'a' && has(el, 'href'))) continue
        if (!labelled(el) && !named(el.children, components)) report(el.start, `<${el.tag}> has no accessible name: give it text, aria-label or title`)
      }
    },
  },
]

/**
 * Lint a `.tscl` file's template with the built-in rules and `extra` ones, at the levels in `config`. Throws a
 * located `ClarusError` for a syntax error, as `parse` does.
 * @example
 * ```ts
 * import { lint } from 'clarusjs/compiler'
 * for (const m of lint(source, 'src/components/card.tscl')) console.log(`${m.line}:${m.column} ${m.rule}: ${m.message}`)
 * ```
 * @see https://clarusjs.com/reference/compiler#lint
 */
export function lint(source: string, file: string, config: LintConfig = {}, extra: LintRuleDef[] = []): LintMessage[] {
  const parsed = parse(source, file)
  // Everything that can read a name: the template's expressions, the script, input types and defaults, type aliases.
  const corpus = [
    ...expressions(parsed.nodes),
    parsed.script?.code ?? '',
    parsed.serverScript?.code ?? '', // #430
    ...parsed.inputs.flatMap((i) => [i.type, i.default ?? '']),
    ...parsed.types.map((t) => t.type),
  ].join('\n')
  const lineOf = (offset: number) => source.slice(0, offset).split('\n').length
  // Lines a {{-- clarusjs-ignore [rules] --}} comment covers: its own and the next, for the rules it names (or all).
  const ignored = new Map<number, Set<string> | 'all'>()
  for (const m of source.matchAll(IGNORE_RE)) {
    const names = m[1]!.split(/[\s,]+/).filter(Boolean)
    const line = lineOf(m.index + m[0].length)
    for (const l of [line, line + 1]) ignored.set(l, names.length ? new Set(names) : 'all')
  }
  const base = {
    file,
    source,
    parsed,
    elements: [...elements(parsed.nodes)],
    components: new Set(parsed.imports.map((i) => i.name)),
    reads: (name: string) => new RegExp(`(?<![\\w$.])${name.replace(/\$/g, '\\$')}(?![\\w$])`).test(corpus),
  }

  const out: LintMessage[] = []
  const add = (rule: string, severity: LintMessage['severity'], start: number, message: string, fix?: LintFix) => {
    const { line, column } = new ClarusError(message, file, source, start)
    const skip = ignored.get(line)
    if (skip === 'all' || skip?.has(rule)) return
    out.push({ rule, severity, message, file, line, column, start, ...(fix ? { fix } : {}) })
  }
  for (const rule of [...lintRules, ...extra]) {
    const level = config[rule.name] ?? 'warn'
    if (level === 'off') continue
    try {
      rule.check({ ...base, report: (start, message, fix) => add(rule.name, level === 'error' ? 'error' : 'warning', start, message, fix) })
    } catch (err) {
      // A project's rule with a bug: said where it shows, rather than ending check or the editor's diagnostics.
      add(rule.name, 'error', 0, `the rule failed: ${(err as Error).message}`)
    }
  }
  return out.sort((a, b) => a.start - b.start)
}

/**
 * The source with the findings' fixes applied. Overlapping fixes: the first one (by position) wins; run lint again for
 * the rest.
 * @example
 * ```ts
 * import { applyFixes, lint } from 'clarusjs/compiler'
 * const fixed = applyFixes(source, lint(source, 'src/components/card.tscl'))
 * ```
 * @since 0.16.0
 * @see https://clarusjs.com/reference/compiler#applyfixes
 */
export function applyFixes(source: string, messages: readonly LintMessage[]): string {
  const fixes = messages.flatMap((m) => (m.fix ? [m.fix] : [])).sort((a, b) => a.start - b.start)
  const kept: LintFix[] = []
  for (const f of fixes) if (!kept.length || f.start >= kept.at(-1)!.end) kept.push(f)
  return kept.reduceRight((text, f) => text.slice(0, f.start) + f.text + text.slice(f.end), source)
}
