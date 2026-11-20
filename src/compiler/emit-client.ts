// IR → client module: `attach(root, props)`. Runs in the browser, only for stateful components.
import type { ComponentIR } from './ir.ts'
import { rewriteClient, rewriteClientExpr } from './script.ts'
import { indentScript, inputsLine } from './shared.ts'

export function emitClient(ir: ComponentIR): string {
  if (!ir.stateful) return 'export {}\n'
  const kinds = new Set(ir.signals.values())
  const reactive = ir.nodes.filter((n) => n.kind === 'hole' && n.reactive) as { expr: string; index: number }[]
  const used = [
    kinds.has('state') && 'state',
    kinds.has('derived') && 'derived',
    reactive.length > 0 && 'holes as __cl_holes',
    reactive.length > 0 && 'text as __cl_text',
    ir.events.length > 0 && 'on as __cl_on',
  ].filter(Boolean)

  let out = used.length ? `import { ${used.join(', ')} } from 'clarusjs/runtime'\n` : ''
  out += `\nexport function attach(__cl_root, __cl_props = {}) {\n`
  out += inputsLine(ir)
  if (ir.script) out += indentScript(rewriteClient(ir.script, ir.signals))

  const wiring: string[] = []
  if (reactive.length) wiring.push('const __cl_h = __cl_holes(__cl_root)')
  for (const h of [...reactive].sort((a, b) => a.index - b.index)) {
    wiring.push(`__cl_text(__cl_h[${h.index}], () => ${rewriteClientExpr(h.expr, ir.signals)})`)
  }
  for (const e of ir.events) {
    wiring.push(`__cl_on(__cl_root, ${e.index}, ${JSON.stringify(e.type)}, ($event) => { ${rewriteClient(e.handler, ir.signals).trim()} })`)
  }
  if (wiring.length) out += '\n' + wiring.map((l) => `  ${l}\n`).join('')
  return out + '}\n'
}
