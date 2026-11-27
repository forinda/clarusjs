// clarusjs/motion: the browser side of `@transition (name, options) { @if … }` (motion phase 2). An @if block of its
// own, so only islands that use @transition load this: dom.ts's block() stays as it is. Vue's contract (classes
// `<name>-enter-from/-active/-to`, `-leave-…`, modes, appear, duration, hooks); the end of a transition is read from
// the element's animations (getAnimations), capped by a timeout.
import { blocks, insertHtml, reshaped, type Ctx } from './dom.ts'
import { effect, onDispose, scope, untrack } from './signals.ts'

/**
 * What `@transition (name, options)` takes after the name.
 * @example
 * <script>
 *   const slide = { mode: 'out-in', duration: { enter: 200, leave: 150 } }
 * </script>
 * @transition ('slide', slide) { @if (step === 1) { <p>One</p> } @else { <p>Two</p> } }
 * @see https://clarusjs.com/guide/animations#transition
 */
export type TransitionOptions = {
  /** Default: the old branch leaves while the new one enters. `out-in`: the new one comes once the old one is gone. `in-out`: the new one enters first, then the old one leaves. */
  mode?: 'out-in' | 'in-out'
  /** Run enter on the branch the server rendered, when the island attaches. */
  appear?: boolean
  /** Milliseconds to wait instead of the element's animations (Vue's `:duration`). Not waited under reduced motion. */
  duration?: number | { enter?: number; leave?: number }
  /** `false`: no classes, only the hooks. */
  css?: false
  onBeforeEnter?(el: Element): void
  /** With a second parameter, the enter waits until `done()` is called. */
  onEnter?(el: Element, done: () => void): void
  onAfterEnter?(el: Element): void
  /** The branch changed while this element was still entering: it leaves from where it is. */
  onEnterCancelled?(el: Element): void
  onBeforeLeave?(el: Element): void
  /** With a second parameter, the leave waits until `done()` is called. */
  onLeave?(el: Element, done: () => void): void
  onAfterLeave?(el: Element): void
}

type Branch = { html: () => string; wire: () => void }
type Dir = 'enter' | 'leave'

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const sleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms))
// Vue's timing: the -from class is in place for one painted frame before -to replaces it.
const nextFrame = () => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))

/** The elements a branch's top-level nodes animate: a <cl-island> (display: contents) stands for its element children. */
function targets(nodes: Node[]): Element[] {
  return nodes.flatMap((n) => (n.nodeType !== 1 ? [] : (n as Element).localName === 'cl-island' ? targets([...(n as Element).children]) : [n as Element]))
}

/** The nodes between `start` and `end`, both excluded. */
function between(start: Node, end: Node): Node[] {
  const out: Node[] = []
  for (let n = start.nextSibling; n && n !== end; n = n.nextSibling) out.push(n)
  return out
}

/**
 * One element's enter or leave. Resolves when it's done; `cancel()` (an enter interrupted) ends it early, with the
 * classes taken off.
 */
function run(el: Element, dir: Dir, name: string, o: TransitionOptions): { done: Promise<void>; cancel(): void } {
  const css = o.css !== false
  const cls = (s: string) => `${name}-${dir}-${s}`
  const hook = (what: string) => (o as Record<string, ((el: Element, done: () => void) => void) | undefined>)[`on${what}`]
  let cancelled = false
  const clear = () => { if (css) el.classList.remove(cls('from'), cls('active'), cls('to')) }
  hook(dir === 'enter' ? 'BeforeEnter' : 'BeforeLeave')?.(el, () => {})
  if (css) el.classList.add(cls('from'), cls('active'))
  // A reflow, so the leave starts from the element's current style (Vue forces one too).
  if (dir === 'leave') void (el as HTMLElement).offsetHeight
  const done = (async () => {
    await nextFrame()
    if (cancelled) return
    if (css) { el.classList.remove(cls('from')); el.classList.add(cls('to')) }
    const on = hook(dir === 'enter' ? 'Enter' : 'Leave')
    const ms = typeof o.duration === 'number' ? o.duration : o.duration?.[dir]
    let wait: Promise<unknown>
    if (on && on.length >= 2) wait = new Promise<void>((resolve) => on(el, resolve))
    else {
      on?.(el, () => {})
      // An explicit duration replaces the animations; under reduced motion there is nothing the user wants to wait for.
      wait = ms !== undefined ? (reduced() ? Promise.resolve() : sleep(ms))
        : css ? Promise.allSettled((el.getAnimations?.({ subtree: true }) ?? []).map((a) => a.finished)) : Promise.resolve()
    }
    // The safety net: an animation that never ends (infinite, or never started) can't hold the element.
    await Promise.race([wait, sleep(Math.max(5000, 2 * (ms ?? 0)))])
    if (cancelled) return
    clear()
    hook(dir === 'enter' ? 'AfterEnter' : 'AfterLeave')?.(el, () => {})
  })()
  return {
    done,
    cancel() {
      if (cancelled) return
      cancelled = true
      clear()
      if (dir === 'enter') hook('EnterCancelled')?.(el, () => {})
    },
  }
}

