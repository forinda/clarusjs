// IR → client module: `attach(root, props)`. Runs in the browser, only for stateful components.
import type { ComponentIR, IRNode } from './ir.ts'
import { FOR_IMPLICIT } from './parse.ts'
import { attrValueExpr, componentCall, htmlExpr, tagArg, walk, whichExpr, type Rewriter, rowNames, rowParams, rowDerived } from './html-expr.ts'
import { formName, rewriteClient, rewriteClientExpr, wrapExpr, type Signals } from './script.ts'
import { contextLines, indentScript, inputsLine, renderName } from './shared.ts'

/** `hot`: in dev, the module that swaps a changed island in place (#53); its updates are accepted. */
export function emitClient(ir: ComponentIR, hot?: string): string {
  if (!ir.stateful) return 'export {}\n'
  const kinds = new Set(ir.signals.values())
  const all = walk(ir.nodes)
  const hasHoles = all.some((n) => n.kind === 'hole' && n.reactive)
  const hasBlocks = all.some((n) => (n.kind === 'if' || n.kind === 'await') && n.block >= 0)
  const hasFors = all.some((n) => n.kind === 'for' && n.block >= 0)
  const hasRegions = all.some((n) => n.kind === 'component' && n.region >= 0)
  const rendersHtml = hasBlocks || hasFors || hasRegions
  const used = [
    (kinds.has('state') || kinds.has('input')) && 'state',
    kinds.has('derived') && 'derived',
    kinds.has('shared') && 'shared',
    hasHoles && 'holes as __cl_holes',
    hasHoles && 'text as __cl_text',
    ir.events.length > 0 && 'on as __cl_on',
    all.some((n) => n.kind === 'attr' && n.reactive && n.name !== '...') && 'attr as __cl_attr',
    all.some((n) => n.kind === 'attr' && n.reactive && n.name === '...') && 'spread as __cl_spread',
    hasBlocks && 'block as __cl_block',
    all.some((n) => n.kind === 'await' && n.block >= 0) && 'awaited as __cl_awaited',
    hasFors && 'forBlock as __cl_for',
    all.some((n) => n.kind === 'for' && n.block >= 0 && rowNames(n, ir.events).some((x) => x !== '$count')) && 'derived as __cl_derived',
    hasRegions && 'region as __cl_region',
    all.some((n) => n.kind === 'component' && !!n.models?.length) && 'model as __cl_model',
    all.some((n) => n.kind === 'component' && !!n.listens?.length) && 'listen as __cl_listen',
    all.some((n) => n.kind === 'use') && 'use as __cl_useOn',
    ir.sends && 'emit as __cl_emit',
    kinds.has('model') && 'modelInput as __cl_modelInput',
    ir.inputs.some((i) => kinds.has('input') || i.model) && 'batch as __cl_batch',
    // Branch and row HTML is rendered in the browser with the same helpers as on the server.
    rendersHtml && 'escape as __cl_escape',
    rendersHtml && all.some((n) => n.kind === 'attr' && n.name !== '...') && 'attrHtml as __cl_attrHtml',
    // The root's spread of passed attributes (#463) is rendered by the server only: no spreadHtml for it here.
    rendersHtml && all.some((n) => n.kind === 'attr' && n.name === '...' && !('expr' in n.value && n.value.expr === '__cl_attrs')) && 'spreadHtml as __cl_spreadHtml',
    rendersHtml && hasBlocks && 'blockHtml as __cl_blockHtml',
    rendersHtml && hasFors && 'forHtml as __cl_forHtml',
    hasRegions && 'regionHtml as __cl_regionHtml',
    all.some((n) => n.kind === 'attr' && JSON.stringify(n.value).includes('__cl_classValue(')) && 'classValue as __cl_classValue',
    all.some((n) => n.kind === 'attr' && JSON.stringify(n.value).includes('__cl_styleValue(')) && 'styleValue as __cl_styleValue',
  ].filter(Boolean)

  let out = used.length ? `import { ${used.join(', ')} } from 'clarusjs/runtime'\n` : ''
  if (hot) out += `import { swap as __cl_swap } from ${JSON.stringify(hot)}\n`
  // Child components render in the browser too (in branches, rows and regions): import their server render
  // functions through the plugin's ?render query.
  const usedComponents = new Set(all.flatMap((n) => (n.kind === 'component' ? [n.name] : [])))
  for (const imp of ir.imports) {
    if (usedComponents.has(imp.name)) out += `import { render as ${renderName(imp.name)} } from '${imp.from}?render'\n`
  }
  for (const d of ir.dataImports) out += `import ${d.clause} from '${d.from}'\n`
  if (all.some((n) => n.kind === 'connect')) out += `import { connect as __cl_connect } from 'clarusjs/forms'\n`
  for (const line of ir.scriptImports) out += `${line}\n`
  out += `\nexport function attach(__cl_root, __cl_props = {}, __cl_state) {\n`
  out += `  const __cl_class = __cl_props.__cl_class ? " " + __cl_props.__cl_class : ""\n`
  // emit('name', value, { reason, event }) (#442): false when the parent cancelled it.
  if (ir.sends) out += `  const emit = (name, value, info) => __cl_emit(__cl_root, name, value, info)\n`
  // The context children it re-renders get (#465). ponytail: the island's own provides only; its incoming context
  // isn't serialized, so it can't pass on what was provided above it.
  out += contextLines(ir, 'undefined')
  // Inputs: read-only signals (writes are compile errors), set from props now and by the returned update.
  const inputs = ir.inputs.filter((i) => ir.signals.get(i.name) === 'input' || ir.signals.get(i.name) === 'model')
  const value = (i: (typeof inputs)[number], from: string) =>
    i.default === undefined ? `${from}.${i.name}` : `${from}.${i.name} === undefined ? (${rewriteClientExpr(i.default, ir.signals)}) : ${from}.${i.name}`
  // A @model input writes to the parent island (a cl:model event); new props set it with own().
  for (const i of inputs) {
    out += i.model
      ? `  const ${i.name} = __cl_modelInput(__cl_root, ${JSON.stringify(i.name)}, ${value(i, '__cl_props')})\n`
      : `  const ${i.name} = state(${value(i, '__cl_props')})\n`
  }
  out += inputsLine({ ...ir, inputs: ir.inputs.filter((i) => !inputs.includes(i)) })
  if (ir.script) out += indentScript(rewriteClient(ir.script, ir.signals, { stateFromServer: true, forms: formName(ir.scriptImports) }))
  const lines = wiring(ir, ir.nodes, undefined, '__cl_root', ir.signals, 0)
  if (lines.length) out += '\n' + lines.map((l) => `  ${l}\n`).join('')
  // New props from a parent island: each input follows (the loader keeps this, and the parent calls it in place).
  // All at once (a batch): an effect reading two inputs never sees one updated and the other not.
  // Dev (#53): the island's state, read by the next version of this module when the file changes (runtime/hot.ts).
  if (hot) out += `  __cl_root.__cl_hot = () => ({ ${[...ir.signals].filter(([, kind]) => kind === 'state').map(([name]) => `${name}: ${name}.get()`).join(', ')} })\n`
  if (inputs.length) out += `  return (__cl_p) => __cl_batch(() => {\n${inputs.map((i) => `    ${i.name}.${i.model ? 'own' : 'set'}(${value(i, '__cl_p')})\n`).join('')}  })\n`
  out += '}\n'
  // Accepts its own updates: the new version swaps the island in place, keeping its state (one line, dev only).
  if (hot) out += `\nif (import.meta.hot) { import.meta.hot.accept(); if (import.meta.hot.data.cl) __cl_swap(import.meta.url); import.meta.hot.data.cl = 1 }\n`
  return out
}

