// Attach helpers: find hole markers in server HTML and keep them updated. Browser only. Never re-renders.
import { effect } from './signals.ts'

export type Hole = { start: Comment; end: Comment }

/** Find `<!--[N-->…<!--]-->` pairs inside `root`, skipping nested islands. Returns holes indexed by N. */
export function holes(root: Element): Hole[] {
  const found: Hole[] = []
  const open: { index: number; start: Comment }[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT, {
    acceptNode: (n) =>
      n.nodeType === 8 ? NodeFilter.FILTER_ACCEPT
      : n !== root && (n as Element).localName === 'kv-island' ? NodeFilter.FILTER_REJECT
      : NodeFilter.FILTER_SKIP,
  })
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const data = (n as Comment).data
    if (/^\[\d+$/.test(data)) open.push({ index: Number(data.slice(1)), start: n as Comment })
    else if (data === ']' && open.length) {
      const { index, start } = open.pop()!
      found[index] = { start, end: n as Comment }
    }
  }
  return found
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

/** Delegated listener on the island root for elements marked `data-kv-e="index"` that belong to this island. */
export function on(root: Element, index: number, type: string, fn: (e: Event) => void): void {
  root.addEventListener(type, (e) => {
    const el = (e.target as Element | null)?.closest?.(`[data-kv-e="${index}"]`)
    if (el && el.closest('kv-island') === root) fn(e)
  })
}
