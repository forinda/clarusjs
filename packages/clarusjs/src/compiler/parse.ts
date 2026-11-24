// .tscl source → syntax tree. Pure: no file system, no JS parsing (expressions are kept as raw strings).
import { ClarusError } from './errors.ts'

/**
 * An attribute in the syntax tree: static, an event `(x)`, a prop `[x]`, a two-way binding `[(x)]`, or a value with
 * `{{ }}` holes. `start`: its offset in the source.
 * @see https://clarusjs.com/reference/compiler#parse
 */
export type Attr =
  | { kind: 'static'; name: string; value: string | true; start: number }
  | { kind: 'event'; name: string; expr: string; start: number } // (click)="..."
  | { kind: 'prop'; name: string; expr: string; start: number } // [start]="..."
  | { kind: 'model'; name: string; expr: string; start: number } // [(value)]="form.name": two-way binding
  | { kind: 'interp'; name: string; parts: (string | { expr: string; start: number })[]; start: number } // a="x {{ y }}"
/** An @await's lists of children: pending, then @then's and @catch's (those it has). */
export const awaitLists = (n: Extract<TemplateNode, { type: 'await' }>): TemplateNode[][] => [n.pending, ...(n.then ? [n.then.children] : []), ...(n.catch ? [n.catch.children] : [])]

/** An @await's @then or @catch: the name it binds, and its content. */
export type AwaitBranch = { name: string; nameStart: number; children: TemplateNode[] }

/**
 * A node of a template's syntax tree: an element, text, a `{{ }}` hole, an `@if`, an `@for`, a slot fill…
 * @see https://clarusjs.com/reference/compiler#parse
 */
export type TemplateNode =
  | { type: 'element'; tag: string; attrs: Attr[]; children: TemplateNode[]; start: number }
  | { type: 'text'; value: string; start: number }
  | { type: 'expr'; expr: string; start: number; json?: true } // {{ expr }}; json: written as JSON (JSON-LD)
  | { type: 'raw'; value: string; start: number } // content of a `verbatim` element, shown as text
  | { type: 'if'; branches: { cond: string | null; condStart: number; children: TemplateNode[] }[]; start: number }
  // @await (promise) { pending } @then (value) { … } @catch (error) { … } (#430)
  | { type: 'await'; expr: string; exprStart: number; pending: TemplateNode[]; then: AwaitBranch | null; catch: AwaitBranch | null; start: number }
  // @slot('name') { … } inside a component tag; @slot('name', { item }) { … } names what the slot passes (#455).
  | { type: 'fill'; name: string; params?: string; paramsStart?: number; children: TemplateNode[]; start: number }
  | { type: 'for'; item: string; list: string; track: string | null; headStart: number; itemStart: number; listStart: number; trackStart: number; children: TemplateNode[]; empty: TemplateNode[] | null; start: number }
// model: declared with @model, the one kind of input a component may write (two-way binding, [(name)] at the use site).
/**
 * An `@input` (or `@model`) declaration: its name, type text, default, and offsets.
 * @see https://clarusjs.com/reference/compiler#parse
 */
export type InputDecl = { name: string; type: string; default?: string; start: number; nameStart: number; typeStart: number; defaultStart?: number; model?: true }
// @import type { A, B } from '…': types for @input declarations (erased from compiled output, used by type checking).
export type TypeImport = { clause: string; from: string; start: number; clauseStart: number }
// @import { a, b } from '…' or @import data from './x.json': values a template uses. Server-only in components
// without a script; bundled for the browser in islands.
export type DataImport = { clause: string; from: string; start: number; clauseStart: number }
/**
 * A component `@import`: the name it's used by in the template, and where it comes from.
 * @see https://clarusjs.com/reference/compiler#parse
 */
export type ImportDecl = { name: string; from: string; start: number }
/**
 * An `@event` declaration (#442): the event's name and the type of the value it sends, with their offsets.
 * @see https://clarusjs.com/guide/events#from-a-child-island-to-its-parent
 */
export type EventDecl = { name: string; type: string; start: number; nameStart: number; typeStart: number }
// @type Name = … and @interface Name { … }: types for the file's @input props. Local: other files see them only
// through the component's props; types to share go in a .ts file. Erased from compiled output, used by type checking.
// `type`: what follows the name (and its type parameters): the aliased type, or the interface's `extends … { … }`.
export type TypeDecl = { kind: 'type' | 'interface'; name: string; params?: string; type: string; start: number; nameStart: number; typeStart: number }
/**
 * A `.tscl` file's syntax tree, as `parse()` gives it: inputs, imports, the script, styles and template nodes.
 * @see https://clarusjs.com/reference/compiler#parse
 */
