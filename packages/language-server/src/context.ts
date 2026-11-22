// Where the cursor is, lexically: in a tag's name, an attribute's name or value, an @import specifier, a directive
// being typed, or text. Never throws: the buffer being typed rarely parses. Inside a <script> or <style> body it's
// text: those are JavaScript and CSS, not template.
import { blankOut, scan } from './blank.ts'

export type Context =
  | { kind: 'tag-name'; prefix: string; start: number }
  | { kind: 'attr-name'; tag: string; prefix: string; start: number }
  | { kind: 'attr-value'; tag: string; attr: string; prefix: string; start: number } // prefix: the value typed before the cursor
  | { kind: 'import-path'; prefix: string; start: number; end: number }
  | { kind: 'directive'; prefix: string; start: number }
  | { kind: 'text' }

export function contextAt(text: string, offset: number): Context {
  const { blank, scripts, styles } = scan(text)
  if ([...scripts, ...styles].some(([a, b]) => offset >= a && offset <= b)) return { kind: 'text' }
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1
  const line = text.slice(lineStart, offset)
  // An @import specifier, up to the cursor.
  const imp = /^[ \t]*@import\s+[A-Za-z_$][\w$-]*\s+from\s+(['"])([^'"]*)$/.exec(line)
  if (imp) {
    const start = offset - imp[2]!.length
    const close = text.indexOf(imp[1]!, offset)
    const eol = text.indexOf('\n', offset)
    return { kind: 'import-path', prefix: imp[2]!, start, end: close !== -1 && (eol === -1 || close < eol) ? close : offset }
  }
  // Inside a tag: read forward over the HTML view (binding values and holes blanked), following quotes.
  const tag = openTag(blankOut(text, blank), offset)
  if (tag) {
    const inside = text.slice(tag.start + 1, offset)
    const name = /^[A-Za-z][\w:.-]*/.exec(inside)?.[0] ?? ''
    if (inside.length <= name.length) return { kind: 'tag-name', prefix: inside, start: tag.start + 1 }
    if (tag.quote !== -1) {
      const attr = /([^\s=]+)\s*=\s*$/.exec(text.slice(tag.start + 1, tag.quote))?.[1] ?? ''
      return { kind: 'attr-value', tag: name, attr, prefix: text.slice(tag.quote + 1, offset), start: tag.quote + 1 }
    }
    const prefix = /[^\s"']*$/.exec(inside)?.[0] ?? ''
    return { kind: 'attr-name', tag: name, prefix, start: offset - prefix.length }
  }
  if (text[offset - 1] === '<') return { kind: 'tag-name', prefix: '', start: offset }
  // A directive being typed: `@` and a word at the cursor, in text.
  const at = /@[\w]*$/.exec(line)
  if (at && !/["'`]/.test(line.slice(0, line.length - at[0].length).slice(-1))) return { kind: 'directive', prefix: at[0], start: offset - at[0].length }
  return { kind: 'text' }
}

/** The tag the cursor is in (its `<`), and the quote it's inside (-1 if none); a `<` in a value isn't a tag. */
function openTag(view: string, offset: number): { start: number; quote: number } | undefined {
  let start = -1
  let quote = -1
  for (let i = 0; i < offset; i++) {
    const c = view[i]!
    if (start === -1) {
      if (c !== '<') continue
      if (view.startsWith('<!--', i)) { const e = view.indexOf('-->', i + 4); if (e === -1 || e + 3 > offset) return undefined; i = e + 2; continue }
      if (/[A-Za-z]/.test(view[i + 1] ?? '')) start = i
    } else if (quote !== -1) { if (c === view[quote]) quote = -1 }
    else if (c === '"' || c === "'") quote = i
    else if (c === '>') start = -1
  }
  return start === -1 ? undefined : { start, quote }
}
