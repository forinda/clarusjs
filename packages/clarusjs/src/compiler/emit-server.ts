// IR → server module: `render(props) → string`. Runs at build time or per request.
import type { ComponentIR, IRNode } from './ir.ts'
import { htmlExpr, walk } from './html-expr.ts'
import { rewriteServer } from './script.ts'
import { indentScript, inputsLine, renderName } from './shared.ts'

export function emitServer(ir: ComponentIR, clientUrl: string): string {
  const all = walk(ir.nodes)
  const runtime = [
    'escape as __cl_escape',
    ir.stateful && 'island as __cl_island',
    all.some((n) => n.kind === 'attr') && 'attr as __cl_attrHtml',
    all.some((n) => n.kind === 'if' && n.block >= 0) && 'blockHtml as __cl_blockHtml',
  ].filter(Boolean).join(', ')
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

function hasSlot(nodes: IRNode[]): boolean {
  return walk(nodes).some((n) => n.kind === 'slot')
}
