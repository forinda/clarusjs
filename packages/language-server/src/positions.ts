// LSP positions (0-based line, character in UTF-16 units, as JavaScript strings count) ⇄ offsets into the text.

export type Position = { line: number; character: number }

/** Offsets where each line starts (the last text's kept: references and renames ask many times for one text). */
let last: { text: string; starts: number[] } | undefined
const lineStarts = (text: string) => {
  if (last?.text === text) return last.starts
  const starts = [0]
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1)
  last = { text, starts }
  return starts
}

export function positionAt(text: string, offset: number): Position {
  const starts = lineStarts(text)
  // Binary search: the last line starting at or before the offset.
  let lo = 0
  let hi = starts.length - 1
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid]! <= offset) lo = mid; else hi = mid - 1 }
  const line = lo
  return { line, character: offset - starts[line]! }
}

/** A character past the end of its line stays on that line (before its \r\n). */
export function offsetAt(text: string, position: Position): number {
  const starts = lineStarts(text)
  if (position.line >= starts.length) return text.length
  const start = starts[position.line]!
  let end = position.line + 1 < starts.length ? starts[position.line + 1]! - 1 : text.length
  if (text[end - 1] === '\r') end--
  return Math.min(start + Math.max(0, position.character), end)
}

/** The compiler's 1-based line and column (as in its errors) as an LSP position. */
export const fromLineColumn = (line: number, column: number): Position => ({ line: line - 1, character: column - 1 })
