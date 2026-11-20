// Attach helpers: find hole markers in server HTML and keep them updated. Browser only. Never re-renders.
import { attrValue } from './attrs.ts'
import { effect, onDispose, scope, untrack } from './signals.ts'

export type Hole = { start: Comment; end: Comment }

export type Block = { start: Comment; end: Comment; k: number }

/**
 * Find hole markers `<!--[N-->…<!--]-->` and block markers `<!--[bN:K-->…<!--]-->` inside `root`, skipping nested
 * islands. Indexes are unique per component, so markers inside a rendered branch keep their own numbers.
 */
function scan(root: Element): { holes: Hole[]; blocks: Block[] } {
  const holes: Hole[] = []
  const blocks: Block[] = []
  const open: { kind: 'hole' | 'block'; index: number; k: number; start: Comment }[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT, {
    acceptNode: (n) =>
      n.nodeType === 8 ? NodeFilter.FILTER_ACCEPT
      : n !== root && (n as Element).localName === 'cl-island' ? NodeFilter.FILTER_REJECT
      : NodeFilter.FILTER_SKIP,
  })
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const data = (n as Comment).data
    let m: RegExpExecArray | null
    if ((m = /^\[(\d+)$/.exec(data))) open.push({ kind: 'hole', index: Number(m[1]), k: 0, start: n as Comment })
    else if ((m = /^\[b(\d+):(-?\d+)$/.exec(data))) open.push({ kind: 'block', index: Number(m[1]), k: Number(m[2]), start: n as Comment })
    else if (data === ']' && open.length) {
      const o = open.pop()!
      if (o.kind === 'hole') holes[o.index] = { start: o.start, end: n as Comment }
      else blocks[o.index] = { start: o.start, end: n as Comment, k: o.k }
    }
  }
  return { holes, blocks }
}

/** Hole markers of this island, by index. */
export function holes(root: Element): Hole[] {
  return scan(root).holes
}

/** Block markers of this island, by index. */
export function blocks(root: Element): Block[] {
  return scan(root).blocks
}

/**
 * An @if block. `which()` picks the branch (-1 for none). The server-rendered branch is wired in place; a change
 * removes the old branch (disposing its effects and handlers), inserts the new branch's HTML and wires it.
 */
export function block(root: Element, index: number, which: () => number, branches: { html: () => string; wire: () => void }[]): void {
  const b = blocks(root)[index]
  if (!b) return
  let current = b.k
  let dispose: (() => void) | null = null
  let first = true
  onDispose(() => dispose?.()) // removing the enclosing branch removes this one's too
  effect(() => {
    const k = which()
    untrack(() => {
      if (!first && k === current) return
      if (k !== current) {
        dispose?.()
        while (b.start.nextSibling && b.start.nextSibling !== b.end) b.start.nextSibling.remove()
        if (k >= 0) {
          const t = document.createElement('template')
          t.innerHTML = branches[k]!.html()
          b.end.before(t.content)
        }
        current = k
      }
      first = false
      dispose = k >= 0 ? scope(() => branches[k]!.wire()) : null
    })
  })
}

/** Keep exactly one text node between the hole's markers, set to `fn()`. */
export function text(hole: Hole, fn: () => unknown): void {
  effect(() => {
    const value = fn()
    const s = value == null ? '' : String(value)
    const first = hole.start.nextSibling
    if (first && first !== hole.end && first.nodeType === 3 && first.nextSibling === hole.end) {
      if ((first as Text).data !== s) (first as Text).data = s
      return
    }
    while (hole.start.nextSibling && hole.start.nextSibling !== hole.end) hole.start.nextSibling.remove()
    hole.end.before(document.createTextNode(s))
  })
}

type Handlers = Map<number, ((e: Event) => void)[]>
const registry = new WeakMap<Element, Map<string, Handlers>>()
// These don't bubble, so they are caught on the way down instead.
const CAPTURE = new Set(['focus', 'blur'])

/**
 * Register a handler for elements marked `data-cl-e="index"` inside this island.
 * One listener per island per event type; it walks from the target up to the island root, running handlers
 * innermost first and stopping when one calls `stopPropagation()`.
 */
export function on(root: Element, index: number, type: string, fn: (e: Event) => void): void {
  let types = registry.get(root)
  if (!types) registry.set(root, (types = new Map()))
  let handlers = types.get(type)
  if (!handlers) {
    const own = (handlers = new Map())
    types.set(type, own)
    root.addEventListener(type, (e) => {
      for (let el = e.target as Element | null; el && el !== root.parentElement; el = el.parentElement) {
        const i = el.getAttribute?.('data-cl-e')
        if (i === null || i === undefined || el.closest('cl-island') !== root) continue
        for (const h of own.get(Number(i)) ?? []) h(e)
        if (e.cancelBubble) break
      }
    }, CAPTURE.has(type))
  }
  if (!handlers.has(index)) handlers.set(index, [])
  const list = handlers.get(index)!
  list.push(fn)
  onDispose(() => { const at = list.indexOf(fn); if (at !== -1) list.splice(at, 1) }) // a removed branch stops listening
}

/** Keep attribute `name` of this island's element marked `data-cl-a="index"` in sync with `fn()`. */
export function attr(root: Element, index: number, name: string, fn: () => unknown): void {
  const el = [...root.querySelectorAll(`[data-cl-a="${index}"]`)].find((e) => e.closest('cl-island') === root)
  if (!el) return
  effect(() => {
    const v = attrValue(name, fn())
    if (v === null) el.removeAttribute(name)
    else el.setAttribute(name, v === true ? '' : v)
  })
}
