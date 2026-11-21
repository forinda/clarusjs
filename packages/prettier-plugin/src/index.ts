// @clarusjs/prettier-plugin: format clarusjs .tscl components with Prettier. A .tscl template is nearly Angular's
// syntax ({{ }}, [prop], (event), [(x)], @if/@else, @for … track … @empty), so the template is formatted by Prettier's
// own Angular formatter, and <script> and <style> by its JavaScript and CSS ones. What Angular doesn't know is set
// aside first and restored after: the directives at the top, {{-- --}} comments, verbatim contents and @slot blocks.
// @see https://clarusjs.com/guide/formatting
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
 * The `tscl` printer: the head as written, the template through Prettier's Angular formatter.
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
  const { head, body } = split(source)
  const { text, restore } = setAside(body)
  const formatted = text.trim()
    ? doc.printer.printDocToString(await textToDoc(text, { ...options, parser: 'angular' }), { ...options, parser: 'angular' } as Parameters<typeof doc.printer.printDocToString>[1]).formatted
    : ''
  const out = [head, restore(formatted).trimEnd()].filter(Boolean).join('\n\n')
  return doc.utils.replaceEndOfLine(out ? `${out}\n` : '')
}

const DIRECTIVE = /^@(import|input|model|type|interface)(?![\w$-])/

/** The leading directives and comments (kept as written, one per line), and the template after them. */
function split(text: string): { head: string; body: string } {
  const items: string[] = []
  let i = 0
  for (;;) {
    const start = skipSpace(text, i)
    if (text.startsWith('{{--', start)) {
      const close = text.indexOf('--}}', start + 4)
      const end = close === -1 ? text.length : close + 4
      items.push(text.slice(start, end))
      i = end
    } else if (DIRECTIVE.test(text.slice(start, start + 12))) {
      const end = directiveEnd(text, start)
      items.push(text.slice(start, end).replace(/[ \t]+$/gm, ''))
      i = end
    } else return { head: items.join('\n'), body: text.slice(start) }
  }
}

const skipSpace = (s: string, i: number) => { while (i < s.length && /\s/.test(s[i]!)) i++; return i }

/** The end of a directive: its line, and more lines while a bracket (or a type's <…>) it opened is still open. */
function directiveEnd(s: string, i: number): number {
  let depth = 0
  let angle = 0
  let defaults = false
  for (let j = i; j < s.length; j++) {
    const c = s[j]!
    if (c === '"' || c === "'" || c === '`') { j = closeString(s, j); continue }
    if (c === '=' && s[j + 1] === '>') { j++; continue }
    if (c === '=' && depth === 0 && angle === 0) defaults = true
    else if (c === '<' && !defaults) angle++
    else if (c === '>' && !defaults && angle > 0) angle--
    else if ('([{'.includes(c)) depth++
    else if (')]}'.includes(c) && depth > 0) depth--
    else if (c === '\n' && depth === 0 && angle === 0) return j
  }
  return s.length
}

/** Index of the quote closing the string that starts at `i`. */
function closeString(s: string, i: number): number {
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === '\\') j++
    else if (s[j] === s[i]) return j
  }
  return s.length
}

/**
 * The template with what Angular's parser doesn't know replaced by placeholders it keeps as they are, and a function
 * putting the originals back: {{-- --}} comments and verbatim contents become <!--cl:N--> comments; @slot('x') {
 * becomes @defer (__cl_slot__'x') { (a block Angular knows, whose parameter it prints as written).
 */
function setAside(body: string): { text: string; restore(formatted: string): string } {
  const saved: string[] = []
  const hold = (original: string) => `<!--cl:${saved.push(original) - 1}-->`
  // Comments and verbatim contents first (kept exactly), then text @s, then @slot.
  // The @ placeholder: &#64; with leading zeros until the file doesn't contain it, so the author's own entities stay.
  let at = '&#64;'
  while (body.includes(at)) at = at.replace('#', '#0')
  const kept = body
    .replace(/\{\{--[\s\S]*?--\}\}/g, hold)
    .replace(/(<([A-Za-z][\w-]*)\b[^>]*\sverbatim\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/g, (_, open: string, _tag: string, inner: string, close: string) => open + (inner ? hold(inner) : '') + close)
  const text = textAts(kept, at).replace(/@slot\s*\(/g, '@defer (__cl_slot__')
  return {
    text,
    restore: (formatted) => formatted
      .replace(/@defer \(__cl_slot__/g, '@slot(')
      .replaceAll(at, '@')
      .replace(/<!--cl:(\d+)-->/g, (_, n: string) => saved[Number(n)]!),
  }
}

// As the compiler reads blocks: @if/@for/@slot before a space or `(`; @else/@empty after a block's `}`.
const OPENER = /^@(if|for|slot)(?=[\s(])/
const FOLLOWER = /^@(else|empty)(?![\w$-])/

/**
 * Every @ in text that clarusjs reads as text (`<code>@for</code>`, `@clarusjs/content`, an email) written as `at`
 * (an `&#64;` entity), which Prettier keeps as it is (Angular would take `@name` for a block). Tags, holes, comments, <script>
 * and <style> bodies are left alone.
 */
function textAts(s: string, at: string): string {
  let out = ''
  for (let i = 0; i < s.length; ) {
    const c = s[i]!
    if (c === '<') {
      const raw = /^<(script|style)\b/i.exec(s.slice(i, i + 8))
      const end = raw ? s.indexOf(`</${raw[1]}`, i) : s.startsWith('<!--', i) ? s.indexOf('-->', i) + 3 : tagEnd(s, i) + 1
      const stop = end <= i ? s.length : end
      out += s.slice(i, stop)
      i = stop
    } else if (s.startsWith('{{', i)) {
      const end = s.indexOf('}}', i + 2)
      const stop = end === -1 ? s.length : end + 2
      out += s.slice(i, stop)
      i = stop
    } else if (c === '@') {
      const rest = s.slice(i, i + 8)
      const block = OPENER.test(rest) || (FOLLOWER.test(rest) && /\}\s*$/.test(out))
      out += block ? '@' : at
      i++
    } else {
      out += c
      i++
    }
  }
  return out
}

/** Index of the `>` ending the tag at `i`, quoted values skipped. */
function tagEnd(s: string, i: number): number {
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === '"' || s[j] === "'") { const e = s.indexOf(s[j]!, j + 1); if (e === -1) return s.length; j = e }
    else if (s[j] === '>') return j
  }
  return s.length
}
