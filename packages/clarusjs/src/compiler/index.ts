// Public compiler entry. Pure: string in, string out.
import { emitClient } from './emit-client.ts'
import { emitServer } from './emit-server.ts'
import { lower } from './ir.ts'
import { parse, type TemplateNode } from './parse.ts'

export { ClarusError } from './errors.ts'

/**
 * `renderImports`: import child components' render functions with `?render`, for a render module that runs in the
 * browser (a client route's page, or a component re-rendered inside an island).
 */
/** `scope`: the id that scopes this component's styles (default: from the file name). */
export type CompileOptions = { file: string; target: 'server' | 'client'; clientUrl?: string; renderImports?: boolean; scope?: string }
/** `css`: the component's stylesheet (scoped blocks wrapped in @scope, global ones as written); '' without <style>. */
export type CompileResult = { code: string; stateful: boolean; css: string }

export function compile(source: string, options: CompileOptions): CompileResult {
  const parsed = parse(source, options.file)
  let css = ''
  if (parsed.styles.some((s) => !s.global)) {
    // Native @scope: rules apply inside the component's top-level elements (style those with :scope) and stop at
    // the next component's elements. The top-level elements are marked so the scope can find them.
    const id = options.scope ?? scopeId(options.file)
    const components = new Set(parsed.imports.map((imp) => imp.name))
    markRoots(parsed.nodes, id, components)
    for (const s of parsed.styles) {
      if (s.global) { css += s.css; continue }
      // Statements that must be top-level (@reference for Tailwind's @apply, @import) go before the @scope block.
      const head = /^(?:\s*@(?:reference|import)\b[^;{]*;)+/.exec(s.css)?.[0] ?? ''
      const statements = head.split(';').map((x) => x.trim()).filter(Boolean).map((x) => `${x};\n`).join('')
      css += `${statements}@scope ([data-cl-c="${id}"]) to ([data-cl-c]) {${s.css.slice(head.length).replace(/\s*$/, '')}\n}\n`
    }
  } else {
    css = parsed.styles.map((s) => s.css).join('')
  }
  const ir = lower(parsed, options.file, source)
  if (options.target === 'client') return { code: emitClient(ir), stateful: ir.stateful, css }
  if (ir.stateful && !options.clientUrl) throw new Error(`[clarusjs] ${options.file}: clientUrl is required to compile a stateful component for the server`)
  return { code: emitServer(ir, options.clientUrl ?? '', options.renderImports), stateful: ir.stateful, css }
}

/** 'src/components/card.tscl' → 'card-<short hash of the path>'. */
export function scopeId(file: string): string {
  let h = 0x811c9dc5 // FNV-1a
  for (let i = 0; i < file.length; i++) h = Math.imul(h ^ file.charCodeAt(i), 0x01000193)
  const name = (file.split(/[\\/]/).pop() ?? 'c').replace(/\.tscl$/, '').replace(/[^\w-]/g, '') || 'c'
  return `${name}-${(h >>> 0).toString(36)}`
}

/** The component's top-level HTML elements (also inside top-level @if/@for) get data-cl-c="id". */
function markRoots(nodes: TemplateNode[], id: string, components: Set<string>): void {
  for (const node of nodes) {
    if (node.type === 'element' && !components.has(node.tag) && node.tag !== 'slot') {
      node.attrs.push({ kind: 'static', name: 'data-cl-c', value: id, start: node.start })
    } else if (node.type === 'if') {
      for (const b of node.branches) markRoots(b.children, id, components)
    } else if (node.type === 'for') {
      markRoots(node.children, id, components)
      if (node.empty) markRoots(node.empty, id, components)
    }
  }
}
