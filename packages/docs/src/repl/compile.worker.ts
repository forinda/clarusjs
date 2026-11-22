// The playground's compiler, off the page's main thread (#230): typing stays smooth however big the component. Gets a
// source, answers with the compiled modules (as shown in the Server/Client tabs) and the same prepared for the preview.
import { ClarusError, compile } from 'clarusjs/compiler'
import { prepare } from './prepare.ts'

/** What the page asks: compile `source` (the run's number `id`). */
export type CompileRequest = { id: number; source: string }
/** The answer: the outputs, or a located error. */
export type CompileReply =
  | { id: number; server: string; client: string | null; preparedServer: string; preparedClient: string | null }
  | { id: number; error: string }

addEventListener('message', (event: MessageEvent<CompileRequest>) => {
  const { id, source } = event.data
  let reply: CompileReply
  try {
    const server = compile(source, { file: 'App.tscl', target: 'server', clientUrl: '/app.js' }).code
    const c = compile(source, { file: 'App.tscl', target: 'client' })
    const client = c.stateful ? c.code : null
    reply = { id, server, client, preparedServer: prepare(server), preparedClient: client && prepare(client) }
  } catch (err) {
    // A compile error, shown where it is, as line:col.
    const error = err instanceof ClarusError ? `${err.line}:${err.column} ${err.message.slice(err.message.indexOf(' ') + 1)}` : err instanceof Error ? err.message : String(err)
    reply = { id, error }
  }
  postMessage(reply)
})
