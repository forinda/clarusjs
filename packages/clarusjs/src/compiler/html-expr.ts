// One JS string expression for a list of IR nodes, shared by the server emitter (render) and the client emitter
// (HTML for @if branches and @for rows rendered in the browser).
import type { IRNode } from './ir.ts'
import { renderName } from './shared.ts'
import { wrapExpr } from './script.ts'

/**
 * How a template expression becomes code. On the server it is used as written; in the browser signal reads become
 * `.get()`. Inside a @for row's HTML, the row's `item` and `$index` are plain parameters, hence `without()`.
 */
export type Rewriter = { expr(e: string): string; without(names: string[]): Rewriter }
export const asWritten: Rewriter = { expr: (e) => e, without: () => asWritten }

export function htmlExpr(nodes: IRNode[], rw: Rewriter = asWritten): string {
  const parts = nodes.map((n) => {
    if (n.kind === 'static') return JSON.stringify(n.html)
    if (n.kind === 'slot') return `(__cl_slots?.[${JSON.stringify(n.name)}] ?? ${n.fallback.length ? `(${htmlExpr(n.fallback, rw)})` : '""'})`
    if (n.kind === 'connect') return '""' // its marker is static; the browser connects it
    if (n.kind === 'attr') return `__cl_attrHtml(${JSON.stringify(n.name)}, ${attrValueExpr(n.value, rw.expr)}${tagArg(n)})`
    if (n.kind === 'if') {
      if (n.block === -1) {
        // Outside islands: a plain choice, no markers.
        const last = n.branches[n.branches.length - 1]!
        let expr = last.cond === null ? `(${htmlExpr(last.nodes, rw)})` : '""'
        const conditional = last.cond === null ? n.branches.slice(0, -1) : n.branches
        for (const b of [...conditional].reverse()) expr = `(${wrapExpr(rw.expr(b.cond!))} ? (${htmlExpr(b.nodes, rw)}) : ${expr})`
        return expr
      }
      const branches = n.branches.map((b) => `() => ${htmlExpr(b.nodes, rw)}`).join(', ')
      return `__cl_blockHtml(${n.block}, ${whichExpr(n, rw)}, [${branches}])`
    }
    if (n.kind === 'for') {
      const list = wrapExpr(rw.expr(n.list))
      const row = `(${n.item}, $index) => ${htmlExpr(n.nodes, rw.without([n.item, '$index']))}`
      const empty = n.empty ? `() => ${htmlExpr(n.empty, rw)}` : 'null'
      if (n.block >= 0) return `__cl_forHtml(${n.block}, ${list}, ${row}, ${empty})`
      // Outside islands: a plain loop, no markers.
      return `((__cl_l) => __cl_l.length ? __cl_l.map(${row}).join("") : ${n.empty ? `(${htmlExpr(n.empty, rw)})` : '""'})([...(${list} ?? [])])`
    }
    if (n.kind === 'component') {
      const call = componentCall(n, rw)
      return n.region >= 0 ? `__cl_regionHtml(${n.region}, () => ${call})` : call
    }
    if (n.json) return `__cl_json(${wrapExpr(rw.expr(n.expr))})`
    const value = `__cl_escape(${wrapExpr(rw.expr(n.expr))})`
    return n.reactive ? `"<!--[${n.index}-->" + ${value} + "<!--]-->"` : value
  })
  return parts.length ? parts.join(' + ') : '""'
}

/** `render_child({ props }, { slots })` for a component node. */
export function componentCall(n: Extract<IRNode, { kind: 'component' }>, rw: Rewriter): string {
  const props = n.props.map((p) => `${p.name}: ${wrapExpr(rw.expr(p.expr))}`).join(', ')
  const slots = [
    ...(n.children.length ? [`"default": ${htmlExpr(n.children, rw)}`] : []),
    ...n.fills.map((f) => `${JSON.stringify(f.name)}: ${htmlExpr(f.nodes, rw)}`),
  ]
  const slotsArg = slots.length ? `{ ${slots.join(', ')} }` : undefined
  // Render options: when to attach, and (for the forms engine) the path this component is bound to.
  const opts = [...(n.attach ? [`attach: ${JSON.stringify(n.attach)}`] : []), ...(n.class ? [`class: ${JSON.stringify(n.class)}`] : []), ...(n.paths ? [`paths: { ${n.paths.map((p) => `${JSON.stringify(p.name)}: ${wrapExpr(rw.expr(p.expr))}`).join(', ')} }`] : [])]
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
      : n.kind === 'for' ? [...walk(n.nodes), ...walk(n.empty ?? [])]
      : n.kind === 'component' ? [...walk(n.children), ...n.fills.flatMap((f) => walk(f.nodes))]
      : n.kind === 'slot' ? walk(n.fallback)
      : []),
  ])
}
