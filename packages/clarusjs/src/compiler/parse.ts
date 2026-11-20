// .tscl source → syntax tree. Pure: no file system, no JS parsing (expressions are kept as raw strings).
import { ClarusError } from './errors.ts'

export type Attr =
  | { kind: 'static'; name: string; value: string | true; start: number }
  | { kind: 'event'; name: string; expr: string; start: number } // (click)="..."
  | { kind: 'prop'; name: string; expr: string; start: number } // [start]="..."
  | { kind: 'interp'; name: string; parts: (string | { expr: string; start: number })[]; start: number } // a="x {{ y }}"
export type TemplateNode =
  | { type: 'element'; tag: string; attrs: Attr[]; children: TemplateNode[]; start: number }
  | { type: 'text'; value: string; start: number }
  | { type: 'expr'; expr: string; start: number } // {{ expr }}
  | { type: 'raw'; value: string; start: number } // content of a `verbatim` element, shown as text
  | { type: 'if'; branches: { cond: string | null; condStart: number; children: TemplateNode[] }[]; start: number }
  | { type: 'fill'; name: string; children: TemplateNode[]; start: number } // @slot('name') { … } inside a component tag
  | { type: 'for'; item: string; list: string; track: string | null; headStart: number; itemStart: number; listStart: number; trackStart: number; children: TemplateNode[]; empty: TemplateNode[] | null; start: number }
export type InputDecl = { name: string; type: string; default?: string; start: number; nameStart: number; typeStart: number; defaultStart?: number }
// @import type { A, B } from '…': types for @input declarations (erased from compiled output, used by type checking).
export type TypeImport = { clause: string; from: string; start: number; clauseStart: number }
// @import { a, b } from '…' or @import data from './x.json': values a template uses. Server-only in components
// without a script; bundled for the browser in islands.
export type DataImport = { clause: string; from: string; start: number; clauseStart: number }
export type ImportDecl = { name: string; from: string; start: number }
export type ParsedFile = {
  inputs: InputDecl[]
  imports: ImportDecl[]
  typeImports: TypeImport[]
  dataImports: DataImport[]
  script?: { code: string; start: number } // start = offset of the first char inside <script>
  styles: { css: string; global: boolean; start: number }[] // top-level <style> blocks; `global` ones aren't scoped
  nodes: TemplateNode[]
}

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])
const INPUT_RE = /^@input\s+([A-Za-z_$][\w$]*)\s*:\s*([^=\n]+?)\s*(?:=\s*(.+?))?\s*$/d
const DATA_IMPORT_RE = /^@import\s+(\{[^}]*\})\s+from\s+(['"])(.+?)\2\s*$/d
const IMPORT_TYPE_RE = /^@import\s+type\s+(\{[^}]*\}|[A-Za-z_$][\w$]*)\s+from\s+(['"])(.+?)\2\s*$/d
const IMPORT_RE = /^@import\s+([A-Za-z_$][\w-]*)\s+from\s+(['"])(.+?)\2\s*$/

export function parse(source: string, file: string): ParsedFile {
  const out: ParsedFile = { inputs: [], imports: [], typeImports: [], dataImports: [], styles: [], nodes: [] }
  let i = 0
  const fail = (text: string, at: number): never => { throw new ClarusError(text, file, source, at) }
  const atLineStart = (at: number) => /^[ \t]*$/.test(source.slice(source.lastIndexOf('\n', at - 1) + 1, at))

  function directive(): void {
    const end = source.indexOf('\n', i) === -1 ? source.length : source.indexOf('\n', i)
    const lineStart = i + (source.slice(i, end).length - source.slice(i, end).trimStart().length)
    const line = source.slice(i, end).trim()
    let m: RegExpExecArray | RegExpMatchArray | null
    if ((m = INPUT_RE.exec(line))) {
      const at = (group: number) => lineStart + (m as RegExpExecArray).indices![group]![0]
      out.inputs.push({ name: m[1]!, type: m[2]!.trim(), default: m[3], start: i, nameStart: at(1), typeStart: at(2), ...(m[3] ? { defaultStart: at(3) } : {}) })
    } else if ((m = IMPORT_TYPE_RE.exec(line))) {
      out.typeImports.push({ clause: m[1]!, from: m[3]!, start: i, clauseStart: lineStart + (m as RegExpExecArray).indices![1]![0] })
    } else if ((m = DATA_IMPORT_RE.exec(line))) {
      out.dataImports.push({ clause: m[1]!, from: m[3]!, start: i, clauseStart: lineStart + (m as RegExpExecArray).indices![1]![0] })
    } else if ((m = line.match(IMPORT_RE))) {
      // A default import of a .tscl file is a component; of anything else, data.
      if (m[3]!.endsWith('.tscl')) out.imports.push({ name: m[1]!, from: m[3]!, start: i })
      else out.dataImports.push({ clause: m[1]!, from: m[3]!, start: i, clauseStart: lineStart + line.indexOf(m[1]!, 7) })
    }
    else fail(`unknown or malformed directive "${line.split(/\s/)[0]}"`, i)
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
    const listStart = at + first.start + m!.indices![2]![0]
    let track: string | null = null
    let trackStart = -1
    for (const clause of rest) {
      const t = /^track\s+([\s\S]+)$/d.exec(clause.text)
      if (!t) fail(`unknown @for clause "${clause.text}"`, headStart)
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
    } else i = save
    return { type: 'for', item: m![1]!, list: m![2]!.trim(), track, headStart, itemStart, listStart, trackStart, children: body, empty, start }
  }

  // @slot('name') { … }: content for a component's named slot.
  function fillBlock(): TemplateNode {
    const start = i
    i += 5
    const { cond } = condition('@slot')
    const m = /^(['"])([\w-]+)\1$/.exec(cond)
    if (!m) fail(`@slot needs a quoted name, like @slot('aside')`, start)
    while (/\s/.test(source[i] ?? '')) i++
    if (source[i] !== '{') fail('expected { to open the block', i)
    i++
    return { type: 'fill', name: m![2]!, children: children({ tag: '@slot', start, block: true }), start }
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
          out.styles.push({ css: source.slice(i, end), global: list.some((a) => a.name === 'global'), start: i })
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
