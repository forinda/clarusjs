// LSP positions (0-based line, character in UTF-16 units, as JavaScript strings count) ⇄ offsets into the text.

export type Position = { line: number; character: number }

/** Offsets where each line starts. */
const lineStarts = (text: string) => {
  const starts = [0]
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1)
  return starts
}

export function positionAt(text: string, offset: number): Position {
  const starts = lineStarts(text)
  let line = 0
  while (line + 1 < starts.length && starts[line + 1]! <= offset) line++
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
