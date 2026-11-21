// The HTML view of a .tscl template: its own syntax (directives, comments, holes, blocks, binding values, script
// bodies) blanked to spaces, newlines kept, so the text has the same length and every offset is where it was.
// Volar's HTML and Emmet services run on it. A lexical scan, not the compiler's parser: the buffer being typed rarely
// parses, and this must answer anyway.

export type Range = [number, number]
export type Scan = { blank: Range[]; styles: Range[] }

const DIRECTIVE = /^[ \t]*@(import|input|model|type|interface)(?![\w$-])/
const BLOCK = /^@(else\s+if|if|for|slot|else|empty)(?![\w$-])/

/** Index after the quote that closes the string starting at `i` (s[i] is the quote), or the end. */
function skipString(s: string, i: number): number {
  const q = s[i]
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === '\\') j++
    else if (s[j] === q) return j + 1
  }
  return s.length
}

/** Index after the bracket closing the one at `i`, strings skipped, or the end. */
function closeBracket(s: string, i: number): number {
  let depth = 0
  for (let j = i; j < s.length; j++) {
    const c = s[j]!
    if (c === '"' || c === "'" || c === '`') { j = skipString(s, j) - 1; continue }
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') if (--depth === 0) return j + 1
  }
  return s.length
}

/** Index after the `}}` closing the hole at `i` (`{{`), strings skipped, or the end. */
function closeHole(s: string, i: number): number {
  for (let j = i + 2; j < s.length; j++) {
    const c = s[j]!
    if (c === '"' || c === "'" || c === '`') { j = skipString(s, j) - 1; continue }
    if (c === '}' && s[j + 1] === '}') return j + 2
  }
  return s.length
}

/** End of a directive starting at `i`: its line, and more lines while a bracket it opened is still open. */
function directiveEnd(s: string, i: number): number {
  let depth = 0
  for (let j = i; j < s.length; j++) {
    const c = s[j]!
    if (c === '"' || c === "'" || c === '`') { j = skipString(s, j) - 1; continue }
    if (c === '(' || c === '[' || c === '{') depth++
    else if ((c === ')' || c === ']' || c === '}') && depth > 0) depth--
    else if (c === '\n' && depth === 0) return j
  }
  return s.length
}

const skipSpace = (s: string, i: number) => { while (i < s.length && /\s/.test(s[i]!)) i++; return i }
const lineEnd = (s: string, i: number) => { const n = s.indexOf('\n', i); return n === -1 ? s.length : n }

/** Scan a tag starting at `i` (s[i] is `<`): blank binding values and holes in values; script bodies; record styles. */
function tag(s: string, i: number, out: Scan): number {
  const m = /^<(\/?)([A-Za-z][\w:.-]*)/.exec(s.slice(i, i + 64))
  if (!m) return i + 1
  const closing = m[1] === '/'
  const name = m[2]!.toLowerCase()
  let j = i + m[0].length
  while (j < s.length && s[j] !== '>') {
    j = skipSpace(s, j)
    if (s[j] === '>' || (s[j] === '/' && s[j + 1] === '>')) break
    const start = j
    while (j < s.length && !/[\s=>]/.test(s[j]!) && !(s[j] === '/' && s[j + 1] === '>')) j++
    const attr = s.slice(start, j)
    if (j === start) { j++; continue }
    j = skipSpace(s, j)
    if (s[j] !== '=') continue
    j = skipSpace(s, j + 1)
    if (s[j] !== '"' && s[j] !== "'") continue
    const end = s.indexOf(s[j]!, j + 1)
    const stop = end === -1 ? s.length : end
    // [prop], (event), [(model)]: the value is code. Elsewhere only its {{ }} holes are.
    if (attr.startsWith('[') || attr.startsWith('(')) out.blank.push([j + 1, stop])
    else for (let k = j + 1; k < stop; k++) if (s[k] === '{' && s[k + 1] === '{') { const e = Math.min(closeHole(s, k), stop); out.blank.push([k, e]); k = e - 1 }
    j = stop + 1
  }
  j = Math.min(j + 1, s.length)
  if (closing || (name !== 'script' && name !== 'style') || s[j - 2] === '/') return j
  const close = new RegExp(`</${name}(?=[\\s/>])`, 'i').exec(s.slice(j))
  const bodyEnd = close ? j + close.index : s.length
  if (name === 'style') out.styles.push([j, bodyEnd])
  else out.blank.push([j, bodyEnd])
  return bodyEnd
}

/** The ranges to blank, and the `<style>` bodies (for their CSS views). */
export function scan(s: string): Scan {
  const out: Scan = { blank: [], styles: [] }
  let blocks = 0 // template blocks open: their closing `}` is template syntax
  let atLineStart = true
  for (let i = 0; i < s.length; ) {
    if (atLineStart) {
      atLineStart = false
      const d = DIRECTIVE.exec(s.slice(i, i + 32))
      if (d) {
        const at = i + d[0].indexOf('@')
        const end = directiveEnd(s, at)
        out.blank.push([at, end])
        i = end
        continue
      }
    }
    const c = s[i]!
    if (c === '\n') { atLineStart = true; i++; continue }
    if (c === '{' && s[i + 1] === '{') {
      const end = s.startsWith('{{--', i) ? (s.indexOf('--}}', i + 4) === -1 ? s.length : s.indexOf('--}}', i + 4) + 4) : closeHole(s, i)
      out.blank.push([i, end])
      i = end
      continue
    }
    if (c === '@') {
      const b = BLOCK.exec(s.slice(i, i + 16))
      if (b) {
        let j = i + b[0].length
        if (b[1] !== 'else' && b[1] !== 'empty') {
          j = skipSpace(s, j)
          j = s[j] === '(' ? closeBracket(s, j) : lineEnd(s, i)
        }
        const k = skipSpace(s, j)
        if (s[k] === '{') { j = k + 1; blocks++ }
        out.blank.push([i, j])
        i = j
        continue
      }
    }
    if (c === '}' && blocks > 0) { out.blank.push([i, i + 1]); blocks--; i++; continue }
    if (c === '<') {
      if (s.startsWith('<!--', i)) { const e = s.indexOf('-->', i + 4); i = e === -1 ? s.length : e + 3; continue }
      i = tag(s, i, out)
      continue
    }
    i++
  }
  return out
}

/** `source` with `ranges` replaced by spaces, newlines kept. */
export function blankOut(source: string, ranges: Range[]): string {
  const chars = source.split('')
  for (const [a, b] of ranges) for (let k = a; k < b; k++) if (chars[k] !== '\n' && chars[k] !== '\r') chars[k] = ' '
  return chars.join('')
}

/** The template as HTML: its own syntax blanked. */
export const htmlView = (source: string) => blankOut(source, scan(source).blank)
