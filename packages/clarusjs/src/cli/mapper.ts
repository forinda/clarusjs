// `clarusjs mapper`: a TypeScript 7.1 content mapper for .tscl files. TypeScript runs it as a separate process
// (tsconfig `contentMappers: [{ "package": "clarusjs", "extensions": [".tscl"] }]`, with --runExternalCode or a
// trusted VS Code workspace) and speaks JSON-RPC 2.0 to it over stdio, Content-Length framed. Each .tscl file becomes
// the same TypeScript `clarusjs check` generates, with a span map, so errors, hover and completion land in the
// template; template syntax errors come back as the mapper's own diagnostics.
import { existsSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { generateTolerant } from '../check/generate.ts'
import { COMPONENT_DIRS, componentIndex, type ComponentNames } from '../compiler/components.ts'
import { readComponents } from '../vite/libraries.ts'
import { findClarusFiles } from '../vite/build.ts'
import { loaderOf } from './check.ts'

/**
 * The components a file can use by name (#458), each as a path relative to it (TypeScript resolves those; the build's
 * root paths it doesn't). The project: the nearest folder above with a package.json. Its folders: the config's
 * `components.dirs`, as the plugin or check last wrote them, else the default ones. ponytail: listed on each
 * transform; cache if it shows.
 */
function namesFor(fileName: string): ComponentNames | undefined {
  let root = dirname(fileName)
  while (!existsSync(resolve(root, 'package.json'))) {
    if (dirname(root) === root) return undefined
    root = dirname(root)
  }
  const written = readComponents(root)
  const files = findClarusFiles(resolve(root, 'src'), ['.tscl']).map((f) => relative(root, f).split(sep).join('/'))
  const rel = (path: string) => { const r = relative(dirname(fileName), resolve(root, path.slice(1))).split(sep).join('/'); return r.startsWith('.') ? r : `./${r}` }
  const names: ComponentNames = {}
  for (const [name, path] of Object.entries(componentIndex(files, written?.dirs ?? COMPONENT_DIRS).names)) names[name] = Array.isArray(path) ? path.map(rel) : rel(path)
  // Component libraries' names, as the plugin or `clarusjs check` last wrote them (imported by package path). The
  // app's own come from its files above, so they're never stale and win.
  for (const [name, path] of Object.entries(written?.names ?? {})) if (!(name in names) && ![path].flat().some((p) => p.startsWith('/'))) names[name] = path
  return names
}

/**
 * [virtual start, virtual length, original start, original length, kind, features?]: kind 0 = verbatim, 1 = atom (a
 * whole span). Features (a bitmask of language-service operations; all when absent) are none for atoms: they are
 * generated stand-ins (`__cl_p` for a component's props), so only their errors belong in the template, not hover,
 * completion or rename. Diagnostics can't be switched off per span.
 */
type Span = [number, number, number, number, 0 | 1] | [number, number, number, number, 1, number]
type Diagnostic = { messageText: string; start: number; length: number; code: number }

export function transform(params: { fileName: string; content: string }): { text: string; extension: '.ts'; mappings: Span[]; diagnostics: Diagnostic[] } {
  const { fileName, content } = params
  const loader = loaderOf(fileName)
  // Tolerant: while someone types, the template often doesn't parse; the rest of it still gets TypeScript.
  const { result, errors } = generateTolerant(content, fileName, { componentSuffix: '', components: namesFor(fileName), ...(loader ? { loader } : {}) })
  // The first error only: later ones may come from the repairs, not from the template.
  const diagnostics = errors.slice(0, 1).map((e) => ({ messageText: e.message, start: e.offset, length: Math.min(1, content.length - e.offset), code: 1 }))
  // Still broken: a module still, so imports of this file resolve (to nothing typed) while its template is fixed.
  if (!result) return { text: 'export {}\n', extension: '.ts', mappings: [], diagnostics }
  const { code, mappings } = result
  const spans: Span[] = mappings.map(([v, length, s, exact, sourceLength]): Span => {
    if (exact && code.slice(v, v + length) === content.slice(s, s + length)) return [v, length, s, length, 0]
    // A copy that isn't the template's text at that place (a trimmed, rearranged or repaired span) maps as a whole.
    if (exact) return [v, length, s, Math.min(length, content.length - s), 1]
    return [v, length, s, Math.min(sourceLength ?? 1, content.length - s), 1, 0]
  })
  return { text: code, extension: '.ts', mappings: spans, diagnostics }
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
