// Attach helpers: find markers in server HTML and keep them updated. Browser only. Never re-renders existing HTML;
// only @if branches and @for rows that did not exist on the server are rendered here.
import { attrValue, spreadAttrs } from './attrs.ts'
import { afterWiring, batch, effect, onDispose, scope, state, untrack, type Signal } from './signals.ts'

/** @internal Compiled components call this; apps don't. */
export type Hole = { start: Comment; end: Comment }
/** @internal Compiled components call this; apps don't. */
export type Block = { start: Comment; end: Comment; k: number }
type Range = { start: Comment; end: Comment }
export type For = Range & { rows: Range[]; empty: Range | null }

/**
 * Where wiring looks for its markers: a whole island, or one @for row inside it. A row template repeats its marker
 * numbers once per row, so code wiring a row only looks between that row's markers.
 * @internal Compiled components call this; apps don't.
 */
export type Ctx = Element | { root: Element; start: Comment; end: Comment }

const rootOf = (ctx: Ctx): Element => ('root' in ctx ? ctx.root : ctx)

/** Is `node` inside `ctx` (always true for a whole island)? */
function inside(ctx: Ctx, node: Node): boolean {
  if (!('root' in ctx)) return true
  return !!(ctx.start.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) &&
    !!(ctx.end.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_PRECEDING)
}

/**
 * The island that owns `node` (#465): its nearest <cl-island>, except that each slot range (`<!--[s-->…<!--]s-->`) it
 * sits inside moves ownership one island outward, so content an island passes to another stays its own. Null when
 * no island owns it. An [s the parser left without its ]s runs to the end of its parent.
 * @internal
 */
export function owner(node: Node): Element | null {
  let out = 0
  for (let n: Node | null = node; n; n = n.parentNode) {
    if (n !== node && (n as Element).localName === 'cl-island') {
      if (!out) return n as Element
      out--
    }
    out += openSlots(n)
  }
  return null
}

// What each island provides (#465), for the components it holds that another island re-renders.
const provided = new WeakMap<Element, object>()
/** @internal An island's provide()s, for content another island re-renders inside it. */
export function provideOn(root: Element, cx: object): void { provided.set(root, cx) }
/**
 * The context a region renders with: its island's own, plus what each island holding the region (it sits in their
 * slot ranges, between them and `root`) provides, inner ones first. Spreading (Object.assign drops a __proto__ key)
 * reads the getters now, so the region follows the values it read.
 */
function contextAt(node: Node, root: Element, own?: object): object | undefined {
  let cx: object | undefined
  for (let n = node.parentNode; n && n !== root; n = n.parentNode) if ((n as Element).localName === 'cl-island') cx = { ...provided.get(n as Element), ...cx }
  return cx ? { ...own, ...cx } : own
}

/** Slot ranges still open at `n`, among the siblings before it (#465). @internal */
export function openSlots(n: Node): number {
  if (slots) {
    // While keepSlots() runs: from the nearest sibling on the left already counted, then rightwards, keeping each count. A list's
    // rows then cost one pass, not one walk back per row. Left to right it's a depth: [s opens, ]s closes an open one.
    const todo: Node[] = []
    let s = n.previousSibling
    while (s && !slots.has(s)) { todo.push(s); s = s.previousSibling }
    let depth = s ? step(slots.get(s)!, s) : 0
    for (let i = todo.length - 1; i >= 0; i--) { slots.set(todo[i]!, depth); depth = step(depth, todo[i]!) }
    slots.set(n, depth)
    return depth
  }
  let open = 0
  let closed = 0
  for (let s = n.previousSibling; s; s = s.previousSibling) {
    if (s.nodeType !== 8) continue
    const d = (s as Comment).data
    if (d === ']s') closed++
    else if (d === '[s') closed ? closed-- : open++
  }
  return open
}