/** Rewrites expressions for the browser: reads of `signals` become `.get()`. */
function rewriter(signals: Signals): Rewriter {
  return {
    expr: (e) => rewriteClientExpr(e, signals),
    without: (names) => rewriter(new Map([...signals].filter(([name]) => !names.includes(name)))),
  }
}

/**
 * Code that wires one scope: the top level, an @if branch, a @for row or @empty content. Holes, attributes and
 * events directly in `nodes` are wired here; nested blocks and lists get their own calls, whose branches and rows
 * wire themselves. `ctx` names the island (top level) or the row range the scope's markers are looked up in.
 */
function wiring(ir: ComponentIR, nodes: IRNode[], scope: string | undefined, ctx: string, signals: Signals, depth: number): string[] {
  const rw = rewriter(signals)
  const lines: string[] = []
  const holes = nodes.filter((n) => n.kind === 'hole' && n.reactive) as Extract<IRNode, { kind: 'hole' }>[]
  if (holes.length) lines.push(`const __cl_h = __cl_holes(${ctx})`)
  for (const h of [...holes].sort((a, b) => a.index - b.index)) lines.push(`__cl_text(__cl_h[${h.index}], () => ${wrapExpr(rw.expr(h.expr))})`)
  for (const a of nodes) {
    if (a.kind === 'attr' && a.reactive && a.name === '...') lines.push(`__cl_spread(${ctx}, ${a.index}, () => ${attrValueExpr(a.value, rw.expr)}, ${JSON.stringify(a.skip ?? [])}, ${JSON.stringify(a.tag)})`)
    else if (a.kind === 'attr' && a.reactive) lines.push(`__cl_attr(${ctx}, ${a.index}, ${JSON.stringify(a.name)}, () => ${attrValueExpr(a.value, rw.expr)}${tagArg(a)})`)
    if (a.kind === 'connect') lines.push(`__cl_connect(${ctx}, ${a.index}, () => ${wrapExpr(rw.expr(a.expr))})`)
    if (a.kind === 'use') lines.push(`__cl_useOn(${ctx}, ${a.index}, () => ${wrapExpr(rw.expr(a.expr))})`)
  }
  for (const e of ir.events.filter((ev) => ev.scope === scope)) {
    const body = rewriteClient(e.handler, signals).trim()
    const end = body.includes('//') ? '\n  ' : ' ' // a trailing line comment must not swallow the closing `})`
    lines.push(`__cl_on(${ctx}, ${e.index}, ${JSON.stringify(e.type)}, ($event) => { ${body}${end}})`)
  }
  const fn = (args: string, inner: string[]) =>
    inner.length ? `(${args}) => {\n${inner.map((l) => `      ${l}`).join('\n')}\n    }` : `(${args}) => {}`
  for (const n of nodes) {
    if (n.kind === 'component' && n.region >= 0) {
      const content = [...n.children, ...n.fills.flatMap((f) => f.nodes)]
      lines.push(`__cl_region(${ctx}, ${n.region}, () => ${componentCall(n, rw)}, ${fn('', wiring(ir, content, `c${n.region}`, ctx, signals, depth))})`)
      // [(x)]: the child island's writes to its @model x come back here and update this island's state.
      for (const m of n.models ?? []) lines.push(`__cl_model(${ctx}, ${n.region}, ${JSON.stringify(m.name)}, (__cl_v) => { ${rewriteClient(m.set, signals).trim()} })`)
      // (name)="…": the child island's emit('name', …) (#442).
      for (const l of n.listens ?? []) {
        const body = rewriteClient(l.handler, signals).trim()
        lines.push(`__cl_listen(${ctx}, ${n.region}, ${JSON.stringify(l.name)}, ($event, $info) => { ${body}${body.includes('//') ? '\n  ' : ' '}})`)
      }
    }
    if (n.kind === 'if' && n.block >= 0) {
      const branches = n.branches.map((b, i) =>
        `    { html: () => ${htmlExpr(b.nodes, rw)}, wire: ${fn('', wiring(ir, b.nodes, `${n.block}.${i}`, ctx, signals, depth))} },`)
      lines.push(`__cl_block(${ctx}, ${n.block}, () => ${whichExpr(n, rw)}, [\n${branches.join('\n')}\n  ])`)
    }
    if (n.kind === 'await' && n.block >= 0) {
      // The promise's state (0 pending, 1 then, 2 catch) drives an ordinary block; @then / @catch get the value.
      const a = `__cl_a${n.block}`
      lines.push(`const ${a} = __cl_awaited(() => ${wrapExpr(rw.expr(n.expr))})`)
      const named = (b: { name: string; nodes: IRNode[] } | null, k: number) => {
        if (!b) return `    { html: () => "", wire: () => {} },`
        const plain = rw.without([b.name])
        const wire = wiring(ir, b.nodes, `${n.block}.${k}`, ctx, new Map([...signals].filter(([name]) => name !== b.name)), depth)
        return `    { html: () => ((${b.name}) => ${htmlExpr(b.nodes, plain)})(${a}.v()), wire: ${fn('', wire.length ? [`const ${b.name} = ${a}.v()`, ...wire] : [])} },`
      }
      const branches = [`    { html: () => ${htmlExpr(n.pending, rw)}, wire: ${fn('', wiring(ir, n.pending, `${n.block}.0`, ctx, signals, depth))} },`, named(n.then, 1), named(n.catch, 2)]
      lines.push(`__cl_block(${ctx}, ${n.block}, () => ${a}.k(), [\n${branches.join('\n')}\n  ])`)
    }
    if (n.kind === 'for' && n.block >= 0) {
      // In row HTML `item` and `$index` are plain values; while wiring a row they are that row's signals.
      const rowCtx = `__cl_c${depth + 1}`
      // The derived names ($first, $last, $even, $odd) are derived signals in the wiring, from $index and $count.
      const names = rowNames(n, ir.events)
      const derivedNames = names.filter((x) => x !== '$count')
      const loop = [n.item, '$index', ...(names.length ? ['$count'] : [])]
      const rowSignals: Signals = new Map([...signals, ...loop.map((name) => [name, 'state'] as const), ...derivedNames.map((name) => [name, 'derived'] as const)])
      const plain = rw.without([n.item, ...FOR_IMPLICIT])
      const key = n.track === null ? '$index' : wrapExpr(plain.expr(n.track))
      const wire = [...rowDerived(n, ir.events), ...wiring(ir, n.nodes, `f${n.block}`, rowCtx, rowSignals, depth + 1)]
      const row = `{\n    html: (${rowParams(n)}) => ${htmlExpr(n.nodes, plain)},\n    wire: ${fn(`${rowCtx}, ${loop.join(', ')}`, wire)},\n  }`
      const empty = n.empty
        ? `{\n    html: () => ${htmlExpr(n.empty, rw)},\n    wire: ${fn(rowCtx, wiring(ir, n.empty, `f${n.block}e`, rowCtx, signals, depth + 1))},\n  }`
        : 'null'
      lines.push(`__cl_for(${ctx}, ${n.block}, () => ${wrapExpr(rw.expr(n.list))}, (${n.item}, $index) => ${key}, ${row}, ${empty})`)
    }
  }
  return lines
}
