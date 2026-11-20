// .clarus source → syntax tree. Pure: no file system, no JS parsing (expressions are kept as raw strings).
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
export type InputDecl = { name: string; type: string; default?: string; start: number }
export type ImportDecl = { name: string; from: string; start: number }
export type ParsedFile = {
  inputs: InputDecl[]
  imports: ImportDecl[]
  script?: { code: string; start: number } // start = offset of the first char inside <script>
  nodes: TemplateNode[]
}

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])
const INPUT_RE = /^@input\s+([A-Za-z_$][\w$]*)\s*:\s*([^=\n]+?)\s*(?:=\s*(.+?))?\s*$/
const IMPORT_RE = /^@import\s+([A-Za-z_$][\w-]*)\s+from\s+(['"])(.+?)\2\s*$/

export function parse(source: string, file: string): ParsedFile {
  const out: ParsedFile = { inputs: [], imports: [], nodes: [] }
  let i = 0
  const fail = (text: string, at: number): never => { throw new ClarusError(text, file, source, at) }
  const atLineStart = (at: number) => /^[ \t]*$/.test(source.slice(source.lastIndexOf('\n', at - 1) + 1, at))

  function directive(): void {
    const end = source.indexOf('\n', i) === -1 ? source.length : source.indexOf('\n', i)
    const line = source.slice(i, end).trim()
    let m: RegExpMatchArray | null
    if ((m = line.match(INPUT_RE))) out.inputs.push({ name: m[1]!, type: m[2]!.trim(), default: m[3], start: i })
    else if ((m = line.match(IMPORT_RE))) out.imports.push({ name: m[1]!, from: m[3]!, start: i })
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
  function children(parent?: { tag: string; start: number }): TemplateNode[] {
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
        if (tag === 'script') {
          if (parent) fail('<script> must be at the top level', start)
          if (out.script) fail('only one <script> block is allowed', start)
          const end = source.indexOf('</script>', i)
          if (end === -1) fail('unclosed <script>', start)
          out.script = { code: source.slice(i, end), start: i }
          i = end + '</script>'.length
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
    if (parent) fail(`unclosed <${parent.tag}>`, parent.start)
    flush()
    return nodes
  }

  out.nodes = children()
  return out
}
