// One JS string expression for a list of IR nodes, shared by the server emitter (render) and the client emitter
// (HTML for @if branches and @for rows rendered in the browser).
import { FOR_IMPLICIT } from './parse.ts'
import type { IRNode } from './ir.ts'
import { renderName } from './shared.ts'
import { wrapExpr } from './script.ts'

/**
 * How a template expression becomes code. On the server it is used as written; in the browser signal reads become
 * `.get()`. Inside a @for row's HTML, the row's `item` and `$index` are plain parameters, hence `without()`.
 */
export type Rewriter = { expr(e: string): string; without(names: string[]): Rewriter }
export const asWritten: Rewriter = { expr: (e) => e, without: () => asWritten }

/**
 * Server output only (#430): `island` is the component's name when it's an island, null when it isn't. Outside
 * islands, a level that calls a component or places a slot joins its parts with __cl_join (a string, or a promise
 * when an awaiting component is in it); inside an island, a component call is checked not to be a promise.
 */
export type ServerCtx = { island: string | null; top?: boolean }

/** Could this HTML be a promise: does it call a component or place a slot (whose content may await)? */
const mayWait = (nodes: IRNode[]) => walk(nodes).some((n) => n.kind === 'component' || n.kind === 'slot' || (n.kind === 'await' && n.block < 0))

export function htmlExpr(nodes: IRNode[], rw: Rewriter = asWritten, top?: ServerCtx): string {
  // An island's own level (top) joins its parts when it places a slot: the content may await (#430, #465).
  const ctx = top?.top ? { island: top.island } : top
  const parts = nodes.map((n) => {
    if (n.kind === 'static') return JSON.stringify(n.html)
    // The fill (called with what the slot passes, when it takes data: #455), or the fallback.
    if (n.kind === 'slot') {
      const data = n.props.length ? `{ ${n.props.map((p) => `${p.name === '__proto__' ? '["__proto__"]' : p.name}: ${wrapExpr(rw.expr(p.expr))}`).join(', ')} }` : 'undefined'
      const placed = `__cl_slot(__cl_slots?.[${JSON.stringify(n.name)}], ${data}, () => ${n.fallback.length ? htmlExpr(n.fallback, rw, ctx) : '""'}, __cl_cx)`
      // In an island, its slot range (#465): the content in it is the outer island's (runtime/dom.ts owner()).
      return ctx?.island ? `__cl_join(["<!--[s-->", ${placed}, "<!--]s-->"])` : placed
    }
    if (n.kind === 'connect' || n.kind === 'use') return '""' // its marker is static; the browser connects it
    // The attributes passed to this component (#463), on its root.
    if (n.kind === 'attr' && n.name === '...' && 'expr' in n.value && n.value.expr === '__cl_attrs') return `__cl_passedHtml(__cl_attrs, ${JSON.stringify((n.skip ?? []).filter((x) => x !== 'engine' && x !== 'use' && !x.includes('.')))})` // the root's own attributes win (@extends passes any of its element's); [engine], [use], [class.x] aren't attributes
    if (n.kind === 'attr' && n.name === '...') return `__cl_spreadHtml(${attrValueExpr(n.value, rw.expr)}, ${JSON.stringify(n.skip ?? [])}, ${JSON.stringify(n.tag)}${rw === asWritten && n.where ? `, ${JSON.stringify(n.where)}` : ''})` // the place, for warnings: server code only
    if (n.kind === 'attr') return `__cl_attrHtml(${JSON.stringify(n.name)}, ${attrValueExpr(n.value, rw.expr)}${tagArg(n)})`
    if (n.kind === 'if') {
      if (n.block === -1) {
        // Outside islands: a plain choice, no markers.
        const last = n.branches[n.branches.length - 1]!
        let expr = last.cond === null ? `(${htmlExpr(last.nodes, rw, ctx)})` : '""'
        const conditional = last.cond === null ? n.branches.slice(0, -1) : n.branches
        for (const b of [...conditional].reverse()) expr = `(${wrapExpr(rw.expr(b.cond!))} ? (${htmlExpr(b.nodes, rw, ctx)}) : ${expr})`
        return expr
      }
      const branches = n.branches.map((b) => `() => ${htmlExpr(b.nodes, rw, ctx)}`).join(', ')
      return `__cl_blockHtml(${n.block}, ${whichExpr(n, rw)}, [${branches}])`
    }
    if (n.kind === 'await') {
      // In an island (server, and branch HTML in the browser): the pending branch; the browser swaps in the rest.
      if (n.block >= 0) return `__cl_blockHtml(${n.block}, 0, [() => ${htmlExpr(n.pending, rw, ctx)}])`
      // Outside islands the server awaits it: @then's HTML with the value, or @catch's with the error.
      const branch = (b: { name: string; nodes: IRNode[] } | null) => (b ? `(${b.name}) => ${htmlExpr(b.nodes, rw.without([b.name]), ctx)}` : 'null')
      return `__cl_awaitHtml(${wrapExpr(rw.expr(n.expr))}, ${branch(n.then)}, ${branch(n.catch)})`
    }
    if (n.kind === 'for') {
      const list = wrapExpr(rw.expr(n.list))
      const row = `(${rowParams(n)}) => ${htmlExpr(n.nodes, rw.without([n.item, ...FOR_IMPLICIT, ...n.aliases.map((a) => a.name)]), ctx)}`
      const empty = n.empty ? `() => ${htmlExpr(n.empty, rw, ctx)}` : 'null'
      if (n.block >= 0) return `__cl_forHtml(${n.block}, ${list}, ${row}, ${empty})`
      // Outside islands: a plain loop, no markers. Rows that may await are joined (a promise if one does).
      const rows = ctx && !ctx.island && mayWait(n.nodes) ? `__cl_join(__cl_l.map(${row}))` : `__cl_l.map(${row}).join("")`
      return `((__cl_l) => __cl_l.length ? ${rows} : ${n.empty ? `(${htmlExpr(n.empty, rw, ctx)})` : '""'})([...(${list} ?? [])])`
    }
    if (n.kind === 'component') {
      const plain = componentCall(n, rw, ctx)
      // In an island: a child that awaits (a promise) is an error naming both, when the server renders it.
      const call = ctx?.island ? `__cl_sync(${plain}, ${JSON.stringify(n.name)}, ${JSON.stringify(ctx.island)})` : plain
      return n.region >= 0 ? `__cl_regionHtml(${n.region}, () => ${call})` : call
    }
    if (n.json) return `__cl_json(${wrapExpr(rw.expr(n.expr))})`
    const value = `__cl_escape(${wrapExpr(rw.expr(n.expr))})`
    return n.reactive ? `"<!--[${n.index}-->" + ${value} + "<!--]-->"` : value
  })
  if (ctx && (!ctx.island || (top?.top && nodes.some((n) => n.kind === 'slot'))) && mayWait(nodes)) return `__cl_join([${parts.join(', ')}])`
  return parts.length ? parts.join(' + ') : '""'
}

