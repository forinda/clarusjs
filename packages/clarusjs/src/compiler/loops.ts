// Nested @for (#585): inside an inner loop, $index is that loop's. Indexing an outer loop's list with it reads or
// writes the wrong row, silently (both are numbers): an error that names `let`, for the compiler and the checker.

import { awaitLists, type TemplateNode } from './parse.ts'

/** An enclosing @for, outermost first: its item and its list as written. */
export type Loop = { item: string; list: string }

/** Why `expr` indexes an outer loop's list with the inner loop's $index, or null. `loops`: outermost first. */
export function outerIndexError(expr: string, loops: Loop[]): string | null {
  const inner = loops.at(-1)
  for (const loop of loops.slice(0, -1)) {
    if (loop.list === inner!.list) continue // the same list, by its own loop's index
    const escaped = loop.list.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')
    if (new RegExp(`(?<![\\w$.])${escaped}\\s*\\[\\s*\\$index\\s*\\]`).test(expr)) {
      return `$index here is the inner @for's, not the one over ${loop.list}: name that one's index, @for (${loop.item} of ${loop.list}; …; let i = $index), and write ${loop.list}[i]`
    }
  }
  return null
}

/** The first expression in `nodes` that indexes an outer loop's list with an inner $index: why, and where. */
export function outerIndexIn(nodes: TemplateNode[], loops: Loop[] = []): { message: string; start: number } | null {
  const test = (expr: string, start: number) => { const why = loops.length > 1 && outerIndexError(expr, loops); return why ? { message: why, start } : null }
  for (const n of nodes) {
    let found: { message: string; start: number } | null = null
    if (n.type === 'expr') found = test(n.expr, n.start)
    else if (n.type === 'element') {
      for (const a of n.attrs) {
        if (a.kind === 'interp') for (const p of a.parts) found ??= typeof p === 'string' ? null : test(p.expr, p.start)
        else if (a.kind !== 'static') found ??= test(a.expr, a.start)
      }
      found ??= outerIndexIn(n.children, loops)
    } else if (n.type === 'if') for (const b of n.branches) found ??= (b.cond !== null ? test(b.cond, b.condStart) : null) ?? outerIndexIn(b.children, loops)
    else if (n.type === 'for') found = test(n.list, n.listStart) ?? outerIndexIn(n.children, [...loops, { item: n.item, list: n.list }]) ?? (n.empty ? outerIndexIn(n.empty, loops) : null)
    else if (n.type === 'fill') found = outerIndexIn(n.children, loops)
    else if (n.type === 'await') { found = test(n.expr, n.exprStart); for (const kids of awaitLists(n)) found ??= outerIndexIn(kids, loops) }
    if (found) return found
  }
  return null
}