// The slot ranges open before each node (#589 review), kept while keepSlots() runs: an island’s attach, a forms refresh.
let slots: WeakMap<Node, number> | null = null
const step = (depth: number, n: Node) => (n.nodeType !== 8 ? depth : (n as Comment).data === '[s' ? depth + 1 : (n as Comment).data === ']s' && depth ? depth - 1 : depth)
/** The DOM's shape changed: counts kept so far may be wrong. */
/** @internal Nodes were added or removed: cached slot ranges are stale. */
export const reshaped = () => { if (slots) slots = new WeakMap() }
/**
 * Run `fn` with openSlots() counts kept between calls; nothing outside this file may add or remove nodes meanwhile.
 * @internal The loader (attach) and the forms engine (refresh) call this.
 */
export function keepSlots<T>(fn: () => T): T {
  if (slots) return fn()
  slots = new WeakMap()
  try { return fn() } finally { slots = null }
}

/** The island a context's root stands for: itself when it is one, else the island it is in (null: none). */
const islandOf = (root: Element) => (root.localName === 'cl-island' ? root : owner(root))

/**
 * Find every marker in `ctx`, skipping nested islands:
 * holes `<!--[N-->`, @if blocks `<!--[bN:K-->`, @for lists `<!--[fN-->` with rows `<!--[r-->` and `<!--[e-->`,
 * all closed by `<!--]-->`.
 */
