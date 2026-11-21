// `clarusjs mapper`: a TypeScript 7.1 content mapper for .tscl files. TypeScript runs it as a separate process
// (tsconfig `contentMappers: [{ "package": "clarusjs", "extensions": [".tscl"] }]`, with --runExternalCode or a
// trusted VS Code workspace) and speaks JSON-RPC 2.0 to it over stdio, Content-Length framed. Each .tscl file becomes
// the same TypeScript `clarusjs check` generates, with a span map, so errors, hover and completion land in the
// template; template syntax errors come back as the mapper's own diagnostics.
import { ClarusError } from '../compiler/errors.ts'
import { generateTs } from '../check/generate.ts'
import { loaderOf } from './check.ts'

/** [virtual start, virtual length, original start, original length, kind]: 0 = verbatim, 1 = atom (a whole span). */
type Span = [number, number, number, number, 0 | 1]
type Diagnostic = { messageText: string; start: number; length: number; code: number }

export function transform(params: { fileName: string; content: string }): { text: string; extension: '.ts'; mappings: Span[]; diagnostics: Diagnostic[] } {
  const { fileName, content } = params
  try {
    const loader = loaderOf(fileName)
    const { code, mappings } = generateTs(content, fileName, { componentSuffix: '', ...(loader ? { loader } : {}) })
    const spans: Span[] = mappings.map(([v, length, s, exact]) =>
      // A copy that isn't the template's text at that place (a trimmed or rearranged span) maps as a whole.
      exact && code.slice(v, v + length) === content.slice(s, s + length) ? [v, length, s, length, 0] : [v, length, s, Math.min(1, content.length - s), 1])
    return { text: code, extension: '.ts', mappings: spans, diagnostics: [] }
  } catch (err) {
    if (!(err instanceof ClarusError)) throw err
    const lines = content.split('\n')
    const start = Math.min(content.length, lines.slice(0, err.line - 1).reduce((n, l) => n + l.length + 1, 0) + err.column - 1)
    const messageText = err.message.slice(`${err.file}:${err.line}:${err.column} `.length)
    // A module still, so imports of this file resolve (to nothing typed) while its template is fixed.
    return { text: 'export {}\n', extension: '.ts', mappings: [], diagnostics: [{ messageText, start, length: Math.min(1, content.length - start), code: 1 }] }
  }
}

function handle(request: { id?: number | string; method: string; params?: any }): object | undefined {
  if (request.id === undefined) return // a notification
  switch (request.method) {
    // Offsets are JavaScript string indexes: UTF-16.
    case 'initialize': return { id: request.id, result: { positionEncoding: 'utf-16', diagnosticSource: 'clarus' } }
    case 'openProject': return { id: request.id, result: {} }
    case 'closeProject': return { id: request.id, result: null }
    case 'transform': return { id: request.id, result: transform(request.params) }
    default: return { id: request.id, error: { code: -32601, message: `Unknown method: ${request.method}` } }
  }
}

/** Serve the protocol on stdin/stdout until stdin ends. */
export function serve(): void {
  const send = (message: object) => {
    const body = Buffer.from(JSON.stringify({ jsonrpc: '2.0', ...message }))
    process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`)
    process.stdout.write(body)
  }
  let pending = Buffer.alloc(0)
  process.stdin.on('data', (chunk: Buffer) => {
    pending = Buffer.concat([pending, chunk])
    for (;;) {
      const headerEnd = pending.indexOf('\r\n\r\n')
      if (headerEnd === -1) return
      const match = /Content-Length:\s*(\d+)/i.exec(pending.subarray(0, headerEnd).toString())
      if (!match) throw new Error('clarusjs mapper: a message without Content-Length')
      const start = headerEnd + 4
      const end = start + Number(match[1])
      if (pending.length < end) return
      const request = JSON.parse(pending.subarray(start, end).toString())
      pending = pending.subarray(end)
      let response: object | undefined
      try { response = handle(request) } catch (err) { response = { id: request.id, error: { code: -32603, message: (err as Error).message } } }
      if (response) send(response)
    }
  })
  process.stdin.on('end', () => process.exit(0))
}
