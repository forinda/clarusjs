// IR → client module: `attach(root, props)`. Runs in the browser, only for stateful components.
import type { ComponentIR, IRNode } from './ir.ts'
import { attrValueExpr, htmlExpr, walk, whichExpr } from './html-expr.ts'
import { rewriteClient, rewriteClientExpr, wrapExpr } from './script.ts'
import { indentScript, inputsLine } from './shared.ts'

export function emitClient(ir: ComponentIR): string {
  if (!ir.stateful) return 'export {}\n'
  const kinds = new Set(ir.signals.values())
  const all = walk(ir.nodes)
  const hasHoles = all.some((n) => n.kind === 'hole' && n.reactive)
  const hasBlocks = all.some((n) => n.kind === 'if' && n.block >= 0)
  const used = [
    kinds.has('state') && 'state',
    kinds.has('derived') && 'derived',
    hasHoles && 'holes as __cl_holes',
    hasHoles && 'text as __cl_text',
    ir.events.length > 0 && 'on as __cl_on',
    all.some((n) => n.kind === 'attr' && n.reactive) && 'attr as __cl_attr',
    hasBlocks && 'block as __cl_block',
    // Branch HTML is rendered in the browser with the same helpers as on the server.
    hasBlocks && 'escape as __cl_escape',
    hasBlocks && all.some((n) => n.kind === 'attr') && 'attrHtml as __cl_attrHtml',
    hasBlocks && 'blockHtml as __cl_blockHtml',
  ].filter(Boolean)

  let out = used.length ? `import { ${used.join(', ')} } from 'clarusjs/runtime'\n` : ''
  out += `\nexport function attach(__cl_root, __cl_props = {}) {\n`
  out += inputsLine(ir)
  if (ir.script) out += indentScript(rewriteClient(ir.script, ir.signals))
  const lines = wiring(ir, ir.nodes, undefined)
  if (lines.length) out += '\n' + lines.map((l) => `  ${l}\n`).join('')
  return out + '}\n'
}

/**
 * Code that wires one scope: the top level, or one @if branch. Holes, attributes and events directly in `nodes`
 * (not in nested branches) are wired here; nested @if blocks get a block() call whose branches wire themselves.
 * Marker indexes are unique per component, so each scope looks its markers up in the whole island.
 */
function wiring(ir: ComponentIR, nodes: IRNode[], scope: string | undefined): string[] {
  const expr = (e: string) => rewriteClientExpr(e, ir.signals)
  const lines: string[] = []
  const holes = nodes.filter((n) => n.kind === 'hole' && n.reactive) as Extract<IRNode, { kind: 'hole' }>[]
  if (holes.length) lines.push('const __cl_h = __cl_holes(__cl_root)')
  for (const h of [...holes].sort((a, b) => a.index - b.index)) lines.push(`__cl_text(__cl_h[${h.index}], () => ${wrapExpr(expr(h.expr))})`)
  for (const a of nodes) {
    if (a.kind === 'attr' && a.reactive) lines.push(`__cl_attr(__cl_root, ${a.index}, ${JSON.stringify(a.name)}, () => ${attrValueExpr(a.value, expr)})`)
  }
  for (const e of ir.events.filter((ev) => ev.scope === scope)) {
    const body = rewriteClient(e.handler, ir.signals).trim()
    const end = body.includes('//') ? '\n  ' : ' ' // a trailing line comment must not swallow the closing `})`
    lines.push(`__cl_on(__cl_root, ${e.index}, ${JSON.stringify(e.type)}, ($event) => { ${body}${end}})`)
  }
  for (const n of nodes) {
    if (n.kind !== 'if' || n.block < 0) continue
    const branches = n.branches.map((b, i) => {
      const inner = wiring(ir, b.nodes, `${n.block}.${i}`)
      const wire = inner.length ? `() => {\n${inner.map((l) => `      ${l}`).join('\n')}\n    }` : '() => {}'
      return `    { html: () => ${htmlExpr(b.nodes, expr)}, wire: ${wire} },`
    })
    lines.push(`__cl_block(__cl_root, ${n.block}, () => ${whichExpr(n, expr)}, [\n${branches.join('\n')}\n  ])`)
  }
  return lines
}
