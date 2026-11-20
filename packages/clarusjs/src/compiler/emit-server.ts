// IR → server module: `render(props) → string`. Runs at build time or per request.
import type { ComponentIR } from './ir.ts'
import { htmlExpr, walk } from './html-expr.ts'
import { rewriteServer } from './script.ts'
import { indentScript, inputsLine, renderName } from './shared.ts'

export function emitServer(ir: ComponentIR, clientUrl: string, renderImports = false): string {
  const all = walk(ir.nodes)
  const runtime = [
    'escape as __cl_escape',
    all.some((n) => n.kind === 'hole' && n.json) && 'json as __cl_json',
    ir.stateful && 'island as __cl_island',
    all.some((n) => n.kind === 'attr') && 'attr as __cl_attrHtml',
    all.some((n) => n.kind === 'if' && n.block >= 0) && 'blockHtml as __cl_blockHtml',
    all.some((n) => n.kind === 'for' && n.block >= 0) && 'forHtml as __cl_forHtml',
    all.some((n) => n.kind === 'component' && n.region >= 0) && 'regionHtml as __cl_regionHtml',
  ].filter(Boolean).join(', ')
  let out = `import { ${runtime} } from 'clarusjs/runtime/server'\n`
  for (const imp of ir.imports) out += `import { render as ${renderName(imp.name)} } from '${imp.from}${renderImports ? '?render' : ''}'\n`
  for (const d of ir.dataImports) out += `import ${d.clause} from '${d.from}'\n`
  for (const line of ir.scriptImports) out += `${line}\n`

  const html = htmlExpr(ir.nodes)
  const props = `{ ${ir.inputs.map((i) => i.name).join(', ')} }`.replace('{  }', '{}')

  out += `\nexport function render(__cl_props = {}, __cl_slots, __cl_opts) {\n`
  if (ir.stateful) out += `  if (__cl_slots !== undefined) throw new Error(${JSON.stringify(`[clarusjs] <${ir.name}> does not accept children yet`)})\n`
  else {
    out += unknownSlotCheck(ir)
    out += `  if (__cl_opts?.attach) throw new Error(${JSON.stringify(`[clarusjs] <${ir.name}> has no <script>, so attach="`)} + __cl_opts.attach + '" does nothing')\n`
  }
  out += inputsLine(ir)
  if (ir.script) out += indentScript(rewriteServer(ir.script))
  out += ir.stateful
    ? `  return __cl_island(${JSON.stringify(ir.name)}, ${JSON.stringify(clientUrl)}, ${props}, ${html}, ${stateArg(ir)}, __cl_opts?.attach)\n`
    : `  return ${html}\n`
  return out + '}\n'
}

/** Content for a slot this component doesn't have is an error (at render, so a build fails naming it). */
function unknownSlotCheck(ir: ComponentIR): string {
  const known = [...new Set(walk(ir.nodes).flatMap((n) => (n.kind === 'slot' ? [n.name] : [])))]
  const noDefault = JSON.stringify(`[clarusjs] <${ir.name}> has no <slot /> for the content passed to it`)
  const noNamed = JSON.stringify(`[clarusjs] <${ir.name}> has no slot "`)
  return `  for (const __cl_k in __cl_slots) if (!${JSON.stringify(known)}.includes(__cl_k)) throw new Error(__cl_k === "default" ? ${noDefault} : ${noNamed} + __cl_k + '"')\n`
}

/** The component's state() values after its script ran: the island's starting point in the browser. */
function stateArg(ir: ComponentIR): string {
  const names = [...ir.signals].filter(([, kind]) => kind === 'state').map(([name]) => name)
  return names.length ? `{ ${names.join(', ')} }` : 'undefined'
}
