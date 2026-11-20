// One JS string expression for a list of IR nodes, shared by the server emitter (render) and the client emitter
// (HTML for @if branches inserted in the browser). `rewrite` turns a template expression into code for that side.
import type { IRNode } from './ir.ts'
import { renderName } from './shared.ts'
import { wrapExpr } from './script.ts'

export type Rewrite = (expr: string) => string

export function htmlExpr(nodes: IRNode[], rewrite: Rewrite = (e) => e): string {
  const parts = nodes.map((n) => {
    if (n.kind === 'static') return JSON.stringify(n.html)
    if (n.kind === 'slot') return '(__cl_slot ?? "")'
    if (n.kind === 'attr') return `__cl_attrHtml(${JSON.stringify(n.name)}, ${attrValueExpr(n.value, rewrite)})`
    if (n.kind === 'if') {
      if (n.block === -1) {
        // Outside islands: a plain choice, no markers.
        const last = n.branches[n.branches.length - 1]!
        let expr = last.cond === null ? `(${htmlExpr(last.nodes, rewrite)})` : '""'
        const conditional = last.cond === null ? n.branches.slice(0, -1) : n.branches
        for (const b of [...conditional].reverse()) expr = `(${wrapExpr(rewrite(b.cond!))} ? (${htmlExpr(b.nodes, rewrite)}) : ${expr})`
        return expr
      }
      const branches = n.branches.map((b) => `() => ${htmlExpr(b.nodes, rewrite)}`).join(', ')
      return `__cl_blockHtml(${n.block}, ${whichExpr(n, rewrite)}, [${branches}])`
    }
    if (n.kind === 'component') {
      const props = n.props.map((p) => `${p.name}: ${wrapExpr(p.expr)}`).join(', ')
      return n.children.length ? `${renderName(n.name)}({ ${props} }, ${htmlExpr(n.children, rewrite)})` : `${renderName(n.name)}({ ${props} })`
    }
    const value = `__cl_escape(${wrapExpr(rewrite(n.expr))})`
    return n.reactive ? `"<!--[${n.index}-->" + ${value} + "<!--]-->"` : value
  })
  return parts.length ? parts.join(' + ') : '""'
}

/** Index of the branch an @if picks: `(a ? 0 : b ? 1 : 2)`, or -1 when nothing matches and there is no @else. */
export function whichExpr(n: Extract<IRNode, { kind: 'if' }>, rewrite: Rewrite): string {
  let expr = n.branches[n.branches.length - 1]!.cond === null ? String(n.branches.length - 1) : '-1'
  for (let i = n.branches.length - 1; i >= 0; i--) {
    const cond = n.branches[i]!.cond
    if (cond !== null) expr = `${wrapExpr(rewrite(cond))} ? ${i} : ${expr}`
  }
  return `(${expr})`
}

/** JS expression for an attribute's value: the bound expression, or the parts joined (null/undefined join as ''). */
export function attrValueExpr(value: Extract<IRNode, { kind: 'attr' }>['value'], rewrite: Rewrite): string {
  if ('expr' in value) return `(${rewrite(value.expr)})`
  return `[${value.parts.map((p) => (typeof p === 'string' ? JSON.stringify(p) : `(${rewrite(p.expr)})`)).join(', ')}].join("")`
}

/** Every node, including those inside @if branches and component children. */
export function walk(nodes: IRNode[]): IRNode[] {
  return nodes.flatMap((n) => [n, ...(n.kind === 'if' ? n.branches.flatMap((b) => walk(b.nodes)) : n.kind === 'component' ? walk(n.children) : [])])
}