export type ParsedFile = {
  inputs: InputDecl[]
  /** `@event change: string` (#442): what the component sends its parent, and its value's type ('void' when none). */
  events: EventDecl[]
  /** `@context tabs: Type` (#465): values a component around this one provides; same shape as an @input. */
  contexts: InputDecl[]
  imports: ImportDecl[]
  typeImports: TypeImport[]
  types: TypeDecl[]
  dataImports: DataImport[]
  script?: { code: string; start: number } // start = offset of the first char inside <script>
  /** <script server> (#430): runs at render on the server only. `tag` = offset of `<script`. */
  serverScript?: { code: string; start: number; tag: number }
  // Top-level <style> blocks: `scoped` ones are scoped to the component; `global` and `plain` (no attribute) aren't.
  // `tag`: where the <style> tag starts.
  styles: { css: string; mode: 'scoped' | 'global' | 'plain'; start: number; tag: number }[]
  cssImports: { from: string; start: number }[] // @import './x.css': stylesheets the component needs
  /** `@layout none` (#456): the page renders without its folder and config layouts. `layoutStart`: where it is. */
  layout?: 'none'
  layoutStart?: number
  /** `@extends button`: the native element this component stands for; it takes all of that element's attributes. */
  extends?: { tag: string; start: number }
  nodes: TemplateNode[]
}