/** `render_child({ props }, { slots })` for a component node. */
export function componentCall(n: Extract<IRNode, { kind: 'component' }>, rw: Rewriter, ctx?: ServerCtx): string {
  const props = n.props.map((p) => (p.name === '...' ? `...${wrapExpr(rw.expr(p.expr))}` : `${/^[A-Za-z_$][\w$]*$/.test(p.name) ? p.name : JSON.stringify(p.name)}: ${wrapExpr(rw.expr(p.expr))}`)).join(', ') // a spread first (#406); data-x quoted
  // In the browser, slot content is read untracked: it's wired in place (#523). A scoped fill stays tracked.
  const untracked = (body: string) => (ctx ? body : `__cl_untrack(() => ${body})`)
  const slots = [
    // Content is a function of the context where it is placed (#465), and of what its slot passes (#455).
    ...(n.children.length ? [`"default": (_, __cl_cx) => ${untracked(htmlExpr(n.children, rw, ctx))}`] : []),
    ...n.fills.map((f) => `${JSON.stringify(f.name)}: (${f.params ?? '_'}, __cl_cx) => ${f.params ? htmlExpr(f.nodes, rw, ctx) : untracked(htmlExpr(f.nodes, rw, ctx))}`),
  ]
  const slotsArg = slots.length ? `{ ${slots.join(', ')} }` : undefined
  // Render options: when to attach, and (for the forms engine) the path this component is bound to.
  const opts = ['cx: __cl_cx', ...(n.attach ? [`attach: ${JSON.stringify(n.attach)}`] : []), ...(n.class ? [`class: ${JSON.stringify(n.class)}`] : []), ...(n.paths ? [`paths: { ${n.paths.map((p) => `${JSON.stringify(p.name)}: ${wrapExpr(rw.expr(p.expr))}`).join(', ')} }`] : [])]
  if (opts.length) return `${renderName(n.name)}({ ${props} }, ${slotsArg ?? 'undefined'}, { ${opts.join(', ')} })`
  return slotsArg ? `${renderName(n.name)}({ ${props} }, ${slotsArg})` : `${renderName(n.name)}({ ${props} })`
}

