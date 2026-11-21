// LSP positions (0-based line, UTF-16 character) ⇄ offsets into the text, and the compiler's 1-based line:column.
import { expect, test } from 'vitest'
import { fromLineColumn, offsetAt, positionAt } from '../src/positions.ts'

test('round trip with non-ASCII text (é, an emoji: two UTF-16 units) and CRLF line endings', () => {
  const text = 'café\r\n<p>😀 {{ x }}</p>\r\nend'
  for (let offset = 0; offset <= text.length; offset++) {
    if (text[offset - 1] === '\r') continue // between \r and \n is not a position an editor sends
    expect(offsetAt(text, positionAt(text, offset)), `offset ${offset}`).toBe(offset)
  }
  expect(positionAt(text, text.indexOf('{{'))).toEqual({ line: 1, character: 6 }) // < p > (3) + 😀 (2) + space
  expect(positionAt(text, text.indexOf('end'))).toEqual({ line: 2, character: 0 })
  // A character past the line's end stays on that line (before its \r\n).
  expect(offsetAt(text, { line: 0, character: 99 })).toBe(4)
})

test('the compiler\'s 1-based line:column (as in its errors) becomes an LSP position', () => {
  expect(fromLineColumn(2, 7)).toEqual({ line: 1, character: 6 })
})
