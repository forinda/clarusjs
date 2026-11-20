// Public compiler entry. Pure: string in, string out.
import { emitClient } from './emit-client.ts'
import { emitServer } from './emit-server.ts'
import { lower } from './ir.ts'
import { parse } from './parse.ts'

export { ClarusError } from './errors.ts'

/**
 * `renderImports`: import child components' render functions with `?render`, for a render module that runs in the
 * browser (a client route's page, or a component re-rendered inside an island).
 */
export type CompileOptions = { file: string; target: 'server' | 'client'; clientUrl?: string; renderImports?: boolean }
export type CompileResult = { code: string; stateful: boolean }

export function compile(source: string, options: CompileOptions): CompileResult {
  const ir = lower(parse(source, options.file), options.file, source)
  if (options.target === 'client') return { code: emitClient(ir), stateful: ir.stateful }
  if (ir.stateful && !options.clientUrl) throw new Error(`[clarusjs] ${options.file}: clientUrl is required to compile a stateful component for the server`)
  return { code: emitServer(ir, options.clientUrl ?? '', options.renderImports), stateful: ir.stateful }
}
