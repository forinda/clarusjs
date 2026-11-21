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
  const INLINE = fresh((p) => `cl${p}-inline`)
  const SLOT = fresh((p) => `@defer (__cl${p}_slot__`)
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
  const HEADER = /^@(if|for|slot|else\s+if)\s*\(/

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
      if (!/^@(else|empty)(?![\w$-])/.test(source.slice(next, next + 7))) return close
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
  const visit = (nodes: TemplateNode[], topLevel: boolean, rawText: boolean) => {
    // A block among text (a sentence with an @if in it) is inline: Angular would put it on lines of its own.
    const inline = nodes.some((n) => n.type === 'text' && n.value.replace(/<!--[\s\S]*?-->/g, '').trim())
    for (const n of nodes) {
      if (n.type === 'text') {
        if (!rawText && source.slice(n.start, n.start + n.value.length) === n.value) textEdits(n.start, n.value, topLevel)
      } else if (n.type === 'raw') {
        if (n.value && source.slice(n.start, n.start + n.value.length) === n.value) edits.push({ start: n.start, end: n.start + n.value.length, text: `${COMMENT}${save(n.value)}-->` })
      } else if (n.type === 'expr') {
        if (!rawText && bitwise(n.expr)) holeEdit(n.start)
      } else if (n.type === 'element') {
        for (const a of n.attrs) if (a.kind === 'interp') for (const p of a.parts) if (typeof p !== 'string' && bitwise(p.expr)) holeEdit(p.start)
        visit(n.children, false, rawText || n.tag === 'script' || n.tag === 'style')
      } else {
        const end = blockEnd(n.start)
        if (inline && end !== -1) {
          holds.push({ start: n.start, end, text: `<${INLINE}-${save(source.slice(n.start, end))}></${INLINE}-${saved.length - 1}>` })
          continue
        }
        if (n.type === 'fill' && /^@slot\s*\(/.test(source.slice(n.start, n.start + 12))) {
          edits.push({ start: n.start, end: source.indexOf('(', n.start) + 1, text: SLOT })
        }
        if (n.type === 'if') for (const b of n.branches) visit(b.children, false, false)
        else if (n.type === 'for') { visit(n.children, false, false); if (n.empty) visit(n.empty, false, false) }
        else visit(n.children, false, false)
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
    head: head.map((h) => h.replace(/[ \t]+$/gm, '')).join('\n'),
    text,
    restore: (formatted) => formatted
      .replaceAll(SLOT, '@slot(')
      .replaceAll(AT, '@')
      .replaceAll(LB, '{')
      .replaceAll(RB, '}')
      .replace(new RegExp(`${escape(COMMENT)}(\\d+)-->`, 'g'), back)
      .replace(new RegExp(`\\{\\{ ${HOLE}(\\d+) \\}\\}`, 'g'), back)
      .replace(new RegExp(`${WORD}(\\d+)_`, 'g'), back)
      .replace(new RegExp(`<${INLINE}-(\\d+)></${INLINE}-\\1>`, 'g'), back),
  }
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

/** A JavaScript bitwise | (not ||) outside strings: Angular would read it as a pipe. */
function bitwise(expr: string): boolean {
  const bare = expr.replace(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g, '""')
  return /(^|[^|])\|(?!\|)/.test(bare)
}
