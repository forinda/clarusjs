// Where the cursor is, lexically: in a tag's name, an attribute's name or value, an @import specifier, a directive
// being typed, or text. Never throws: the buffer being typed rarely parses. Inside a <script> or <style> body it's
// text: those are JavaScript and CSS, not template.
import { scan } from './blank.ts'

export type Context =
  | { kind: 'tag-name'; prefix: string; start: number }
  | { kind: 'attr-name'; tag: string; prefix: string; start: number }
  | { kind: 'attr-value'; tag: string; attr: string }
  | { kind: 'import-path'; prefix: string; start: number; end: number }
  | { kind: 'directive'; prefix: string; start: number }
  | { kind: 'text' }

export function contextAt(text: string, offset: number): Context {
  const { scripts, styles } = scan(text)
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
  // Inside a tag: the nearest `<name` before the cursor with no `>` after it outside quotes (a binding's value can
  // hold `=>` or `a > b`).
  const lt = tagStart(text, offset)
  if (lt !== -1) {
    const inside = text.slice(lt + 1, offset)
    const name = /^[A-Za-z][\w:.-]*/.exec(inside)?.[0] ?? ''
    if (inside.length <= name.length) return { kind: 'tag-name', prefix: inside, start: lt + 1 }
    // In an attribute value when an odd number of quotes comes before the cursor.
    const quotes = (inside.match(/"/g) ?? []).length
    if (quotes % 2 === 1) {
      const attr = /(\S+)="[^"]*$/.exec(inside)?.[1] ?? ''
      return { kind: 'attr-value', tag: name, attr }
    }
    const prefix = /[^\s"]*$/.exec(inside)?.[0] ?? ''
    return { kind: 'attr-name', tag: name, prefix, start: offset - prefix.length }
  }
  if (text[offset - 1] === '<') return { kind: 'tag-name', prefix: '', start: offset }
  // A directive being typed: `@` and a word at the cursor, in text.
  const at = /@[\w]*$/.exec(line)
  if (at && !/["'`]/.test(line.slice(0, line.length - at[0].length).slice(-1))) return { kind: 'directive', prefix: at[0], start: offset - at[0].length }
  return { kind: 'text' }
}

/** Where the tag the cursor is in starts (its `<`), or -1: quotes are followed, so a `>` in a value doesn't end it. */
function tagStart(text: string, offset: number): number {
  for (let lt = text.lastIndexOf('<', offset - 1); lt !== -1; lt = text.lastIndexOf('<', lt - 1)) {
    if (!/[A-Za-z]/.test(text[lt + 1] ?? '')) continue // `a < b` in a value, not a tag
    let quote = ''
    for (let k = lt + 1; k < offset; k++) {
      const c = text[k]!
      if (quote) { if (c === quote) quote = '' }
      else if (c === '"' || c === "'") quote = c
      else if (c === '>') return -1 // the tag closed before the cursor
    }
    return lt
  }
  return -1
}
