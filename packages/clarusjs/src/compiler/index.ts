// Public compiler entry. Pure: string in, string out.
import { emitClient } from './emit-client.ts'
import { ClarusError } from './errors.ts'
import { emitServer } from './emit-server.ts'
import { lower } from './ir.ts'
import { parse, type TemplateNode } from './parse.ts'

export { ClarusError } from './errors.ts'
export { parse } from './parse.ts'
export type { ParsedFile, InputDecl, ImportDecl, TemplateNode, Attr } from './parse.ts'

/**
 * `renderImports`: import child components' render functions with `?render`, for a render module that runs in the
 * browser (a client route's page, or a component re-rendered inside an island).
 */
/** `scope`: the id that scopes this component's styles (default: from the file name). */
export type CompileOptions = { file: string; target: 'server' | 'client'; clientUrl?: string; renderImports?: boolean; scope?: string }
/**
 * `css`: the component's stylesheet (`<style scoped>` blocks wrapped in @scope, the others as written); '' without
 * <style>. `warnings`: things that compile but likely aren't meant (each a located ClarusError, not thrown).
 */
export type CompileResult = { code: string; stateful: boolean; css: string; warnings: ClarusError[] }

export function compile(source: string, options: CompileOptions): CompileResult {
  const parsed = parse(source, options.file)
  const warnings: ClarusError[] = []
  // Every component's top-level elements carry its scope class, styled or not: a parent's scope then takes in a
  // child's top-level element and stops inside it.
  const id = options.scope ?? scopeId(options.file)
  markRoots(parsed.nodes, `cl-c-${id}`, new Set(parsed.imports.map((imp) => imp.name)))
  let css = ''
  for (const s of parsed.styles) {
    if (s.mode === 'plain') {
      // ponytail: for one minor version after <style> stopped being scoped by default; drop the warning after it.
      warnings.push(new ClarusError('a plain <style> is global: add `scoped` to scope it to this component (it used to be scoped by default), or `global` to keep it global without this warning', options.file, source, s.tag))
    }
    if (s.mode !== 'scoped') { css += s.css; continue }
    // Native @scope: rules apply inside the component's top-level elements (style those with :scope) and to the
    // top-level elements of the components it renders, not inside those.
    // Statements that must be top-level (@reference for Tailwind's @apply, @import) go before the @scope block.
    const head = /^(?:\s*@(?:reference|import)\b[^;{]*;)+/.exec(s.css)?.[0] ?? ''
    const statements = head.split(';').map((x) => x.trim()).filter(Boolean).map((x) => `${x};\n`).join('')
    css += `${statements}@scope (.cl-c-${id}) to ([class*="cl-c-"]:not(.cl-c-${id}) > *) {${s.css.slice(head.length).replace(/\s*$/, '')}\n}\n`
  }
  const ir = lower(parsed, options.file, source)
  if (options.target === 'client') return { code: emitClient(ir), stateful: ir.stateful, css, warnings }
  if (ir.stateful && !options.clientUrl) throw new Error(`[clarusjs] ${options.file}: clientUrl is required to compile a stateful component for the server`)
  return { code: emitServer(ir, options.clientUrl ?? '', options.renderImports), stateful: ir.stateful, css, warnings }
}

/** 'src/components/card.tscl' → 'card-<short hash of the path>'. */
export function scopeId(file: string): string {
  let h = 0x811c9dc5 // FNV-1a
  for (let i = 0; i < file.length; i++) h = Math.imul(h ^ file.charCodeAt(i), 0x01000193)
  const name = (file.split(/[\\/]/).pop() ?? 'c').replace(/\.tscl$/, '').replace(/[^\w-]/g, '') || 'c'
  return `${name}-${(h >>> 0).toString(36)}`
}

// Elements that aren't the component's own visible markup: the document element, <head> tags (a page's or ones it
// moves there), scripts.
const UNMARKED = new Set(['slot', 'cl-head', 'script', 'style', 'html', 'title', 'meta', 'link', 'base'])

/**
 * The component's top-level HTML elements (also inside top-level @if/@for) get the scope class, merged with theirs,
 * then the class its parent passed (`<card class="wide">`): `__cl_class`, ' wide' or '', which render() and attach()
 * define.
 */
function markRoots(nodes: TemplateNode[], cls: string, components: Set<string>): void {
  for (const node of nodes) {
    if (node.type === 'element' && !components.has(node.tag) && !UNMARKED.has(node.tag)) {
      const at = node.attrs.findIndex((a) => a.name === 'class')
      const own = node.attrs[at]
      const passed = { expr: '__cl_class', start: node.start }
      if (!own) node.attrs.push({ kind: 'interp', name: 'class', parts: [cls, passed], start: node.start })
      else if (own.kind === 'static') node.attrs[at] = { kind: 'interp', name: 'class', parts: [own.value === true || !own.value ? cls : `${own.value} ${cls}`, passed], start: own.start }
      else if (own.kind === 'interp') own.parts.push(` ${cls}`, passed)
      // ponytail: a bound [class] that is null/false still gets the scope class (the class can't go away entirely).
      else if (own.kind === 'prop') node.attrs[at] = { kind: 'interp', name: 'class', parts: [{ expr: own.expr, start: own.start }, ` ${cls}`, passed], start: own.start }
    } else if (node.type === 'if') {
      for (const b of node.branches) markRoots(b.children, cls, components)
    } else if (node.type === 'for') {
      markRoots(node.children, cls, components)
      if (node.empty) markRoots(node.empty, cls, components)
    }
  }
}