/**
 * Make leaving nodes no longer the island's: their markers and data-cl-* attributes go (so the island's scans and a
 * re-wire can't find them), they can't be focused or clicked, and child islands that never attached stay unattached.
 */
function neutralise(nodes: Node[]): void {
  for (const node of nodes) {
    if (node.nodeType !== 1) continue
    const el = node as Element
    // The outer island's markers only: a child island's own (inside a <cl-island>) are its, and a running child still
    // updates its blocks during the leave. Its <cl-island> element is the outer island's, so its attributes go.
    const comments: Node[] = []
    const elements: Element[] = [el]
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT, {
      acceptNode: (n) => (n.nodeType === 8 ? NodeFilter.FILTER_ACCEPT : (elements.push(n as Element), (n as Element).localName === 'cl-island' ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP)),
    })
    for (let c = walker.nextNode(); c; c = walker.nextNode()) comments.push(c)
    for (const c of comments) c.parentNode!.removeChild(c)
    for (const e of elements) {
      for (const a of [...e.attributes]) if (a.name.startsWith('data-cl-') && a.name !== 'data-cl-ready' && a.name !== 'data-cl-error') e.removeAttribute(a.name)
      // The next insert would attach an island that hasn't yet (idle, visible, interaction): it's leaving.
      if (e.localName === 'cl-island' && !e.hasAttribute('data-cl-error')) e.setAttribute('data-cl-ready', '')
    }
    el.setAttribute('inert', '')
    el.setAttribute('aria-hidden', 'true')
  }
  reshaped()
}

/**
 * The @if block of `@transition (name, options) { @if … }`: as dom.ts's block(), with enter and leave transitions.
 * @internal Compiled components call this; apps don't.
 */
export function transitionBlock(ctx: Ctx, index: number, which: () => number, branches: Branch[], name: string, options?: TransitionOptions): void {
  const b = blocks(ctx)[index]
  if (!b) return
  const o = options ?? {}
  let current = b.k
  let live: Node[] = between(b.start, b.end)
  let dispose: (() => void) | null = null
  let alive = true
  let first = true
  let holding = false // out-in: an insert waits for the leave to end
  const entering = new Map<Element, () => void>()
  onDispose(() => { alive = false; dispose?.() })

  const enter = (nodes: Node[]) => Promise.all(targets(nodes).map((el) => {
    const r = run(el, 'enter', name, o)
    entering.set(el, r.cancel)
    return r.done.finally(() => entering.delete(el))
  }))
  const leave = (nodes: Node[]): Promise<unknown> => {
    // Text goes at once; elements leave, then go.
    for (const n of nodes) if (n.nodeType !== 1) n.parentNode?.removeChild(n)
    const elements = nodes.filter((n) => n.nodeType === 1) as Element[]
    return Promise.all(elements.map(async (top) => {
      const els = targets([top])
      for (const el of els) entering.get(el)?.()
      await Promise.all(els.map((el) => run(el, 'leave', name, o).done))
      const parent = top.parentNode
      top.remove()
      // Child islands that left are disposed by the loader's next pass over the page.
      const attach = (globalThis as { __clAttach?: (root: ParentNode) => void }).__clAttach
      if (attach && parent) attach(parent)
    }))
  }
  const insert = (k: number, animate = true): Promise<unknown> => {
    if (!alive || k < 0) return Promise.resolve()
    const { first: from, last } = insertHtml(branches[k]!.html(), b.end)
    live = from && last ? between(from.previousSibling ?? b.start, last.nextSibling ?? b.end) : []
    dispose = scope(() => branches[k]!.wire())
    return animate ? enter(live) : Promise.resolve()
  }

  effect(() => {
    const k = which()
    untrack(() => {
      if (first) {
        first = false
        // The browser's state picks another branch than the server rendered (HMR carrying state over, a state restored
        // in the browser): swapped at once, as block() does, then entered only with appear.
        if (k !== current) {
          for (const n of live) n.parentNode?.removeChild(n)
          reshaped()
          live = []
          current = k
          void insert(k, o.appear === true)
          return
        }
        if (k >= 0) {
          dispose = scope(() => branches[k]!.wire())
          if (o.appear) void enter(live)
        }
        return
      }
      if (k === current) return
      current = k
      // The old branch: unwired and neutralised now (two live copies would share marker numbers), animated out.
      dispose?.()
      dispose = null
      const old = live
      live = []
      neutralise(old)
      if (o.mode === 'out-in') {
        const leaving = leave(old)
        if (holding) return
        holding = true
        void leaving.then(() => { holding = false; void insert(current) })
      } else if (o.mode === 'in-out') {
        void insert(k).then(() => leave(old))
      } else {
        void leave(old)
        void insert(k)
      }
    })
  })
}
