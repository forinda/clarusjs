// IR → server module: `render(props) → string`. Runs at build time or per request.
import type { ComponentIR } from './ir.ts'
import { rewriteServer } from './script.ts'
import { indentScript, inputsLine, renderName } from './shared.ts'

export function emitServer(ir: ComponentIR, clientUrl: string): string {
  const runtime = ir.stateful ? 'escape, island' : 'escape'
  let out = `import { ${runtime} } from 'kview/runtime/server'\n`
  for (const imp of ir.imports) out += `import { render as ${renderName(imp.name)} } from '${imp.from}'\n`

  const parts = ir.nodes.map((n) => {
    if (n.kind === 'static') return JSON.stringify(n.html)
    if (n.kind === 'component') {
      const props = n.props.map((p) => `${p.name}: ${p.expr}`).join(', ')
      return `${renderName(n.name)}({ ${props} })`
    }
    const value = `escape(${n.expr})`
    return n.reactive ? `"<!--[${n.index}-->" + ${value} + "<!--]-->"` : value
  })
  const html = parts.length ? parts.join(' + ') : '""'
  const props = `{ ${ir.inputs.map((i) => i.name).join(', ')} }`.replace('{  }', '{}')

  out += `\nexport function render(props = {}) {\n`
  out += inputsLine(ir)
  if (ir.script) out += indentScript(rewriteServer(ir.script))
  out += ir.stateful
    ? `  return island(${JSON.stringify(ir.name)}, ${JSON.stringify(clientUrl)}, ${props}, ${html})\n`
    : `  return ${html}\n`
  return out + '}\n'
}
