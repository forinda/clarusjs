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
    reactive.length > 0 && 'holes',
    reactive.length > 0 && 'text',
    ir.events.length > 0 && 'on',
  ].filter(Boolean)

  let out = used.length ? `import { ${used.join(', ')} } from 'kview/runtime'\n` : ''
  out += `\nexport function attach(root, props = {}) {\n`
  out += inputsLine(ir)
  if (ir.script) out += indentScript(rewriteClient(ir.script, ir.signals))

  const wiring: string[] = []
  if (reactive.length) wiring.push('const h = holes(root)')
  for (const h of [...reactive].sort((a, b) => a.index - b.index)) {
    wiring.push(`text(h[${h.index}], () => ${rewriteClientExpr(h.expr, ir.signals)})`)
  }
  for (const e of ir.events) {
    wiring.push(`on(root, ${e.index}, ${JSON.stringify(e.type)}, ($event) => { ${rewriteClientExpr(e.handler, ir.signals)} })`)
  }
  if (wiring.length) out += '\n' + wiring.map((l) => `  ${l}\n`).join('')
  return out + '}\n'
}
