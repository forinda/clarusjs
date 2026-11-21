// Fine-grained reactivity used by compiled attach() functions. Browser only.

export type Signal<T> = { get(): T; set(v: T): void; readonly initial: T }
export type ReadSignal<T> = { get(): T }

type Effect = { run(): void; deps: Set<Set<Effect>>; active: boolean }

let current: Effect | null = null
// Cleanups registered while a scope() is running: effect stops, event listener removals, child scopes.
let currentScope: (() => void)[] | null = null

/** Run `fn`; everything it creates (effects, onDispose cleanups, nested scopes) is undone by the returned dispose. */
export function scope(fn: () => void): () => void {
  const prev = currentScope
  const cleanups: (() => void)[] = []
  currentScope = cleanups
  try { fn() } finally { currentScope = prev }
  const dispose = () => { for (const c of cleanups.splice(0).reverse()) c() }
  onDispose(dispose)
  return dispose
}

/** Register a cleanup with the enclosing scope (no-op outside one). */
export function onDispose(fn: () => void): void {
  currentScope?.push(fn)
}

/** Read signals without subscribing the running effect to them. */
export function untrack<T>(fn: () => T): T {
  const prev = current
  current = null
  try { return fn() } finally { current = prev }
}

// Effects waiting for the current batch to end (null outside a batch).
let queue: Set<Effect> | null = null

/** Run `fn`, then the effects its writes affect, once each: they never see some of its writes without the others. */
export function batch(fn: () => void): void {
  if (queue) return fn()
  queue = new Set()
  try {
    fn()
  } finally {
    const waiting = queue
    queue = null
    for (const e of waiting) if (e.active) e.run()
  }
}

export function state<T>(initial: T): Signal<T> {
  let value = initial
  const subs = new Set<Effect>()
  return {
    initial, // what the server renders for a shared store: never a value another request set
    get() {
      if (current?.active) { subs.add(current); current.deps.add(subs) }
      return value
    },
    set(v) {
      if (Object.is(v, value)) return
      value = v
      if (queue) for (const e of subs) queue.add(e) // in a batch: run once it ends
      else for (const e of [...subs]) if (e.active) e.run() // an effect disposed earlier in this loop must not run
    },
  }
}

export function effect(fn: () => void): () => void {
  const e: Effect = {
    deps: new Set(),
    active: true,
    run() {
      if (!e.active) return
      for (const subs of e.deps) subs.delete(e)
      e.deps.clear()
      const prev = current
      current = e
      try { fn() } finally { current = prev }
    },
  }
  e.run()
  const stop = () => { e.active = false; for (const subs of e.deps) subs.delete(e); e.deps.clear() }
  onDispose(stop)
  return stop
}

// ponytail: eager derived, may compute twice on diamond graphs; switch to push-pull (alien-signals style) when nested derived lands
export function derived<T>(fn: () => T): ReadSignal<T> {
  const s = state<T>(undefined as T)
  effect(() => s.set(fn()))
  return { get: s.get }
}

/**
 * Use a store (a module-level `state()`) in an island: `let items = shared(todos)` makes `items` read and write the
 * store, so every island using it stays in sync. On the server it renders the store's initial value.
 */
export function shared<T>(store: Signal<T>): Signal<T> {
  return store
}
