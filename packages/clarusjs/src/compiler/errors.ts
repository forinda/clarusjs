/** A compile error pointing at a place in a .tscl file. Message format: `file:line:column text` (1-based). */
export class ClarusError extends Error {
  file: string
  line: number
  column: number

  constructor(text: string, file: string, source: string, offset: number) {
    const before = source.slice(0, offset)
    const line = before.split('\n').length
    const column = offset - (before.lastIndexOf('\n') + 1) + 1
    super(`${file}:${line}:${column} ${text}`)
    this.name = 'ClarusError'
    this.file = file
    this.line = line
    this.column = column
  }
}
