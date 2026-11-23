// @clarusjs/prettier-plugin: format clarusjs .tscl components with Prettier. A .tscl template is nearly Angular's
// syntax ({{ }}, [prop], (event), [(x)], @if/@else, @for … track … @empty), so the template is formatted by Prettier's
// own Angular formatter, and <script> and <style> by its JavaScript and CSS ones.
//
// The file is parsed first with the clarusjs compiler's own parser, so what is text, a block or a directive is exactly
// what the compiler reads. What Angular would read differently is set aside by placeholders and restored after:
// directives (moved to the top), {{-- --}} comments, verbatim contents, { } and @ in text, holes using a bitwise |, and
// blocks that sit inline in text (formatting them would change the page's whitespace).
// @see https://clarusjs.com/guide/formatting
import { parse, type ParsedFile, type TemplateNode } from 'clarusjs/compiler'
import { doc, type AstPath, type Doc, type Options, type Parser, type Printer, type SupportLanguage } from 'prettier'

/** The whole file, formatted as one piece. `error`: why formatting it failed (reported, never an empty file). */
type Root = { type: 'tscl'; text: string; error?: unknown }

/**
 * The `.tscl` language, for Prettier and editors.
 * @see https://clarusjs.com/guide/formatting
 */
export const languages: SupportLanguage[] = [
  { name: 'clarusjs', parsers: ['tscl'], extensions: ['.tscl'], vscodeLanguageIds: ['tscl'] },
]

/**
 * The `tscl` parser: the file as one node (the printer formats it).
 * @see https://clarusjs.com/guide/formatting
 */
export const parsers: Record<string, Parser<Root>> = {
  tscl: {
    parse: (text) => ({ type: 'tscl', text }),
    astFormat: 'tscl',
    locStart: () => 0,
    locEnd: (node) => node.text.length,
  },
}

/**
 * The `tscl` printer: directives as written, the template through Prettier's Angular formatter.
 * @see https://clarusjs.com/guide/formatting
 */
export const printers: Record<string, Printer<Root>> = {
  tscl: {
    // Prettier falls back to print() when embed fails: report that failure rather than print nothing.
    print: (path: AstPath<Root>) => { throw path.node.error ?? new Error('clarusjs: this .tscl file could not be formatted') },
    embed: (path: AstPath<Root>, options: Options) => async (textToDoc: (text: string, options: Options) => Promise<Doc>) => {
      try {
        return await formatFile(path.node.text, options, textToDoc)
      } catch (err) {
        path.node.error = err
        throw err
      }
    },
  },
}

async function formatFile(source: string, options: Options, textToDoc: (text: string, options: Options) => Promise<Doc>): Promise<Doc> {
  // The compiler's reading of the file; one it rejects isn't formatted (its error is the reason).
  const parsed = parse(source, options.filepath ?? 'component.tscl')
  const { head, text, restore } = prepare(source, parsed)
  const angular = { ...options, parser: 'angular' } as Options
  const formatted = text.trim()
    ? doc.printer.printDocToString(await textToDoc(text, angular), angular as Parameters<typeof doc.printer.printDocToString>[1]).formatted
    : ''
  const out = [head, restore(formatted).trimEnd()].filter(Boolean).join('\n\n')
  return doc.utils.replaceEndOfLine(out ? `${out}\n` : '')
}

type Edit = { start: number; end: number; text: string }