/** Index of the branch an @if picks: `(a ? 0 : b ? 1 : 2)`, or -1 when nothing matches and there is no @else. */
export function whichExpr(n: Extract<IRNode, { kind: 'if' }>, rw: Rewriter): string {
  let expr = n.branches[n.branches.length - 1]!.cond === null ? String(n.branches.length - 1) : '-1'
  for (let i = n.branches.length - 1; i >= 0; i--) {
    const cond = n.branches[i]!.cond
    if (cond !== null) expr = `${wrapExpr(rw.expr(cond))} ? ${i} : ${expr}`
  }
  return `(${expr})`
}

/** JS expression for an attribute's value: the bound expression, or the parts joined (null/undefined join as ''). */
export function attrValueExpr(value: Extract<IRNode, { kind: 'attr' }>['value'], rewrite: (e: string) => string): string {
  if ('expr' in value) return `(${rewrite(value.expr)})`
  return `[${value.parts.map((p) => (typeof p === 'string' ? JSON.stringify(p) : `(${rewrite(p.expr)})`)).join(', ')}].join("")`
}

/** The element's tag, passed only for attributes whose meaning depends on it (SVG animation values). */
export function tagArg(n: Extract<IRNode, { kind: 'attr' }>): string {
  return ['to', 'from', 'values', 'by'].includes(n.name.toLowerCase()) ? `, ${JSON.stringify(n.tag)}` : ''
}

/** Every node, including those inside @if branches, @for bodies and component children. */
export function walk(nodes: IRNode[]): IRNode[] {
  return nodes.flatMap((n) => [
    n,
    ...(n.kind === 'if' ? n.branches.flatMap((b) => walk(b.nodes))
      : n.kind === 'await' ? [...walk(n.pending), ...walk(n.then?.nodes ?? []), ...walk(n.catch?.nodes ?? [])]
      : n.kind === 'for' ? [...walk(n.nodes), ...walk(n.empty ?? [])]
      : n.kind === 'component' ? [...walk(n.children), ...n.fills.flatMap((f) => walk(f.nodes))]
      : n.kind === 'slot' ? walk(n.fallback)
      : []),
  ])
}

const DERIVED: Record<string, string> = {
  $first: '$index === 0',
  $last: '$index === $count - 1',
  $even: '$index % 2 === 0',
  $odd: '$index % 2 === 1',
}
/** The @for implicit names a row's template uses, besides `$index`: `$count` and those derived from it. */
export function rowNames(n: Extract<IRNode, { kind: 'for' }>, events: { handler: string; scope?: string }[] = []): string[] {
  // Its template, and (in an island) the event handlers inside its rows: f<block>, f<block>.<nested>…
  const rowEvents = events.filter((e) => e.scope === `f${n.block}` || e.scope?.startsWith(`f${n.block}.`)).map((e) => e.handler)
  const text = JSON.stringify(n.nodes) + JSON.stringify(rowEvents)
  // As names, not inside others ($lastName) or after a dot (user.$first).
  // An alias (let s = $last) needs what it names.
  const has = (name: string) => n.aliases.some((a) => a.of === name) || new RegExp(`(?<![\\w$.])\\${name}(?![\\w$])`).test(text)
  const used = Object.keys(DERIVED).filter(has)
  return has('$count') || used.includes('$last') ? ['$count', ...used] : used
}
/**
 * A row's parameters: the item and `$index`, then (when used) the list, `$count` and the names derived from them as
 * default values, so every caller passes (item, index, list) and a plain Array.map works too.
 */
export function rowParams(n: Extract<IRNode, { kind: 'for' }>): string {
  const names = rowNames(n)
  const aliases = n.aliases.map((a) => `${a.name} = ${a.of}`) // let s = $index: defaults after what they name
  if (!names.length) return [n.item, '$index', ...(aliases.length ? ['__cl_list', ...aliases] : [])].join(', ')
  return [n.item, '$index', '__cl_list', '$count = __cl_list.length', ...names.filter((x) => x !== '$count').map((x) => `${x} = ${DERIVED[x]}`), ...aliases].join(', ')
}
/** In a row's wiring: the derived names, from the row's $index and the list's $count signals. */
export function rowDerived(n: Extract<IRNode, { kind: 'for' }>, events: { handler: string; scope?: string }[] = []): string[] {
  return [
    ...rowNames(n, events).filter((x) => x !== '$count').map((x) => `const ${x} = __cl_derived(() => ${DERIVED[x]!.replace(/\$index/g, '$index.get()').replace(/\$count/g, '$count.get()')})`),
    ...n.aliases.map((a) => `const ${a.name} = ${a.of}`), // the same signal, by another name
  ]
}
