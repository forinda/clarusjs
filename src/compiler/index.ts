// Public compiler entry. Pure: string in, string out.
import { emitServer } from './emit-server.ts'
import { lower } from './ir.ts'
import { parse } from './parse.ts'

export { KviewError } from './errors.ts'

export type CompileOptions = { file: string; target: 'server' | 'client'; clientUrl?: string }
export type CompileResult = { code: string; stateful: boolean }

export function compile(source: string, options: CompileOptions): CompileResult {
  const ir = lower(parse(source, options.file), options.file, source)
  if (options.target === 'client') throw new Error('client target not implemented')
  if (ir.stateful && !options.clientUrl) throw new Error(`[kview] ${options.file}: clientUrl is required to compile a stateful component for the server`)
  return { code: emitServer(ir, options.clientUrl ?? ''), stateful: ir.stateful }
}