/** The names a @for row has besides its item: $index, $count, $first, $last, $even, $odd. */
export const FOR_IMPLICIT = ['$index', '$count', '$first', '$last', '$even', '$odd']
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])
const DATA_IMPORT_RE = /^@import\s+(\{[^}]*\})\s+from\s+(['"])(.+?)\2\s*$/d
const IMPORT_TYPE_RE = /^@import\s+type\s+(\{[^}]*\}|[A-Za-z_$][\w$]*)\s+from\s+(['"])(.+?)\2\s*$/d
const IMPORT_RE = /^@import\s+([A-Za-z_$][\w-]*)\s+from\s+(['"])(.+?)\2\s*$/
const CSS_IMPORT_RE = /^@import\s+(['"])(.+?)\1\s*$/

/** The local names an `@import type` clause brings in: `{ A, B as C }` → A, C; `D` → D. */
const typeNames = (clause: string) =>
  clause.startsWith('{') ? clause.slice(1, -1).split(',').map((p) => p.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop()!.trim()).filter(Boolean) : [clause.trim()]

/**
 * A template's top-level nodes that render: no whitespace, no <cl-head>, <script> or <style>. What one-root, @extends,
 * fragment roots and check all look at.
 * @internal
 */
export function rootNodes(nodes: TemplateNode[]): TemplateNode[] {
  return nodes.filter((n) => !(n.type === 'text' && !n.value.trim()) && !(n.type === 'element' && ['cl-head', 'script', 'style'].includes(n.tag)))
}

/**
 * Whether a component's root is (or may be) a <fragment>: one at the top, or in a branch of a top-level @if. It
 * renders no single element, so a parent's attributes and events have nowhere to land.
 * @internal
 */
export function fragmentRoot(nodes: TemplateNode[]): boolean {
  const top = rootNodes(nodes)
  const frag = (list: TemplateNode[]) => list.length === 1 && list[0]!.type === 'element' && list[0]!.tag === 'fragment'
  return frag(top) || (top.length === 1 && top[0]!.type === 'if' && top[0]!.branches.some((b) => frag(rootNodes(b.children))))
}

/**
 * Parse a `.tscl` file into its syntax tree, without compiling it: for tools (an editor, a linter, a docs
 * generator). Throws a located `ClarusError` for a syntax error.
 * @example
 * ```ts
 * import { parse } from 'clarusjs/compiler'
 * const { inputs, imports } = parse(source, 'src/components/card.tscl')
 * console.log(inputs.map((i) => `${i.name}: ${i.type}`))
 * ```
 * @see https://clarusjs.com/reference/compiler#parse
 */
export function parse(source: string, file: string): ParsedFile {
  const out: ParsedFile = { inputs: [], events: [], contexts: [], imports: [], typeImports: [], types: [], dataImports: [], styles: [], cssImports: [], nodes: [] }
  let i = 0
  const fail = (text: string, at: number): never => { throw new ClarusError(text, file, source, at) }
  const atLineStart = (at: number) => /^[ \t]*$/.test(source.slice(source.lastIndexOf('\n', at - 1) + 1, at))

  function directive(): void {
    const end = source.indexOf('\n', i) === -1 ? source.length : source.indexOf('\n', i)
    const lineStart = i + (source.slice(i, end).length - source.slice(i, end).trimStart().length)
    const line = source.slice(i, end).trim()
    let m: RegExpExecArray | RegExpMatchArray | null
    if (/^@(input|model|context)\s/.test(line)) {
      return inputDecl(lineStart, line.startsWith('@model'), line.startsWith('@context'))
    } else if (/^@(type|interface)\s/.test(line)) {
      return typeDecl(lineStart)
    } else if ((m = IMPORT_TYPE_RE.exec(line))) {
      out.typeImports.push({ clause: m[1]!, from: m[3]!, start: i, clauseStart: lineStart + (m as RegExpExecArray).indices![1]![0] })
    } else if ((m = DATA_IMPORT_RE.exec(line))) {
      out.dataImports.push({ clause: m[1]!, from: m[3]!, start: i, clauseStart: lineStart + (m as RegExpExecArray).indices![1]![0] })
    } else if ((m = line.match(IMPORT_RE))) {
      // A default import of a .tscl file is a component; of anything else, data.
      if (m[3]!.endsWith('.tscl')) out.imports.push({ name: m[1]!, from: m[3]!, start: i })
      else out.dataImports.push({ clause: m[1]!, from: m[3]!, start: i, clauseStart: lineStart + line.indexOf(m[1]!, 7) })
    }
    else if ((m = CSS_IMPORT_RE.exec(line))) {
      if (!/\.css(\?|$)/.test(m[2]!)) fail(`@import without a name only takes a stylesheet (.css): "${m[2]}"`, i)
      out.cssImports.push({ from: m[2]!, start: i })
    }
    else if (/^@event(\s|$)/.test(line)) {
      const d = /^@event\s+([A-Za-z_$][\w$-]*)\s*(?::\s*(\S[\s\S]*?))?\s*$/.exec(line)
      if (!d) fail('@event takes a name and the type of its value: @event change: string (or @event close for none)', i)
      const nameStart = lineStart + line.indexOf(d![1]!, 6)
      const typeStart = d![2] ? lineStart + line.lastIndexOf(d![2]!) : nameStart
      out.events.push({ name: d![1]!, type: d![2] ?? 'void', start: i, nameStart, typeStart })
    }
    else if ((m = /^@extends(?:\s+(\S+))?\s*$/.exec(line))) {
      if (out.extends) fail('a component has one @extends', i)
      if (!m[1]) fail('@extends takes an element name: @extends button', i)
      out.extends = { tag: m[1]!, start: i }
    } else if ((m = /^@layout(?:\s+(\S+))?\s*$/.exec(line))) {
      if (m[1] !== 'none') fail('@layout only takes none: @layout none renders the page without its folder and config layouts', i)
      out.layout = 'none'
      out.layoutStart = i
    }
    else fail(`unknown or malformed directive "${line.split(/\s/)[0]}"`, i)
    i = end
  }

  /** Where a type ends: the first line end outside brackets ((), [], {}), skipping string and template literals. */
  function typeEnd(from: number, what: string, angles = false): number {
    const open: string[] = []
    for (let j = from; j <= source.length; j++) {
      const c = source[j]
      if (c === undefined || (c === '\n' && !open.length)) {
        if (open.length) fail(`${what}: unclosed ${open[0]}`, i)
        return j
      }
      if (c === "'" || c === '"' || c === '`') {
        for (j++; j < source.length && source[j] !== c; j++) if (source[j] === '\\') j++
      } else if (c === '(' || c === '[' || c === '{' || (angles && c === '<')) open.push(c)
      else if (c === ')' || c === ']' || c === '}' || (angles && c === '>' && source[j - 1] !== '=')) open.pop()
    }
    return source.length
  }

  /**
   * @input name: type = default. The type runs to the first '=' outside brackets that isn't part of '=>'; type and
   * default continue onto the next lines while a bracket is open (an object type, a function, a default object).
   */
  function inputDecl(lineStart: number, model: boolean, context = false): void {
    const directive = context ? '@context' : model ? '@model' : '@input'
    const malformed = () => fail(`unknown or malformed directive "${directive}"`, i)
    let pos = lineStart + directive.length
    while (source[pos] === ' ' || source[pos] === '\t') pos++
    const name = /^[A-Za-z_$][\w$]*/.exec(source.slice(pos))?.[0] ?? malformed()
    const nameStart = pos
    pos += name.length
    while (source[pos] === ' ' || source[pos] === '\t') pos++
    if (source[pos] !== ':') malformed()
    pos++
    while (source[pos] === ' ' || source[pos] === '\t') pos++
    const typeStart = pos
    const open: string[] = []
    let j = pos
    for (; j < source.length; j++) {
      const c = source[j]!
      if (c === '\n' && !open.length) break
      if (c === "'" || c === '"' || c === '`') {
        for (j++; j < source.length && source[j] !== c; j++) if (source[j] === '\\') j++
      } else if ('([{<'.includes(c)) open.push(c)
      else if (')]}'.includes(c) || (c === '>' && source[j - 1] !== '=')) open.pop()
      else if (c === '=' && !open.length && source[j + 1] !== '>' && source[j + 1] !== '=') break
    }
    if (open.length) fail(`@input ${name}: unclosed ${open[0]}`, i)
    const type = source.slice(typeStart, j).trim()
    if (!type) malformed()
    let end = j
    let fallback: { default: string; defaultStart: number } | undefined
    if (source[j] === '=') {
      let at = j + 1
      while (source[at] === ' ' || source[at] === '\t') at++
      end = typeEnd(at, `@input ${name}`)
      const value = source.slice(at, end).trim()
      if (!value) malformed()
      fallback = { default: value, defaultStart: at }
    }
    ;(context ? out.contexts : out.inputs).push({ name, type, start: i, nameStart, typeStart, ...fallback, ...(model ? { model: true as const } : {}) })
    i = end
  }

  /** @type Name<P> = type, or @interface Name<P> extends … { … }: on one line, or on more while a bracket is open. */
  function typeDecl(lineStart: number): void {
    const kind = source.startsWith('@interface', lineStart) ? 'interface' : 'type'
    const malformed = () => fail(`unknown or malformed directive "@${kind}"`, i)
    let pos = lineStart + kind.length + 1
    while (source[pos] === ' ' || source[pos] === '\t') pos++
    const name = /^[A-Za-z_$][\w$]*/.exec(source.slice(pos))?.[0] ?? malformed()
    const nameStart = pos
    pos += name.length
    let params: string | undefined
    if (source[pos] === '<') {
      // Type parameters, with their constraints and defaults: to the matching '>' (one in '=>' doesn't count).
      let depth = 0
      let end = pos
      for (; end < source.length; end++) {
        if (source[end] === '<') depth++
        else if (source[end] === '>' && source[end - 1] !== '=' && --depth === 0) break
        else if (source[end] === '\n') malformed()
      }
      params = source.slice(pos, end + 1)
      pos = end + 1
    }
    while (source[pos] === ' ' || source[pos] === '\t') pos++
    if (kind === 'type') {
      if (source[pos] !== '=') malformed()
      pos++
      while (source[pos] === ' ' || source[pos] === '\t') pos++
    }
    const end = typeEnd(pos, `@${kind} ${name}`, true) // type arguments (Array<…>) may span lines too
    const type = source.slice(pos, end).trimEnd().replace(/;$/, '').trimEnd()
    if (!type || (kind === 'interface' && !type.includes('{'))) malformed()
    if (out.types.some((t) => t.name === name)) fail(`@type ${name} is declared twice`, i)
    if (out.typeImports.some((t) => typeNames(t.clause).includes(name))) fail(`@type ${name} is already imported with @import type`, i)
    out.types.push({ kind, name, ...(params ? { params } : {}), type, start: i, nameStart, typeStart: pos })
    i = end
  }

  function attrs(): Attr[] {
    const list: Attr[] = []
    for (;;) {
      while (/\s/.test(source[i] ?? '')) i++
      if (i >= source.length) return list
      if (source[i] === '>' || source.startsWith('/>', i)) return list
      const start = i
      const name = source.slice(i).match(/^[^\s=/>"']+/)?.[0] ?? fail('expected an attribute name', i)
      i += name.length
      let value: string | true = true
      if (source[i] === '=') {
        if (source[i + 1] !== '"') fail('attribute values must be double-quoted', i + 1)
        const close = source.indexOf('"', i + 2)
        if (close === -1) fail('unclosed attribute value', i + 1)
        value = source.slice(i + 2, close)
        i = close + 1
      }
      if (name.startsWith('(') && name.endsWith(')')) {
        if (value === true) fail(`event binding ${name} needs a handler`, start)
        list.push({ kind: 'event', name: name.slice(1, -1), expr: (value as string).trim(), start })
      } else if (name.startsWith('[(') && name.endsWith(')]')) {
        if (value === true) fail(`two-way binding ${name} needs a variable or property path`, start)
        list.push({ kind: 'model', name: name.slice(2, -2), expr: (value as string).trim(), start })
      } else if (name.startsWith('[') && name.endsWith(']')) {
        if (value === true) fail(`binding ${name} needs an expression`, start)
        list.push({ kind: 'prop', name: name.slice(1, -1), expr: (value as string).trim(), start })
      } else {
        if (typeof value === 'string' && value.includes('{{')) {
          // Split into literal text and {{ expr }} parts; valueStart is the offset of the value's first character.
          const valueStart = start + name.length + 2
          const parts: (string | { expr: string; start: number })[] = []
          let at = 0
          while (at < value.length) {
            const open = value.indexOf('{{', at)
            if (open === -1) { parts.push(value.slice(at)); break }
            if (open > at) parts.push(value.slice(at, open))
            const close = value.indexOf('}}', open + 2)
            if (close === -1) fail('unclosed {{ in attribute value', valueStart + open)
            parts.push({ expr: value.slice(open + 2, close).trim(), start: valueStart + open })
            at = close + 2
          }
          list.push({ kind: 'interp', name, parts, start })
        } else {
          list.push({ kind: 'static', name, value, start })
        }
      }
    }
  }

  // Find the `}}` that closes a hole, skipping strings, template literals and nested brackets.
  // ponytail: regex literals containing quotes or braces are not recognised; tokenise with acorn if that ever bites
  function holeEnd(from: number): number {
    const stack: string[] = []
    for (let j = from; j < source.length; j++) {
      const c = source[j]!
      const top = stack[stack.length - 1]
      if (top === '`') {
        if (c === '\\') j++
        else if (c === '`') stack.pop()
        else if (c === '$' && source[j + 1] === '{') { stack.push('${'); j++ }
        continue
      }
      if (c === '"' || c === "'") {
        for (j++; j < source.length && source[j] !== c; j++) if (source[j] === '\\') j++
      } else if (c === '`') stack.push('`')
      else if (c === '(' || c === '[' || c === '{') stack.push(c)
      else if (c === ')' || c === ']') stack.pop()
      else if (c === '}') {
        if (!stack.length && source[j + 1] === '}') return j
        stack.pop()
      }
    }
    return -1
  }

  // Parse children until `</parent>` (or end of input at top level).
  // A parenthesised JS condition after `@if` / `@else if`, skipping strings and nested parentheses.
  function condition(keyword: string): { cond: string; condStart: number } {
    while (/\s/.test(source[i] ?? '')) i++
    if (source[i] !== '(') fail(`expected ( after ${keyword}`, i)
    const open = i
    let depth = 0
    for (; i < source.length; i++) {
      const c = source[i]!
      if (c === '"' || c === "'" || c === '`') {
        for (i++; i < source.length && source[i] !== c; i++) if (source[i] === '\\') i++
      } else if (c === '(') depth++
      else if (c === ')' && --depth === 0) {
        i++
        return { cond: source.slice(open + 1, i - 1).trim(), condStart: open + 1 }
      }
    }
    return fail(`unclosed ( after ${keyword}`, open)
  }

  // @await (promise) { pending } @then (value) { … } @catch (error) { … }: @then and @catch optional, in that order.
  function awaitBlock(): TemplateNode {
    const start = i
    i += 6
    const { cond: expr, condStart: exprStart } = condition('@await')
    const open = () => {
      while (/\s/.test(source[i] ?? '')) i++
      if (source[i] !== '{') fail('expected { to open the block', i)
      i++
    }
    open()
    const pending = children({ tag: '@await', start, block: true })
    let then: AwaitBranch | null = null
    let caught: AwaitBranch | null = null
    for (;;) {
      const save = i
      while (/\s/.test(source[i] ?? '')) i++
      const kw = /^@(then|catch)[\s(]/.exec(source.slice(i, i + 7))?.[1]
      if (!kw) { i = save; break }
      const at = i
      if (kw === 'then' && caught) fail('@then comes before @catch', at)
      if ((kw === 'then' && then) || (kw === 'catch' && caught)) fail(`only one @${kw} per @await`, at)
      i += kw.length + 1
      const { cond: name, condStart: nameStart } = condition(`@${kw}`)
      const what = kw === 'then' ? 'value' : 'error'
      if (!/^[A-Za-z_$][\w$]*$/.test(name)) fail(`@${kw} takes a name for the ${what}: @${kw} (${what})`, nameStart)
      open()
      const branch = { name, nameStart, children: children({ tag: `@${kw}`, start: at, block: true }) }
      if (kw === 'then') then = branch
      else caught = branch
    }
    return { type: 'await', expr, exprStart, pending, then, catch: caught, start }
  }

  // @if (a) { … } @else if (b) { … } @else { … }
  function ifBlock(): TemplateNode {
    const start = i
    i += 3
    const branches: { cond: string | null; condStart: number; children: TemplateNode[] }[] = []
    let next: { cond: string | null; condStart: number } | null = condition('@if')
    while (next) {
      while (/\s/.test(source[i] ?? '')) i++
      if (source[i] !== '{') fail('expected { to open the block', i)
      i++
      branches.push({ ...next, children: children({ tag: '@if', start, block: true }) })
      if (next.cond === null) break // @else is last
      const save = i
      while (/\s/.test(source[i] ?? '')) i++
      if (!source.startsWith('@else', i)) { i = save; break }
      i += 5
      while (/\s/.test(source[i] ?? '')) i++
      if (/^if[\s(]/.test(source.slice(i, i + 3))) { i += 2; next = condition('@else if') }
      else next = { cond: null, condStart: i }
    }
    return { type: 'if', branches, start }
  }

  // Split at top-level ';' (outside strings and brackets).
  /** Top-level `;` clauses, trimmed, each with its offset in `text`. */
  function splitClauses(text: string): { text: string; start: number }[] {
    const parts: { text: string; start: number }[] = []
    const push = (from: number, to: number) => {
      const raw = text.slice(from, to)
      if (raw.trim()) parts.push({ text: raw.trim(), start: from + raw.length - raw.trimStart().length })
    }
    let depth = 0
    let from = 0
    for (let j = 0; j < text.length; j++) {
      const c = text[j]!
      if (c === '"' || c === "'" || c === '`') { for (j++; j < text.length && text[j] !== c; j++) if (text[j] === '\\') j++ }
      else if ('([{'.includes(c)) depth++
      else if (')]}'.includes(c)) depth--
      else if (c === ';' && depth === 0) { push(from, j); from = j + 1 }
    }
    push(from, text.length)
    return parts
  }

  // @for (item of list; track key) { … } @empty { … }
  function forBlock(): TemplateNode {
    const start = i
    i += 4
    const { cond: head, condStart: headStart } = condition('@for')
    // Where `head` (trimmed) starts in the source, so every part below gets its exact offset.
    let at = headStart
    while (/\s/.test(source[at] ?? '')) at++
    const [first = { text: '', start: 0 }, ...rest] = splitClauses(head)
    const m = /^([\s\S]+?)\s+of\s+([\s\S]+)$/d.exec(first.text)
    if (!m) fail('expected "item of list" in @for', headStart)
    if (!/^[A-Za-z_$][\w$]*$/.test(m![1]!.trim())) fail('the @for item must be a simple name', headStart)
    const itemStart = at + first.start + m!.indices![1]![0]
    if (FOR_IMPLICIT.includes(m![1]!.trim())) fail(`"${m![1]!.trim()}" is an implicit @for variable: name the item something else`, itemStart)
    const listStart = at + first.start + m!.indices![2]![0]
    let track: string | null = null
    let trackStart = -1
    for (const clause of rest) {
      const t = /^track\s+([\s\S]+)$/d.exec(clause.text)
      if (!t) fail(`unknown @for clause "${clause.text}"`, headStart)
      if (track !== null) fail('only one track per @for', at + clause.start)
      track = t![1]!.trim()
      trackStart = at + clause.start + t!.indices![1]![0]
    }
    while (/\s/.test(source[i] ?? '')) i++
    if (source[i] !== '{') fail('expected { to open the block', i)
    i++
    const body = children({ tag: '@for', start, block: true })
    let empty: TemplateNode[] | null = null
    const save = i
    while (/\s/.test(source[i] ?? '')) i++
    if (/^@empty[\s{]/.test(source.slice(i, i + 7))) {
      i += 6
      while (/\s/.test(source[i] ?? '')) i++
      if (source[i] !== '{') fail('expected { to open the block', i)
      i++
      empty = children({ tag: '@empty', start, block: true })
      const after = i
      while (/\s/.test(source[i] ?? '')) i++
      if (/^@empty[\s{]/.test(source.slice(i, i + 7))) fail('only one @empty per @for', i)
      i = after
    } else i = save
    return { type: 'for', item: m![1]!, list: m![2]!.trim(), track, headStart, itemStart, listStart, trackStart, children: body, empty, start }
  }

  // @slot('name') { … }: content for a component's named slot.
  function fillBlock(): TemplateNode {
    const start = i
    i += 5
    const { cond, condStart } = condition('@slot')
    // A quoted name, then optionally what the slot passes, named as a function parameter: { item }, props.
    const m = /^(['"])([\w-]+)\1\s*(?:,\s*([\s\S]*\S))?\s*$/.exec(cond)
    if (!m) fail(`@slot needs a quoted name, like @slot('aside'), or @slot('row', { item }) for a slot that passes data`, start)
    const params = m![3]
    const paramsStart = params === undefined ? undefined : condStart + cond.indexOf(params, m![1]!.length * 2 + m![2]!.length)
    while (/\s/.test(source[i] ?? '')) i++
    if (source[i] !== '{') fail('expected { to open the block', i)
    i++
    return { type: 'fill', name: m![2]!, ...(params !== undefined ? { params, paramsStart } : {}), children: children({ tag: '@slot', start, block: true }), start }
  }

  function children(parent?: { tag: string; start: number; block?: boolean }): TemplateNode[] {
    const nodes: TemplateNode[] = []
    let text = ''
    let textStart = i
    const flush = () => {
      if (text && (parent || text.trim())) nodes.push({ type: 'text', value: text, start: textStart })
      text = ''
    }
    while (i < source.length) {
      if (source.startsWith('{{--', i)) {
        const end = source.indexOf('--}}', i)
        if (end === -1) fail('unclosed {{-- comment', i)
        flush(); i = end + 4; textStart = i
      } else if (source.startsWith('<!--', i)) {
        const end = source.indexOf('-->', i + 4)
        if (end === -1) fail('unclosed <!-- comment', i)
        text += source.slice(i, end + 3) // kept verbatim as static text: no tags, no holes inside
        i = end + 3
      } else if (/^@if[\s(]/.test(source.slice(i, i + 4))) {
        flush(); nodes.push(ifBlock()); textStart = i
      } else if (/^@await[\s(]/.test(source.slice(i, i + 7))) {
        flush(); nodes.push(awaitBlock()); textStart = i
      } else if (/^@(then|catch)[\s(]/.test(source.slice(i, i + 7))) {
        fail(`${/^@\w+/.exec(source.slice(i))![0]} without @await before it`, i)
      } else if (/^@for[\s(]/.test(source.slice(i, i + 5))) {
        flush(); nodes.push(forBlock()); textStart = i
      } else if (/^@slot[\s(]/.test(source.slice(i, i + 6))) {
        flush(); nodes.push(fillBlock()); textStart = i
      } else if (parent?.block && source[i] === '}') {
        flush(); i++
        return nodes
      } else if (!parent && source[i] === '@' && atLineStart(i)) {
        flush(); directive(); textStart = i
      } else if (source.startsWith('{{', i)) {
        const end = holeEnd(i + 2)
        if (end === -1) fail('unclosed {{', i)
        flush()
        nodes.push({ type: 'expr', expr: source.slice(i + 2, end).trim(), start: i })
        i = end + 2; textStart = i
      } else if (source.startsWith('</', i)) {
        const start = i
        const tag = source.slice(i + 2).match(/^[\w-]+/)?.[0] ?? ''
        if (!parent || tag !== parent.tag) fail(`unexpected closing tag </${tag}>`, start)
        const gt = source.indexOf('>', i)
        if (gt === -1) fail(`unclosed </${tag}>`, start)
        flush(); i = gt + 1
        return nodes
      } else if (source[i] === '<' && /[A-Za-z]/.test(source[i + 1] ?? '')) {
        flush()
        const start = i
        const tag = source.slice(i + 1).match(/^[\w-]+/)![0]
        i += 1 + tag.length
        const list = attrs()
        if (i >= source.length) fail(`unclosed <${tag}>`, start)
        const selfClosing = source.startsWith('/>', i)
        i += selfClosing ? 2 : 1
        if (tag === 'script' && list.some((a) => a.name === 'inline')) {
          // <script inline>: written out as is and run where it stands (e.g. in <head>, before the first paint).
          const bound = list.find((a) => a.kind !== 'static')
          if (bound) fail('an inline script takes static attributes only', bound.start)
          const end = source.indexOf('</script>', i)
          if (end === -1) fail('unclosed <script inline>', start)
          const kids: TemplateNode[] = selfClosing ? [] : [{ type: 'text', value: source.slice(i, end), start: i }]
          nodes.push({ type: 'element', tag, attrs: list.filter((a) => a.name !== 'inline'), children: kids, start })
          i = selfClosing ? i : end + '</script>'.length
        } else if (tag === 'script' && list.some((a) => a.kind === 'static' && a.name === 'type' && a.value === 'application/ld+json')) {
          // JSON-LD: static JSON as written, or one {{ }} hole holding the whole value, written as JSON.
          const bound = list.find((a) => a.kind !== 'static')
          if (bound) fail('a JSON-LD script takes static attributes only', bound.start)
          const end = source.indexOf('</script>', i)
          if (end === -1) fail('unclosed <script type="application/ld+json">', start)
          const body = selfClosing ? '' : source.slice(i, end)
          const hole = /^\s*\{\{([\s\S]*)\}\}\s*$/.exec(body)
          const at = i + body.indexOf('{{')
          if (!hole && body.includes('{{')) fail('JSON-LD takes static JSON, or one {{ }} hole holding the whole value ({{ { "@type": "Article", headline: title } }})', at)
          const kids: TemplateNode[] = hole ? [{ type: 'expr', expr: hole[1]!.trim(), start: at, json: true }] : body ? [{ type: 'text', value: body, start: i }] : []
          nodes.push({ type: 'element', tag, attrs: list, children: kids, start })
          i = selfClosing ? i : end + '</script>'.length
        } else if (tag === 'script' && list.some((a) => a.name === 'server')) {
          // <script server>: the component's server-only script (#430), run at render; it can await.
          if (parent) fail('<script server> must be at the top level (it runs once per render, before the template)', start)
          if (out.serverScript) fail('only one <script server> block is allowed', start)
          const other = list.find((a) => a.name !== 'server')
          if (other) fail('<script server> takes no other attributes', other.start)
          const end = source.indexOf('</script>', i)
          if (end === -1) fail('unclosed <script server>', start)
          out.serverScript = { code: source.slice(i, end), start: i, tag: start }
          i = end + '</script>'.length
        } else if (tag === 'script') {
          if (parent) fail('<script> must be at the top level (a component script); add `inline` for a script that runs where it stands', start)
          if (out.script) fail('only one <script> block is allowed', start)
          const end = source.indexOf('</script>', i)
          if (end === -1) fail('unclosed <script>', start)
          out.script = { code: source.slice(i, end), start: i }
          i = end + '</script>'.length
        } else if (tag === 'style' && !parent) {
          // A top-level <style> is the component's stylesheet. One inside markup (a layout's <head>) stays HTML.
          const end = source.indexOf('</style>', i)
          if (end === -1) fail('unclosed <style>', start)
          const hole = source.slice(i, end).indexOf('{{')
          if (hole !== -1) fail('{{ }} holes are not supported in a component <style>: set a CSS custom property from the template instead (style="--x: {{ x }}")', i + hole)
          const mode = list.some((a) => a.name === 'scoped') ? 'scoped' : list.some((a) => a.name === 'global') ? 'global' : 'plain'
          out.styles.push({ css: source.slice(i, end), mode, start: i, tag: start })
          i = end + '</style>'.length
        } else if (list.some((a) => a.name === 'verbatim')) {
          // Everything up to </tag> is text: no holes, tags or directives.
          const attr = list.find((a) => a.name === 'verbatim')!
          if (attr.kind !== 'static' || attr.value !== true) fail('verbatim takes no value', attr.start)
          if (out.imports.some((imp) => imp.name === tag)) fail('verbatim only works on HTML elements, not components', attr.start)
          let kids: TemplateNode[] = []
          if (!selfClosing && !VOID.has(tag)) {
            const close = source.indexOf(`</${tag}>`, i)
            if (close === -1) fail(`unclosed <${tag} verbatim>`, start)
            kids = [{ type: 'raw', value: source.slice(i, close), start: i }]
            i = close + `</${tag}>`.length
          }
          nodes.push({ type: 'element', tag, attrs: list.filter((a) => a !== attr), children: kids, start })
        } else {
          const kids = selfClosing || VOID.has(tag) ? [] : children({ tag, start })
          nodes.push({ type: 'element', tag, attrs: list, children: kids, start })
        }
        textStart = i
      } else {
        text += source[i++]
      }
    }
    if (parent) fail(parent.block ? `unclosed ${parent.tag} block` : `unclosed <${parent.tag}>`, parent.start)
    flush()
    return nodes
  }

  out.nodes = children()
  return out
}

/** Local names an import clause binds: `{ a, b as c, type T }` → a, c; `x` → x. */
export function importNames(clause: string): string[] {
  if (!clause.startsWith('{')) return [clause]
  return clause.slice(1, -1).split(',').map((p) => p.trim()).filter((p) => p && !p.startsWith('type '))
    .map((p) => p.split(/\s+as\s+/).pop()!.trim())
}
