// Where the cursor is, lexically: in a tag's name, an attribute's name or value, an @import specifier, a directive
// being typed, or text. Never throws: the buffer being typed rarely parses.

export type Context =
  | { kind: 'tag-name'; prefix: string; start: number }
  | { kind: 'attr-name'; tag: string; prefix: string; start: number }
  | { kind: 'attr-value'; tag: string; attr: string }
  | { kind: 'import-path'; prefix: string; start: number; end: number }
  | { kind: 'directive'; prefix: string; start: number }
  | { kind: 'text' }

export function contextAt(text: string, offset: number): Context {
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
  // Inside a tag: the last `<` before the cursor with no `>` after it.
  const lt = text.lastIndexOf('<', offset - 1)
  if (lt !== -1 && lt > text.lastIndexOf('>', offset - 1) && /[A-Za-z]/.test(text[lt + 1] ?? 'x')) {
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
  if (lt !== -1 && offset === lt + 1) return { kind: 'tag-name', prefix: '', start: offset }
  // A directive being typed: `@` and a word at the cursor, in text.
  const at = /@[\w]*$/.exec(line)
  if (at && !/["'`]/.test(line.slice(0, line.length - at[0].length).slice(-1))) return { kind: 'directive', prefix: at[0], start: offset - at[0].length }
  return { kind: 'text' }
}
