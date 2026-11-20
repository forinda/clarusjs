// IR → server module: `render(props) → string`. Runs at build time or per request.
import type { ComponentIR, IRNode } from './ir.ts'
import { rewriteServer, wrapExpr } from './script.ts'
import { indentScript, inputsLine, renderName } from './shared.ts'

export function emitServer(ir: ComponentIR, clientUrl: string): string {
  const runtime = ['escape as __cl_escape', ir.stateful && 'island as __cl_island', usesAttr(ir.nodes) && 'attr as __cl_attr'].filter(Boolean).join(', ')
  let out = `import { ${runtime} } from 'clarusjs/runtime/server'\n`
  for (const imp of ir.imports) out += `import { render as ${renderName(imp.name)} } from '${imp.from}'\n`

  const html = htmlExpr(ir.nodes)
  const props = `{ ${ir.inputs.map((i) => i.name).join(', ')} }`.replace('{  }', '{}')

  out += `\nexport function render(__cl_props = {}, __cl_slot) {\n`
  if (ir.stateful) out += `  if (__cl_slot !== undefined) throw new Error(${JSON.stringify(`[clarusjs] <${ir.name}> does not accept children yet`)})\n`
  else if (!hasSlot(ir.nodes)) out += `  if (__cl_slot !== undefined) throw new Error(${JSON.stringify(`[clarusjs] <${ir.name}> has no <slot /> for the content passed to it`)})\n`
  out += inputsLine(ir)
  if (ir.script) out += indentScript(rewriteServer(ir.script))
  out += ir.stateful
    ? `  return __cl_island(${JSON.stringify(ir.name)}, ${JSON.stringify(clientUrl)}, ${props}, ${html})\n`
    : `  return ${html}\n`
  return out + '}\n'
}

/** One JS string expression for a list of IR nodes. Component children become the child's slot argument. */
function htmlExpr(nodes: IRNode[]): string {
  const parts = nodes.map((n) => {
    if (n.kind === 'static') return JSON.stringify(n.html)
    if (n.kind === 'slot') return '(__cl_slot ?? "")'
    if (n.kind === 'attr') return `__cl_attr(${JSON.stringify(n.name)}, ${attrValueExpr(n.value, (e) => e)})`
    if (n.kind === 'component') {
      const props = n.props.map((p) => `${p.name}: ${wrapExpr(p.expr)}`).join(', ')
      return n.children.length ? `${renderName(n.name)}({ ${props} }, ${htmlExpr(n.children)})` : `${renderName(n.name)}({ ${props} })`
    }
    const value = `__cl_escape(${wrapExpr(n.expr)})`
    return n.reactive ? `"<!--[${n.index}-->" + ${value} + "<!--]-->"` : value
  })
  return parts.length ? parts.join(' + ') : '""'
}

function hasSlot(nodes: IRNode[]): boolean {
  return nodes.some((n) => n.kind === 'slot' || (n.kind === 'component' && hasSlot(n.children)))
}

function usesAttr(nodes: IRNode[]): boolean {
  return nodes.some((n) => n.kind === 'attr' || (n.kind === 'component' && usesAttr(n.children)))
}

/** JS expression for an attribute's value: the bound expression, or the parts joined (null/undefined join as ''). */
export function attrValueExpr(value: Extract<IRNode, { kind: 'attr' }>['value'], rewrite: (expr: string) => string): string {
  if ('expr' in value) return `(${rewrite(value.expr)})`
  return `[${value.parts.map((p) => (typeof p === 'string' ? JSON.stringify(p) : `(${rewrite(p.expr)})`)).join(', ')}].join("")`
}
