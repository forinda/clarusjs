// Semantic tokens for the template syntax (directives, block keywords, comments, hole delimiters, binding punctuation
// and names, component tags), so editors without the TextMate grammar colour it. Lexical, like the HTML view: a file
// being typed still gets them. One token per line segment, as LSP requires.

export const TOKEN_TYPES = ['keyword', 'variable', 'operator', 'comment', 'macro', 'type'] as const
export type Token = { line: number; character: number; length: number; type: number }

const T = Object.fromEntries(TOKEN_TYPES.map((t, i) => [t, i])) as Record<(typeof TOKEN_TYPES)[number], number>
const DIRECTIVE = /^[ \t]*(@(?:import|input|model|type|interface))(?![\w$-])/
const BLOCK = /^@(?:else\s+if|if|for|slot|else|empty)(?![\w$-])/

export function tokensOf(source: string, components: Set<string>): Token[] {
  const spans: [number, number, number][] = [] // [start, end, type]
  let atLineStart = true
  for (let i = 0; i < source.length; ) {
    if (atLineStart) {
      atLineStart = false
      const d = DIRECTIVE.exec(source.slice(i, i + 32))
      if (d) {
        const at = i + d[0].length - d[1]!.length
        spans.push([at, at + d[1]!.length, T.keyword])
        const eol = source.indexOf('\n', i)
        i = eol === -1 ? source.length : eol
        continue
      }
    }
    const c = source[i]!
    if (c === '\n') { atLineStart = true; i++; continue }
    if (source.startsWith('{{--', i)) {
      const e = source.indexOf('--}}', i + 4)
      const end = e === -1 ? source.length : e + 4
      spans.push([i, end, T.comment])
      i = end
      continue
    }
    if (source.startsWith('{{', i)) {
      spans.push([i, i + 2, T.macro])
      const e = source.indexOf('}}', i + 2)
      if (e === -1) break
      spans.push([e, e + 2, T.macro])
      i = e + 2
      continue
    }
    if (c === '@') {
      const b = BLOCK.exec(source.slice(i, i + 16))
      if (b) { spans.push([i, i + b[0].length, T.keyword]); i += b[0].length; continue }
    }
    if (c === '<') {
      const m = /^<\/?([A-Za-z][\w:.-]*)/.exec(source.slice(i, i + 64))
      if (!m) { i++; continue }
      const nameStart = i + m[0].length - m[1]!.length
      if (components.has(m[1]!)) spans.push([nameStart, nameStart + m[1]!.length, T.type])
      // Binding names in the tag: [x], (x), [(x)].
      let j = i + m[0].length
      const close = source.indexOf('>', j)
      const end = close === -1 ? source.length : close
      for (const a of source.slice(j, end).matchAll(/(\[\(|\[|\()([\w.:-]+)(\)\]|\]|\))(?==)/g)) {
        const at = j + a.index!
        spans.push([at, at + a[1]!.length, T.operator])
        spans.push([at + a[1]!.length, at + a[1]!.length + a[2]!.length, T.variable])
        const p = at + a[1]!.length + a[2]!.length
        spans.push([p, p + a[3]!.length, T.operator])
      }
      // Holes inside attribute values.
      for (const h of source.slice(j, end).matchAll(/\{\{|\}\}/g)) spans.push([j + h.index!, j + h.index! + 2, T.macro])
      i = end === source.length ? end : end + 1
      continue
    }
    i++
  }
  // Split each span at line breaks, and give line/character.
  const tokens: Token[] = []
  let line = 0
  let lineStart = 0
  let cursor = 0
  for (const [start, end, type] of spans.sort((a, b) => a[0] - b[0])) {
    for (; cursor < start; cursor++) if (source[cursor] === '\n') { line++; lineStart = cursor + 1 }
    let from = start
    for (let k = start; k <= end; k++) {
      if (k === end || source[k] === '\n') {
        if (k > from) tokens.push({ line, character: from - lineStart, length: k - from, type })
        if (k < end) { line++; lineStart = k + 1; from = k + 1 }
      }
    }
    cursor = Math.max(cursor, end)
  }
  return tokens
}
