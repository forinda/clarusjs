// The HTML view of a .tscl template: its own syntax (directives, comments, holes, blocks, binding values, script
// bodies) blanked to spaces, newlines kept, so the text has the same length and every offset is where it was.
// Volar's HTML and Emmet services run on it. A lexical scan, not the compiler's parser: the buffer being typed rarely
// parses, and this must answer anyway.

export type Range = [number, number]
export type Scan = { blank: Range[]; styles: Range[]; scripts: Range[] }

const DIRECTIVE = /^[ \t]*@(import|input|model|type|interface)(?![\w$-])/
// As the compiler reads them: @if/@for/@slot need a space or `(` after (an email's @if.com isn't one); @else and
// @empty only follow a block's closing brace.
const OPENER = /^@(if|for|slot)(?=[\s(])/
const FOLLOWER = /^@(else\s+if(?=[\s(])|else(?=[\s{])|empty(?=[\s{]))/
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])

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

/**
 * Scan a tag starting at `i` (s[i] is `<`): blank binding values and holes in values; script bodies; record styles.
 * `depth` is how the tag changes the open-element count (an opening tag +1, a closing one -1, void/self-closing 0).
 */
function tag(s: string, i: number, out: Scan): { end: number; depth: number } {
  const m = /^<(\/?)([A-Za-z][\w:.-]*)/.exec(s.slice(i, i + 64))
  if (!m) return { end: i + 1, depth: 0 }
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
  const selfClosing = s[j - 2] === '/' || VOID.has(name)
  if (closing) return { end: j, depth: -1 }
  if ((name !== 'script' && name !== 'style') || selfClosing) return { end: j, depth: selfClosing ? 0 : 1 }
  const close = new RegExp(`</${name}(?=[\\s/>])`, 'i').exec(s.slice(j))
  const bodyEnd = close ? j + close.index : s.length
  if (name === 'style') out.styles.push([j, bodyEnd])
  else { out.blank.push([j, bodyEnd]); out.scripts.push([j, bodyEnd]) }
  return { end: bodyEnd, depth: 1 } // its close tag follows and takes the 1 back
}

/** The end of a block opener's head at `j` (after its keyword): the `(…)` if any, then a `{` if any. */
function blockHead(s: string, i: number, j: number, condition: boolean): { end: number; opened: boolean } {
  if (condition) {
    j = skipSpace(s, j)
    j = s[j] === '(' ? closeBracket(s, j) : lineEnd(s, i)
  }
  const k = skipSpace(s, j)
  return s[k] === '{' ? { end: k + 1, opened: true } : { end: j, opened: false }
}

/** The ranges to blank, and the `<style>` bodies (for their CSS views). */
export function scan(s: string): Scan {
  const out: Scan = { blank: [], styles: [], scripts: [] }
  const blocks: number[] = [] // open template blocks, each with the element depth it opened at
  let depth = 0 // open elements
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
      const b = OPENER.exec(s.slice(i, i + 8))
      if (b) {
        const head = blockHead(s, i, i + b[0].length, true)
        if (head.opened) blocks.push(depth)
        out.blank.push([i, head.end])
        i = head.end
        continue
      }
    }
    // A block's own closing brace: at the element depth it opened at (a `}` inside an element is text).
    if (c === '}' && blocks.length && blocks.at(-1) === depth) {
      blocks.pop()
      out.blank.push([i, i + 1])
      i++
      // @else / @else if / @empty follow a block's brace.
      const k = skipSpace(s, i)
      const f = FOLLOWER.exec(s.slice(k, k + 12))
      if (f) {
        const head = blockHead(s, k, k + f[0].length, f[1]!.startsWith('else ') || /^else\s+if/.test(f[1]!))
        if (head.opened) blocks.push(depth)
        out.blank.push([k, head.end])
        i = head.end
      }
      continue
    }
    if (c === '<') {
      if (s.startsWith('<!--', i)) { const e = s.indexOf('-->', i + 4); i = e === -1 ? s.length : e + 3; continue }
      const t = tag(s, i, out)
      depth = Math.max(0, depth + t.depth)
      i = t.end
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