function scan(ctx: Ctx): { holes: Hole[]; blocks: Block[]; fors: For[]; regions: Range[] } {
  const root = rootOf(ctx)
  const holes: Hole[] = []
  const blocks: Block[] = []
  const fors: For[] = []
  const regions: Range[] = []
  type Open = { kind: 'hole' | 'block' | 'for' | 'row' | 'empty' | 'region'; index: number; k: number; start: Comment; rows: Range[]; empty: Range | null }
  const open: Open[] = []
  const take = (c: Comment) => {
    const data = c.data
    let m: RegExpExecArray | null
    const push = (kind: Open['kind'], index = 0, k = 0) => open.push({ kind, index, k, start: c, rows: [], empty: null })
    if ((m = /^\[(\d+)$/.exec(data))) push('hole', Number(m[1]))
    else if ((m = /^\[b(\d+):(-?\d+)$/.exec(data))) push('block', Number(m[1]), Number(m[2]))
    else if ((m = /^\[f(\d+)$/.exec(data))) push('for', Number(m[1]))
    else if ((m = /^\[c(\d+)$/.exec(data))) push('region', Number(m[1]))
    else if (data === '[r') push('row')
    else if (data === '[e') push('empty')
    else if (data === ']' && open.length) {
      const o = open.pop()!
      const parent = open[open.length - 1]
      if (o.kind === 'hole') holes[o.index] = { start: o.start, end: c }
      else if (o.kind === 'block') blocks[o.index] = { start: o.start, end: c, k: o.k }
      else if (o.kind === 'for') fors[o.index] = { start: o.start, end: c, rows: o.rows, empty: o.empty }
      else if (o.kind === 'region') regions[o.index] = { start: o.start, end: c }
      else if (parent?.kind === 'for') {
        if (o.kind === 'row') parent.rows.push({ start: o.start, end: c })
        else parent.empty = { start: o.start, end: c }
      }
    }
  }
  // One pass (#465): `level` counts the islands entered below this one, minus the slot ranges entered (each moves its
  // content one island out), so the island's own comments are at 0 and nothing below 0 is (as owner() says, linearly).
  // The siblings from `first` up to `stop` (not included), and what they hold.
  const visit = (first: Node | null, stop: Node | null, level: number) => {
    let ranges = 0
    for (let n = first; n && n !== stop; n = n.nextSibling) {
      if (n.nodeType === 1) level < 0 || visit(n.firstChild, null, level + ((n as Element).localName === 'cl-island' ? 1 : 0))
      else if (n.nodeType !== 8) continue
      else if ((n as Comment).data === '[s') { ranges++; level-- }
      else if ((n as Comment).data === ']s') { if (ranges) { ranges--; level++ } }
      else if (!level && (near || inside(ctx, n))) take(n as Comment)
    }
  }
  // A row whose markers are siblings: only between them, not the whole island once per row. Otherwise (a <tr> row
  // straight in a <table>: the parser puts a <tbody> between them) the whole island, kept to the row's range.
  const near = 'root' in ctx && ctx.start.parentNode === ctx.end.parentNode
  if (near) visit(ctx.start.nextSibling, ctx.end, 0)
  else visit(root.firstChild, null, 0)
  return { holes, blocks, fors, regions }
}

/** Hole markers in `ctx`, by index. @internal */
export function holes(ctx: Ctx): Hole[] {
  return scan(ctx).holes
}

/** @if block markers in `ctx`, by index. @internal */
export function blocks(ctx: Ctx): Block[] {
  return scan(ctx).blocks
}

/** Turn HTML into nodes and put them before `end`; returns the first and last inserted node. @internal */
export function insertHtml(html: string, end: Node): { first: Node | null; last: Node | null } {
  const t = document.createElement('template')
  t.innerHTML = html
  const first = t.content.firstChild
  const last = t.content.lastChild
  end.parentNode!.insertBefore(t.content, end)
  reshaped()
  // Child islands in the new HTML attach like the ones on the page (the loader registers this hook).
  const attachIslands = (globalThis as { __clAttach?: (root: ParentNode) => void }).__clAttach
  if (attachIslands && end.parentNode) attachIslands(end.parentNode)
  return { first, last }
}

/** The nodes from `start` to `end`, both included. */
function rangeNodes(start: Node, end: Node): Node[] {
  const nodes: Node[] = []
  for (let n: Node | null = start; n; n = n.nextSibling) {
    nodes.push(n)
    if (n === end) break
  }
  return nodes
}

/**
 * An @if block. `which()` picks the branch (-1 for none). The server-rendered branch is wired in place; a change
 * removes the old branch (disposing its effects and handlers), inserts the new branch's HTML and wires it.
 * @internal Compiled components call this; apps don't.
 */
export function block(ctx: Ctx, index: number, which: () => number, branches: { html: () => string; wire: () => void }[]): void {
  const b = blocks(ctx)[index]
  if (!b) return
  let current = b.k
  let dispose: (() => void) | null = null
  let first = true
  onDispose(() => dispose?.()) // removing the enclosing branch or row removes this one's too
  effect(() => {
    const k = which()
    untrack(() => {
      if (!first && k === current) return
      if (k !== current) {
        dispose?.()
        while (b.start.nextSibling && b.start.nextSibling !== b.end) b.start.nextSibling.remove()
        reshaped()
        if (k >= 0) insertHtml(branches[k]!.html(), b.end)
        current = k
      }
      first = false
      dispose = k >= 0 ? scope(() => branches[k]!.wire()) : null
    })
  })
}

/**
 * A child component inside an island whose props or content read state. `html()` renders it with the current
 * values; when anything it read changes, the old HTML is disposed and replaced, and `wire()` wires the island's own
 * holes and events in the child's slot content again. A stateful child is remounted with its new props.
 */
/** The one <cl-island> among `nodes` (blank text aside), or null. */
const onlyIsland = (nodes: Node[]): Element | null => {
  const kept = nodes.filter((n) => n.nodeType !== 3 || n.textContent!.trim())
  return kept.length === 1 && (kept[0] as Element).localName === 'cl-island' ? (kept[0] as Element) : null
}

/**
 * An @await's promise in an island (#430): `k()` is 0 while it's pending, 1 once it resolved, 2 once it rejected
 * (tracked, so a block follows it); `v()` is the value or error. When the expression's signals change, a new
 * promise starts (back to pending) and only the newest one's answer counts. @internal
 */
export function awaited(fn: () => unknown): { k(): number; v(): unknown } {
  const k = state(0)
  let v: unknown
  let run = 0
  onDispose(() => { run++ }) // an answer after the island is gone changes nothing
  effect(() => {
    const p = fn()
    const id = ++run
    untrack(() => k.set(0))
    Promise.resolve(p).then(
      (x) => { if (id === run) { v = x; k.set(1) } },
      (e) => { if (id === run) { v = e; k.set(2) } },
    )
  })
  return { k: () => k.get(), v: () => v }
}

/** @internal Compiled components call this; apps don't. */
export function region(ctx: Ctx, index: number, html: (cx?: object) => string, wire: () => void, cx?: object): void {
  const r = scan(ctx).regions[index]
  if (!r) return
  let dispose: (() => void) | null = null
  let first = true
  onDispose(() => dispose?.())
  effect(() => {
    const next = html(contextAt(r.start, rootOf(ctx), cx))
    untrack(() => {
      if (!first) {
        // A nested island with new props is updated in place (DOM and state kept), not replaced.
        const t = document.createElement('template')
        t.innerHTML = next
        const between: Node[] = []
        for (let n = r.start.nextSibling; n && n !== r.end; n = n.nextSibling) between.push(n)
        const old = onlyIsland(between)
        const fresh = onlyIsland([...t.content.childNodes])
        if (old && fresh && (globalThis as { __clUpdate?: (el: Element, next: Element) => boolean }).__clUpdate?.(old, fresh)) return
        dispose?.()
        while (r.start.nextSibling && r.start.nextSibling !== r.end) r.start.nextSibling.remove()
        reshaped()
        insertHtml(next, r.end)
      }
      first = false
      dispose = scope(wire)
    })
  })
}

type Row = Range & { key: unknown; item: Signal<unknown>; index: Signal<number>; dispose: () => void }

/**
 * @transition around a @for (clarusjs/motion): `in` gets each new row's nodes (`initial` for the server's rows on
 * attach), `out` a removed row's (instead of removing them), and the update runs inside `frame` so moves can be
 * measured before and after.
 * @internal
 */
export type ForTransition = { in(nodes: Node[], initial?: boolean): void; out(nodes: Node[]): void; frame(start: Node, end: Node, run: () => void): void }

/**
 * A @for list. Rows the server rendered are adopted in place. When the list changes, rows are matched by key:
 * kept rows keep their DOM nodes (moved only when out of order) and get the new item and index through their
 * signals; new rows are rendered and wired; removed rows are disposed and removed. `@empty` content is shown while
 * the list is empty.
 * @internal Compiled components call this; apps don't.
 */
export function forBlock(
  ctx: Ctx,
  index: number,
  list: () => unknown,
  keyOf: (item: any, i: number) => unknown,
  row: { html: (item: any, i: number, list: unknown[]) => string; wire: (ctx: Ctx, item: Signal<any>, index: Signal<number>, count: Signal<number>) => void },
  empty: { html: () => string; wire: (ctx: Ctx) => void } | null,
  t?: ForTransition,
): void {
  const f = scan(ctx).fors[index]
  if (!f) return
  const root = rootOf(ctx)
  let rows: Row[] = []
  let emptyRange: (Range & { dispose: () => void }) | null = null
  let first = true
  const count = state(0) // the list's length, for rows using $count, $last…

  const wireRow = (range: Range, key: unknown, item: unknown, i: number): Row => {
    const itemS = state(item)
    const indexS = state(i)
    const dispose = scope(() => row.wire({ root, ...range }, itemS, indexS, count))
    return { ...range, key, item: itemS, index: indexS, dispose }
  }
  const wireEmpty = (range: Range) => ({ ...range, dispose: empty ? scope(() => empty.wire({ root, ...range })) : () => {} })

  onDispose(() => {
    for (const r of rows) r.dispose()
    emptyRange?.dispose()
  })

  effect(() => {
    const items = [...((list() ?? []) as Iterable<unknown>)]
    untrack(() => batch(() => {
      count.set(items.length) // with the rows' new indices below, in one batch: $last doesn't flip on the way
      // Keys, made unique: a repeated key would make two rows share one identity.
      const seen = new Set<unknown>()
      const keys = items.map((item, i) => {
        let key = keyOf(item, i)
        if (seen.has(key)) {
          // Development only: Vite replaces import.meta.env.DEV, so a production build drops it (no ImportMeta
          // declaration needed: consumers of this source typecheck without one).
          if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) console.warn(`[clarusjs] @for: duplicate key ${String(key)}; rows with repeated keys are matched by position`)
          key = `${String(key)}\u0000${i}`
        }
        seen.add(key)
        return key
      })

      if (first) {
        first = false
        if (f.rows.length === items.length) {
          rows = f.rows.map((range, i) => wireRow(range, keys[i], items[i], i))
          if (f.empty) emptyRange = wireEmpty(f.empty)
          if (t) for (const r of rows) t.in(rangeNodes(r.start, r.end), true)
          return
        }
        // The browser's list isn't the one the server rendered (it read something the server couldn't: the URL,
        // storage): drop the server's rows and render the browser's below, as for any change.
        for (const range of f.rows) for (const node of rangeNodes(range.start, range.end)) node.parentNode?.removeChild(node)
        if (f.empty) emptyRange = wireEmpty(f.empty)
        reshaped()
      }

      // With @transition, the update runs inside t.frame (clarusjs/motion measures rows before and after it).
      const update = () => {
        const added: Row[] = []
        const old = new Map(rows.map((r) => [r.key, r]))
        const next = items.map((item, i) => {
          const kept = old.get(keys[i])
          if (kept) {
            old.delete(keys[i])
            kept.item.set(item)
            kept.index.set(i)
            return kept
          }
          const { first: start, last: end } = insertHtml(`<!--[r-->${row.html(item, i, items)}<!--]-->`, f.end)
          const r = wireRow({ start: start as Comment, end: end as Comment }, keys[i], item, i)
          added.push(r)
          return r
        })
        for (const r of old.values()) {
          r.dispose()
          // With @transition, a removed row leaves first (clarusjs/motion), else it goes now.
          if (t) t.out(rangeNodes(r.start, r.end))
          else for (const n of rangeNodes(r.start, r.end)) n.parentNode?.removeChild(n)
        }
        reshaped()
        // Put rows in order, moving only those that are not already right after the previous one.
        let anchor: Node = f.start
        for (const r of next) {
          // With @transition, leaving rows (no markers left) sit between live ones: stepped over, they keep their place.
          let at = anchor.nextSibling
          if (t) while (at && at.nodeType !== 8) at = at.nextSibling
          if (at !== r.start) { (anchor as ChildNode).after(...rangeNodes(r.start, r.end)); reshaped() }
          anchor = r.end
        }
        rows = next
        if (t) for (const r of added) t.in(rangeNodes(r.start, r.end))
      }
      if (t) t.frame(f.start, f.end, update)
      else update()

      if (items.length && emptyRange) {
        emptyRange.dispose()
        for (const n of rangeNodes(emptyRange.start, emptyRange.end)) n.parentNode?.removeChild(n)
        reshaped()
        emptyRange = null
      } else if (!items.length && !emptyRange && empty) {
        const { first: start, last: end } = insertHtml(`<!--[e-->${empty.html()}<!--]-->`, f.end)
        emptyRange = wireEmpty({ start: start as Comment, end: end as Comment })
      }
    }))
  })
}

/** Keep exactly one text node between the hole's markers, set to `fn()`. @internal */
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

type Handler = { fn: (e: Event, el: Element) => void; ctx: Ctx }
const registry = new WeakMap<Element, Map<string, Map<number, Handler[]>>>()
// These don't bubble, so they are caught on the way down instead.
const CAPTURE = new Set([
  'focus', 'blur', 'mouseenter', 'mouseleave', 'pointerenter', 'pointerleave', 'load', 'error', 'scroll', 'toggle',
  'invalid', 'close', 'cancel', 'play', 'pause', 'ended', 'timeupdate', 'volumechange', 'loadedmetadata', 'canplay',
])

/**
 * Register a handler for elements marked `data-cl-e="index"` inside `ctx`.
 * One listener per island per event type; it walks from the target up to the island root, running handlers
 * innermost first and stopping when one calls `stopPropagation()`. A handler registered for a @for row only fires
 * for elements in that row.
 * @internal Compiled components call this; apps don't.
 */
export function on(ctx: Ctx, index: number, type: string, fn: (e: Event, el: Element) => void): void {
  const root = rootOf(ctx)
  let types = registry.get(root)
  if (!types) registry.set(root, (types = new Map()))
  let handlers = types.get(type)
  if (!handlers) {
    const own: Map<number, Handler[]> = (handlers = new Map())
    types.set(type, own)
    root.addEventListener(type, (e) => {
      // An event that doesn't bubble (mouseenter, focus) is its target's alone, not its ancestors'.
      for (let el = e.target as Element | null; el && el !== root.parentElement; el = e.bubbles ? el.parentElement : null) {
        const i = el.getAttribute?.('data-cl-e')
        if (i === null || i === undefined || owner(el) !== root) continue
        for (const h of [...(own.get(Number(i)) ?? [])]) if (inside(h.ctx, el)) h.fn(e, el)
        if (e.cancelBubble) break
      }
    }, CAPTURE.has(type))
  }
  if (!handlers.has(index)) handlers.set(index, [])
  const list = handlers.get(index)!
  const handler = { fn, ctx }
  list.push(handler)
  onDispose(() => { const at = list.indexOf(handler); if (at !== -1) list.splice(at, 1) }) // a removed branch or row stops listening
}

/**
 * $values (#444): el's form's fields (el's, or its form's) as an object; a repeated name gives a list, and a
 * submit's button counts.
 * @internal Compiled handlers call this.
 */
export function values(el: Element, e?: Event): Record<string, unknown> {
  const form = el instanceof HTMLFormElement ? el : (el as HTMLInputElement).form ?? el.closest('form')
  if (!form) return {}
  const data = new FormData(form, (e as SubmitEvent | undefined)?.submitter)
  // own properties: a field named __proto__ stays a field
  return Object.fromEntries([...new Set(data.keys())].map((k) => {
    const all = data.getAll(k)
    return [k, all.length > 1 ? all : all[0]]
  }))
}

/**
 * [use]="behaviour" (#464): call each behaviour (one, or a list) with the element marked data-cl-u="index", once; a
 * function it returns runs when the branch, row or island goes.
 * @internal Compiled components call this.
 */
export function use(ctx: Ctx, index: number, get: () => unknown): void {
  const el = marked(ctx, `[data-cl-u="${index}"]`)
  if (!el) return
  // After the wiring around it (#550), if its element is still there.
  afterWiring(() => {
    if (!el.isConnected) return
    for (const fn of [untrack(get)].flat()) {
      if (typeof fn !== 'function') continue
      const dispose = fn(el)
      if (typeof dispose === 'function') onDispose(dispose)
    }
  })
}

/** The element matching `selector` in `ctx`: this island's (not a nested island's), and in a row, that row's. */
export function marked(ctx: Ctx, selector: string): Element | undefined {
  const root = rootOf(ctx)
  const island = islandOf(root)
  const mine = (e: Element) => owner(e) === island
  if (!('root' in ctx) || ctx.start.parentNode !== ctx.end.parentNode) return [...root.querySelectorAll(selector)].find((e) => mine(e) && inside(ctx, e))
  // A row with sibling markers: the elements between them, not the whole island's once per row.
  for (let n = ctx.start.nextSibling; n && n !== ctx.end; n = n.nextSibling) {
    if (n.nodeType !== 1) continue
    const found = ((n as Element).matches(selector) ? [n as Element] : []).concat([...(n as Element).querySelectorAll(selector)]).find(mine)
    if (found) return found
  }
  return undefined
}

/**
 * A reactive spread (#405): sets the attributes the object has, removes the ones it no longer has (only those it set:
 * never one written on the element, which `skip` lists). Dropped keys are dropped silently here; the server warns.
 * @internal
 */
export function spread(ctx: Ctx, index: number, fn: () => unknown, skip: readonly string[], tag?: string): void {
  const el = marked(ctx, `[data-cl-a="${index}"]`)
  if (!el) return
  let had = new Set<string>()
  effect(() => {
    const now = new Set<string>()
    for (const [name, v] of spreadAttrs(fn(), skip, tag).set) {
      now.add(name)
      if (v === null) el.removeAttribute(name)
      else el.setAttribute(name, v === true ? '' : v)
    }
    for (const name of had) if (!now.has(name)) el.removeAttribute(name)
    had = now
  })
}

/** Keep attribute `name` of the element marked `data-cl-a="index"` in `ctx` in sync with `fn()`. @internal */
export function attr(ctx: Ctx, index: number, name: string, fn: () => unknown, tag?: string): void {
  const el = marked(ctx, `[data-cl-a="${index}"]`)
  if (!el) return
  let first = true
  effect(() => {
    const raw = fn()
    // At attach, a field already typed in (before the island's code loaded) keeps what was typed: the loader's
    // replayed input event then writes it to state. Its value differs from the one the server rendered.
    const typed = first && name === 'value' && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && (el as HTMLInputElement).value !== (el as HTMLInputElement).defaultValue
    first = false
    // <select multiple> bound to an array: each option selected when the array has its value.
    if (name === 'value' && Array.isArray(raw) && el.tagName === 'SELECT' && (el as HTMLSelectElement).multiple) {
      const values = raw.map(String) // option values are text: [1, 2] selects "1" and "2"
      for (const o of (el as HTMLSelectElement).options) o.selected = values.includes(o.value)
      return
    }
    const v = attrValue(name, raw, tag)
    if (v === null) el.removeAttribute(name)
    else el.setAttribute(name, v === true ? '' : v)
    // A form field shows its property once someone has typed or clicked in it, not the attribute: set both.
    if (name === 'value' && 'value' in el && !typed) {
      const field = el as HTMLInputElement
      const next = v === null || v === true ? '' : v
      // A number field showing the same number keeps what was typed ("1.0" isn't rewritten to "1" mid-typing).
      if (field.value !== next && !(/^(number|range)$/.test(field.type) && field.value !== '' && Number(field.value) === Number(raw))) field.value = next
    }
    if (name === 'checked' && 'checked' in el) (el as HTMLInputElement).checked = v !== null
  })
}

/**
 * A @model input: writing it asks the parent island to update its state (a bubbling, cancelable cl:model event from
 * the island); when no parent takes it (a top-level island), the input keeps the value itself. New props from the
 * parent set it with own().
 * @internal Compiled components call this; apps don't.
 */
export function modelInput<T>(root: Element, name: string, initial: T): Signal<T> & { own(value: T): void } {
  const value = state(initial)
  return {
    initial,
    get: value.get,
    own: value.set,
    set(next) {
      if (root.dispatchEvent(new CustomEvent('cl:model', { detail: { name, value: next }, bubbles: true, cancelable: true }))) value.set(next)
    },
  }
}

/**
 * emit() in a component that declares @event (#442): a cancelable cl:event from the island to its parent's listener.
 * False when the parent cancelled it ($info.cancel()).
 * @internal Compiled components call this; apps don't.
 */
export function emit(root: Element, name: string, value: unknown, info: { reason?: string; event?: Event } = {}): boolean {
  return root.dispatchEvent(new CustomEvent('cl:event', { detail: { name, value, ...info }, bubbles: true, cancelable: true }))
}

// The @event names each child island declares (recorded when it attaches): those don't fall through as DOM events.
const declared = new WeakMap<Element, string[]>()
/** A component's attach() records its @event names. @internal */
export function declare(root: Element, names: string[]): void {
  declared.set(root, names)
}

/**
 * (name)="…" on a component in region `index`. A child island's emit('name', …) arrives here and goes no further
 * (#442); any other name is the DOM event, bubbling up from what the child renders (Vue's fallthrough), unless the
 * child island declares it. @internal
 */
export function listen(ctx: Ctx, index: number, name: string, handler: (value: unknown, info: { reason?: string; event?: Event; cancel(): void }) => void, bound?: string): void {
  // The bound component's island (by its c name): only its emit() is this listener's, and only its contract decides
  // whether a DOM event is one it sends itself. A wrapper that declares nothing gets the DOM event.
  const isBound = (el: Element) => !bound || el.getAttribute('c') === bound
  fromChild(ctx, index, 'cl:event', name, (event, detail) => {
    const { value, reason, event: cause } = detail as { value: unknown; reason?: string; event?: Event }
    handler(value, { reason, event: cause, cancel: () => event.preventDefault() })
  }, (from) => isBound(from as Element))
  const r = scan(ctx).regions[index]
  if (!r) return
  const host = r.start.parentNode!
  const dom = (event: Event) => {
    const from = event.target as Node
    if (!(r.start.compareDocumentPosition(from) & 4) || !(r.end.compareDocumentPosition(from) & 2)) return
    // The bound island between the target and here: not attached yet, it replays the event once it is (its emit()
    // decides then); declaring this name, it sends it as its own event.
    for (let n: Node | null = from; n && n !== host; n = n.parentNode) {
      if ((n as Element).localName === 'cl-island' && isBound(n as Element) && (!(n as Element).hasAttribute('data-cl-ready') || declared.get(n as Element)?.includes(name))) return
    }
    handler(event, { event, cancel: () => event.preventDefault() })
  }
  host.addEventListener(name, dom)
  onDispose(() => host.removeEventListener(name, dom))
}

/** Listen for `type` from the child island bound in region `index` only (not one nested in it), named `name`. */
function fromChild(ctx: Ctx, index: number, type: string, name: string, take: (event: Event, detail: unknown) => void, accept: (from: Node) => boolean = () => true): void {
  const r = scan(ctx).regions[index]
  if (!r) return
  const host = r.start.parentNode!
  const listen = (event: Event) => {
    const detail = (event as CustomEvent<{ name: string }>).detail
    const from = event.target as Node
    // Only from inside this region: 4 = the target follows the start marker, 2 = it precedes the end marker.
    if (detail.name !== name || !(r.start.compareDocumentPosition(from) & 4) || !(r.end.compareDocumentPosition(from) & 2)) return
    // Only the child island this region binds: an island nested in it, which nobody bound, keeps its own.
    if (owner(from) !== rootOf(ctx) || !accept(from)) return
    event.stopPropagation()
    take(event, detail)
  }
  host.addEventListener(type, listen)
  onDispose(() => host.removeEventListener(type, listen))
}

/** [(name)]="…" on a child island in region `index`: the child's writes to its @model name arrive here. @internal */
export function model(ctx: Ctx, index: number, name: string, set: (value: unknown) => void): void {
  fromChild(ctx, index, 'cl:model', name, (event, detail) => {
    event.preventDefault() // taken: the child's value follows the parent's state
    set((detail as { value: unknown }).value)
  })
}
