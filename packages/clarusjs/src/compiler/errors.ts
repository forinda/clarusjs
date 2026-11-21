/**
 * A compile error pointing at a place in a .tscl file. Message format: `file:line:column text` (1-based), with the
 * parts as `file`, `line` and `column`. `compile()` and `parse()` throw it; `compile()`'s warnings are ones too.
 * @example
 * ```ts
 * try {
 *   compile(source, { file, target: 'server' })
 * } catch (err) {
 *   if (err instanceof ClarusError) report(err.file, err.line, err.column, err.message)
 *   else throw err
 * }
 * ```
 * @see https://clarusjs.com/reference/compiler#claruserror
 */
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