/** The head (directives and leading comments, as written), the template with placeholders, and their undoing. */
function prepare(source: string, parsed: ParsedFile): { head: string; text: string; restore(formatted: string): string } {
  // Placeholders the file doesn't contain (so the author's own text is never mistaken for one).
  const taken = new Set<string>()
  const fresh = (make: (pad: string) => string) => {
    let pad = ''
    while (source.includes(make(pad)) || taken.has(make(pad))) pad += '0'
    taken.add(make(pad))
    return make(pad)
  }
  const AT = fresh((p) => `&#${p}64;`)
  const LB = fresh((p) => `&#${p}123;`)
  const RB = fresh((p) => `&#${p}125;`)
  const COMMENT = fresh((p) => `<!--cl${p}:`)
  const HOLE = fresh((p) => `__cl${p}_hole`)
  const WORD = fresh((p) => `__cl${p}_word`)
  const ATTR = fresh((p) => `__cl${p}_attr`)
  const INLINE = fresh((p) => `__cl${p}_inline`) // a word: Prettier never breaks inside one
  const SLOT = fresh((p) => `@defer (__cl${p}_slot__`)
  // @await / @then / @catch (#430) as an @if / @else if chain Angular formats; each header is kept as written.
  const HEAD = fresh((p) => `__cl${p}_head`)
  const saved: string[] = []
  const save = (original: string) => saved.push(original) - 1

  // Directives anywhere at the top level go to the head (mid-template, Prettier could join them to the text around
  // them), after the directives and {{-- --}} comments that lead the file.
  const lineEnd = (at: number) => { const n = source.indexOf('\n', at); return n === -1 ? source.length : n }
  const directives: { start: number; end: number }[] = [
    ...[...parsed.imports, ...parsed.cssImports, ...parsed.typeImports, ...parsed.dataImports].map((d) => ({ start: d.start, end: lineEnd(d.start) })),
    ...parsed.inputs.map((d) => ({ start: d.start, end: lineEnd(d.defaultStart !== undefined ? d.defaultStart + d.default!.length : d.typeStart + d.type.length) })),
    ...parsed.types.map((d) => ({ start: d.start, end: lineEnd(d.typeStart + d.type.length) })),
  ].sort((a, b) => a.start - b.start)
  const head: string[] = []
  let bodyStart = 0
  for (;;) {
    let at = bodyStart
    while (at < source.length && /\s/.test(source[at]!)) at++
    if (directives[0]?.start === at) {
      const d = directives.shift()!
      head.push(source.slice(d.start, d.end))
      bodyStart = d.end
    } else if (source.startsWith('{{--', at)) {
      const close = source.indexOf('--}}', at)
      bodyStart = close === -1 ? source.length : close + 4
      head.push(source.slice(at, bodyStart))
    } else {
      bodyStart = at
      break
    }
  }
  const edits: Edit[] = []
  for (const d of directives) {
    head.push(source.slice(d.start, d.end))
    edits.push({ start: d.start, end: Math.min(d.end + 1, source.length), text: '' })
  }

  // Ranges whose text is code, not template: <script>, <style>.
  const code = [
    ...(parsed.script ? [{ start: parsed.script.start, end: parsed.script.start + parsed.script.code.length }] : []),
    ...parsed.styles.map((s) => ({ start: s.start, end: s.start + s.css.length })),
  ]
  const inCode = (at: number) => code.some((r) => at >= r.start && at < r.end)

  // {{-- --}} comments in the template (the compiler skips them; they're in no node).
  for (const m of source.slice(bodyStart).matchAll(/\{\{--[\s\S]*?--\}\}/g)) {
    const start = bodyStart + m.index
    if (!inCode(start)) edits.push({ start, end: start + m[0].length, text: `${COMMENT}${save(m[0])}-->` })
  }

  /** The `}}` closing a hole (strings skipped), as the compiler finds it. */
  const holeClose = (i: number): number => {
    for (; i < source.length; i++) {
      const c = source[i]!
      if (c === '"' || c === "'" || c === '`') i = closeString(source, i)
      else if (source.startsWith('}}', i)) return i
    }
    return -1
  }

  // Text and hole positions, so a block's braces can be told from braces in text.
  const skips = new Map<number, number>()
  const collect = (nodes: TemplateNode[]) => {
    for (const n of nodes) {
      if (n.type === 'text' || n.type === 'raw') skips.set(n.start, n.start + n.value.length)
      else if (n.type === 'expr') { const e = holeClose(n.start + 2); if (e !== -1) skips.set(n.start, e + 2) }
      else if (n.type === 'element') collect(n.children)
      else if (n.type === 'if') n.branches.forEach((b) => collect(b.children))
      else if (n.type === 'for') { collect(n.children); if (n.empty) collect(n.empty) }
      else if (n.type === 'await') [n.pending, ...(n.then ? [n.then.children] : []), ...(n.catch ? [n.catch.children] : [])].forEach(collect)
      else collect(n.children)
    }
  }
  collect(parsed.nodes)

  /** Index of the `)` matching the `(` at `i` (strings skipped). */
  const parenEnd = (i: number): number => {
    let depth = 0
    for (; i < source.length; i++) {
      const c = source[i]!
      if (c === '"' || c === "'" || c === '`') i = closeString(source, i)
      else if (c === '(') depth++
      else if (c === ')' && --depth === 0) return i
    }
    return source.length
  }
  const HEADER = /^@(if|for|slot|await|then|catch|else\s+if)\s*\(/

  /**
   * The end of the block starting at `start` (after its last `}`, @else/@empty branches included). A single space
   * replaces the whitespace between `}` and a following @else/@empty (blank lines there would move into the branch).
   */
  const blockEnd = (start: number): number => {
    let i = start
    for (;;) {
      if (HEADER.test(source.slice(i, i + 12))) i = parenEnd(source.indexOf('(', i)) + 1
      while (i < source.length && source[i] !== '{') i++
      let depth = 0
      for (; i < source.length; i++) {
        const skip = skips.get(i)
        if (skip !== undefined) { i = skip - 1; continue }
        const c = source[i]!
        if (c === '<' && source.startsWith('<!--', i)) { const e = source.indexOf('-->', i); i = e === -1 ? source.length : e + 2 }
        else if (c === '<' && /[A-Za-z/]/.test(source[i + 1] ?? '')) i = tagEnd(source, i)
        else if (source.startsWith('{{--', i)) { const e = source.indexOf('--}}', i); i = e === -1 ? source.length : e + 3 }
        else if (c === '@' && HEADER.test(source.slice(i, i + 12))) i = parenEnd(source.indexOf('(', i))
        else if (c === '{') depth++
        else if (c === '}' && --depth === 0) break
      }
      if (i >= source.length) return -1
      const close = i + 1
      let next = close
      while (next < source.length && /\s/.test(source[next]!)) next++
      if (!/^@(else|empty|then|catch)(?![\w$-])/.test(source.slice(next, next + 7))) return close
      if (next !== close + 1 || source[close] !== ' ') edits.push({ start: close, end: next, text: ' ' })
      i = next
    }
  }

  /** A hole whose | is JavaScript's bitwise or (Angular would read it as a pipe and drop parentheses): kept as is. */
  const holeEdit = (start: number) => {
    const end = holeClose(start + 2)
    if (end !== -1) edits.push({ start, end: end + 2, text: `{{ ${HOLE}${save(source.slice(start, end + 2))} }}` })
  }

  /** { } and @ in text as entities Angular keeps; a top-level @word glued to the word before it. */
  const textEdits = (start: number, value: string, topLevel: boolean) => {
    for (let i = 0; i < value.length; i++) {
      const c = value[i]!
      if (value.startsWith('<!--', i)) { const e = value.indexOf('-->', i); i = e === -1 ? value.length : e + 2; continue }
      if (c === '{') edits.push({ start: start + i, end: start + i + 1, text: LB })
      else if (c === '}') edits.push({ start: start + i, end: start + i + 1, text: RB })
      else if (c !== '@') continue
      else if (!topLevel) edits.push({ start: start + i, end: start + i + 1, text: AT })
      else {
        // At the top level, an @ starting a line is a directive. Keep the word before it on the same line: the two
        // become one placeholder word, which Prettier never breaks.
        let from = i
        while (from > 0 && (value[from - 1] === ' ' || value[from - 1] === '\t')) from--
        const gap = from
        while (from > 0 && !/\s/.test(value[from - 1]!)) from--
        let to = i
        while (to < value.length && !/\s/.test(value[to]!)) to++
        if (from < gap) {
          while (edits.length && edits[edits.length - 1]!.start >= start + from) edits.pop() // inside the glued span
          edits.push({ start: start + from, end: start + to, text: `${WORD}${save(value.slice(from, to))}_` })
        } else edits.push({ start: start + i, end: start + i + 1, text: AT }) // ponytail: a text node starting with @ can still wrap to a line start after an element; glue across nodes if that bites
        i = to - 1
      }
    }
  }

  // The template, node by node.
  const holds: Edit[] = [] // whole regions kept as written
  const visit = (nodes: TemplateNode[], topLevel: boolean, rawText: boolean, edgeOk = topLevel) => {
    for (const [k, n] of nodes.entries()) {
      if (n.type === 'text') {
        if (!rawText && source.slice(n.start, n.start + n.value.length) === n.value) textEdits(n.start, n.value, topLevel)
      } else if (n.type === 'raw') {
        if (n.value && source.slice(n.start, n.start + n.value.length) === n.value) holds.push({ start: n.start, end: n.start + n.value.length, text: `${COMMENT}${save(n.value)}-->` })
      } else if (n.type === 'expr') {
        if (!rawText && bitwise(n.expr)) holeEdit(n.start)
      } else if (n.type === 'element') {
        for (const a of n.attrs) {
          // Kept as written: a value with an encoded " (Prettier would decode it and switch to single quotes, which
          // clarusjs doesn't read), and a binding with a bitwise | (Angular reads a pipe and drops parentheses).
          const v = attrValue(source, a.start)
          const kept = v && (/&quot;|&#0*34;|&#x0*22;/i.test(source.slice(v.start, v.end)) || ((a.kind === 'prop' || a.kind === 'event' || a.kind === 'model') && bitwise(a.expr)))
          if (kept) holds.push({ start: v.start, end: v.end, text: `${ATTR}${save(source.slice(v.start, v.end))}_` })
          else if (a.kind === 'interp') for (const p of a.parts) if (typeof p !== 'string' && bitwise(p.expr)) holeEdit(p.start)
        }
        visit(n.children, false, rawText || n.tag === 'script' || n.tag === 'style', BLOCK_TAGS.has(n.tag) || OPTION_LISTS.has(n.tag))
      } else {
        const end = blockEnd(n.start)
        if (!canLayout(n, nodes[k - 1], nodes[k + 1], edgeOk || topLevel) && end !== -1) {
          holds.push({ start: n.start, end, text: `${INLINE}${save(source.slice(n.start, end))}_` })
          continue
        }
        if (n.type === 'fill' && /^@slot\s*\(/.test(source.slice(n.start, n.start + 12))) {
          edits.push({ start: n.start, end: source.indexOf('(', n.start) + 1, text: SLOT })
        }
        if (n.type === 'if') for (const b of n.branches) visit(b.children, false, false, true)
        else if (n.type === 'for') { visit(n.children, false, false, true); if (n.empty) visit(n.empty, false, false, true) }
        else if (n.type === 'await') {
          // Each header becomes @if (…) or @else if (…) around a saved copy of it.
          const header = (at: number, keyword: string) => {
            const end = parenEnd(source.indexOf('(', at)) + 1
            edits.push({ start: at, end, text: `${keyword} (${HEAD}${save(source.slice(at, end))}_)` })
          }
          header(n.start, '@if')
          for (const b of [n.then, n.catch]) if (b) header(source.lastIndexOf('@', b.nameStart), '@else if')
          for (const kids of [n.pending, ...(n.then ? [n.then.children] : []), ...(n.catch ? [n.catch.children] : [])]) visit(kids, false, false, true)
        }
        else visit(n.children, false, false, true)
      }
    }
  }
  visit(parsed.nodes, true, false)

  // Apply: a held region replaces everything inside it; then the rest, in order.
  const inHold = (e: Edit) => holds.some((h) => h !== e && e.start >= h.start && e.end <= h.end)
  const all = [...holds, ...edits]
    .filter((e) => e.start >= bodyStart && !inHold(e))
    .sort((a, b) => a.start - b.start || a.end - b.end)
  let text = ''
  let at = bodyStart
  for (const e of all) {
    if (e.start < at) continue // overlapping edits can't come from the compiler's tree; never corrupt the file if one does
    text += source.slice(at, e.start) + e.text
    at = e.end
  }
  text += source.slice(at)

  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const back = (_: string, n: string) => saved[Number(n)]!
  return {
    head: head.map((h) => h.replace(/[ \t]+$/, '')).join('\n'), // only the end: a multi-line default keeps its spaces
    text,
    restore: (formatted) => formatted
      .replaceAll(SLOT, '@slot(')
      .replace(new RegExp(`@(?:else if|if) \\(${HEAD}(\\d+)_\\)`, 'g'), back)
      .replaceAll(AT, '@')
      .replaceAll(LB, '{')
      .replaceAll(RB, '}')
      .replace(new RegExp(`${escape(COMMENT)}(\\d+)-->`, 'g'), back)
      .replace(new RegExp(`\\{\\{\\s*${HOLE}(\\d+)\\s*\\}\\}`, 'g'), back) // Prettier may wrap it
      .replace(new RegExp(`"[^"]*?${ATTR}(\\d+)_[^"]*"`, 'g'), (_, n: string) => `"${saved[Number(n)]}"`) // the whole value (Prettier may wrap it in parentheses)
      .replace(new RegExp(`${WORD}(\\d+)_`, 'g'), back)
      .replace(new RegExp(`${INLINE}(\\d+)_`, 'g'), back),
  }
}

/** Elements laid out as blocks (or rows, cells, options): whitespace next to them doesn't show. */
const BLOCK_TAGS = new Set(['address', 'article', 'aside', 'blockquote', 'body', 'caption', 'col', 'colgroup', 'dd', 'details', 'dialog', 'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup', 'hr', 'html', 'legend', 'li', 'link', 'main', 'menu', 'meta', 'nav', 'ol', 'optgroup', 'option', 'p', 'pre', 'script', 'search', 'section', 'style', 'summary', 'table', 'tbody', 'td', 'template', 'tfoot', 'th', 'thead', 'title', 'tr', 'ul'])

/** Lists of options (themselves inline): whitespace among their options never shows, and Prettier lays them out. */
const OPTION_LISTS = new Set(['select', 'datalist'])

/** Whitespace-only text (comments allowed): Angular's line breaks there change nothing. */
const blank = (n: TemplateNode) => n.type === 'text' && !n.value.replace(/<!--[\s\S]*?-->/g, '').trim()

/**
 * Whether a block can go on lines of its own: Angular adds line breaks before and after it and inside each `{ }`, and
 * a line break shows on the page as a space unless whitespace was there already, the thing across it is block-level,
 * or it's at the edge of a block-level element (or the top level, whose whitespace the compiler drops). Otherwise the
 * block is kept as written (in a sentence, in an <a>, around <code> and <span> pieces).
 */
function canLayout(n: TemplateNode, prev: TemplateNode | undefined, next: TemplateNode | undefined, edgeOk: boolean): boolean {
  const before = (x: TemplateNode | undefined) => (x ? (x.type === 'text' ? /\s$/.test(x.value) : blockish(x)) : edgeOk)
  const after = (x: TemplateNode | undefined) => (x ? (x.type === 'text' ? /^\s/.test(x.value) : blockish(x)) : edgeOk)
  // Inside a branch: its first and last nodes (the block's own edges are safe once its outside is).
  const inside = (kids: TemplateNode[]) => !kids.length || (edge(kids[0]!, 'start') && edge(kids[kids.length - 1]!, 'end'))
  const branches = n.type === 'if' ? n.branches.map((b) => b.children) : n.type === 'await' ? [n.pending, ...(n.then ? [n.then.children] : []), ...(n.catch ? [n.catch.children] : [])] : n.type === 'for' ? [n.children, ...(n.empty ? [n.empty] : [])] : n.type === 'fill' ? [n.children] : []
  return before(prev) && after(next) && branches.every(inside)
}

/** A branch's first (`start`) or last node: whitespace on that side, or block-level. */
function edge(x: TemplateNode, side: 'start' | 'end'): boolean {
  if (x.type === 'text') return side === 'start' ? /^\s/.test(x.value) : /\s$/.test(x.value)
  return blockish(x)
}

/** A node whitespace next to doesn't show: a block-level element, or a block holding only such nodes. */
function blockish(n: TemplateNode): boolean {
  if (blank(n)) return true
  if (n.type === 'element') return BLOCK_TAGS.has(n.tag)
  if (n.type === 'if') return n.branches.every((b) => b.children.every(blockish))
  if (n.type === 'for') return n.children.every(blockish) && (n.empty ?? []).every(blockish)
  if (n.type === 'fill') return n.children.every(blockish)
  if (n.type === 'await') return [n.pending, ...(n.then ? [n.then.children] : []), ...(n.catch ? [n.catch.children] : [])].every((kids) => kids.every(blockish))
  return false
}

/** Index of the quote closing the string that starts at `i`. */
function closeString(s: string, i: number): number {
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === '\\') j++
    else if (s[j] === s[i]) return j
  }
  return s.length
}

/** Index of the `>` ending the tag at `i`, quoted values skipped. */
function tagEnd(s: string, i: number): number {
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === '"' || s[j] === "'") j = closeString(s, j)
    else if (s[j] === '>') return j
  }
  return s.length
}

/** The value of the attribute written at `at` (between its quotes), or undefined for one without a value. */
function attrValue(s: string, at: number): { start: number; end: number } | undefined {
  let i = at
  while (i < s.length && !/[\s=>/]/.test(s[i]!)) i++
  while (s[i] === ' ' || s[i] === '\t') i++
  if (s[i] !== '=') return undefined
  i++
  while (s[i] === ' ' || s[i] === '\t') i++
  const q = s[i]
  if (q !== '"' && q !== "'") return undefined
  const end = s.indexOf(q, i + 1)
  return end === -1 ? undefined : { start: i + 1, end }
}

/** A JavaScript bitwise | (not ||) outside strings: Angular would read it as a pipe. */
function bitwise(expr: string): boolean {
  const bare = expr.replace(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g, '""')
  return /(^|[^|])\|(?!\|)/.test(bare)
}
