// IR → server module: `render(props) → string`. Runs at build time or per request.
import type { ComponentIR } from './ir.ts'
import { asWritten, htmlExpr, walk } from './html-expr.ts'
import { rewriteServer } from './script.ts'
import { indentScript, inputsLine, renderName } from './shared.ts'

export function emitServer(ir: ComponentIR, clientUrl: string, renderImports = false, loader?: string): string {
  const all = walk(ir.nodes)
  const html = htmlExpr(ir.nodes, asWritten, { island: ir.stateful ? ir.name : null, top: true })
  const runtime = [
    'escape as __cl_escape',
    all.some((n) => n.kind === 'hole' && n.json) && 'json as __cl_json',
    ir.stateful && 'island as __cl_island',
    all.some((n) => n.kind === 'attr' && n.name !== '...') && 'attr as __cl_attrHtml',
    html.includes('__cl_spreadHtml(') && 'spreadHtml as __cl_spreadHtml',
    html.includes('__cl_passedHtml(') && 'passedHtml as __cl_passedHtml',
    all.some((n) => n.kind === 'attr' && JSON.stringify(n.value).includes('__cl_classValue(')) && 'classValue as __cl_classValue',
    all.some((n) => n.kind === 'attr' && JSON.stringify(n.value).includes('__cl_styleValue(')) && 'styleValue as __cl_styleValue',
    all.some((n) => (n.kind === 'if' || n.kind === 'await') && n.block >= 0) && 'blockHtml as __cl_blockHtml',
    all.some((n) => n.kind === 'await' && n.block < 0) && 'awaitHtml as __cl_awaitHtml',
    all.some((n) => n.kind === 'for' && n.block >= 0) && 'forHtml as __cl_forHtml',
    all.some((n) => n.kind === 'component' && n.region >= 0) && 'regionHtml as __cl_regionHtml',
    all.some((n) => n.kind === 'slot') && 'slot as __cl_slot',
    loader && 'loaded as __cl_loaded',
    html.includes('__cl_join(') && 'join as __cl_join',
    html.includes('__cl_sync(') && 'sync as __cl_sync',
    html.includes('__cl_attrs') && 'passed as __cl_passed',
  ].filter(Boolean).join(', ')
  let out = `import { ${runtime} } from 'clarusjs/runtime/server'\n`
  for (const imp of ir.imports) out += `import { render as ${renderName(imp.name)} } from '${imp.from}${renderImports ? '?render' : ''}'\n`
  for (const d of ir.dataImports) out += `import ${d.clause} from '${d.from}'\n`
  for (const line of ir.scriptImports) out += `${line}\n`
  for (const line of ir.server?.imports ?? []) out += `${line}\n`

  // An island carries the class its parent passed to the browser, which re-renders its blocks with it.
  const props = `{ ${[...ir.inputs.map((i) => i.name), '...(__cl_opts?.class && { __cl_class: __cl_opts.class })'].join(', ')} }`

  // A <script server> that awaits makes render async (#430): its parents join what it returns.
  out += `\nexport ${ir.server?.awaits ? 'async ' : ''}function render(__cl_props = {}, __cl_slots, __cl_opts) {\n`
  out += unknownSlotCheck(ir)
  // ponytail: content from a parent island would carry that island's markers into this one. Lift with scoped lookups.
  if (ir.stateful && walk(ir.nodes).some((n) => n.kind === 'slot')) out += `  if (__cl_slots !== undefined && __cl_opts?.inIsland) throw new Error(${JSON.stringify(`[clarusjs] <${ir.name}> can't take content from inside another island yet: pass it from a page or a component without <script>`)})\n`
  if (!ir.stateful) out += `  if (__cl_opts?.attach) throw new Error(${JSON.stringify(`[clarusjs] <${ir.name}> has no <script>, so attach="`)} + __cl_opts.attach + '" does nothing')\n`
  // A component loader (#97): the data it loaded for this render fills the inputs; the parent's props win.
  if (loader) out += `  __cl_props = { ...__cl_loaded(${JSON.stringify(loader)}), ...__cl_props }\n`
  out += inputsLine(ir)
  out += `  const __cl_class = __cl_opts?.class ? " " + __cl_opts.class : ""\n`
  // What the parent passed as attributes (#463), for the root element.
  if (html.includes('__cl_attrs')) out += `  const __cl_attrs = __cl_passed(__cl_props, ${JSON.stringify(ir.inputs.map((i) => i.name))})\n`
  if (ir.script) out += indentScript(rewriteServer(ir.script))
  if (ir.server) out += indentScript(ir.server.body)
  out += ir.stateful
    ? `  return __cl_island(${JSON.stringify(ir.name)}, ${JSON.stringify(clientUrl)}, ${props}, ${html}, ${stateArg(ir)}, __cl_opts?.attach, __cl_opts?.paths)\n`
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
