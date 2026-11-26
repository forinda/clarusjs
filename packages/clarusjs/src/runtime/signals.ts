// Fine-grained reactivity used by compiled attach() functions. Browser only.

/**
 * A value that can change, and the code that reads it runs again: `get()`, `set(value)`, and the value it started with.
 * In an island's script you read and write a `state()` as a plain variable; in a `.ts` module, through these.
 * @see https://clarusjs.com/reference/runtime#state
 */
export type Signal<T> = { get(): T; set(v: T): void; readonly initial: T }
/**
 * A value to read, not write: what `derived()` gives.
 * @see https://clarusjs.com/reference/runtime#derived
 */
export type ReadSignal<T> = { get(): T }

type Effect = { run(): void; deps: Set<Set<Effect>>; active: boolean }

let current: Effect | null = null
// Cleanups registered while a scope() is running: effect stops, event listener removals, child scopes.
let currentScope: (() => void)[] | null = null

/**
 * Run `fn`; everything it creates (effects, onDispose cleanups, nested scopes) is undone by the returned dispose. An
 * island's script already runs in one, disposed when the island leaves the page.
 * @example
 * ```ts
 * const stop = scope(() => {
 *   effect(() => console.log(count.get()))
 * })
 * stop() // the effect stops
 * ```
 * @see https://clarusjs.com/reference/runtime#scope
 */
export function scope(fn: () => void): () => void {
  const prev = currentScope
  const cleanups: (() => void)[] = []
  currentScope = cleanups
  // The outermost scope is a wiring pass: what waits for it runs at its end.
  const outer = !after
  if (outer) after = []
  let wired = false
  try {
    fn()
    wired = true
  } finally {
    currentScope = prev
    if (outer) {
      const waiting = after!
      after = null
      if (wired) for (const run of waiting) run()
    }
  }
  const dispose = () => { for (const c of cleanups.splice(0).reverse()) c() }
  onDispose(dispose)
  return dispose
}

// What waits for the wiring pass that's running (null when none is).
let after: (() => void)[] | null = null

/** Run `fn` when the wiring pass ends (now if none), in the scope it was asked from (#550). @internal */
export function afterWiring(fn: () => void): void {
  if (!after) return fn()
  const owner = currentScope
  after.push(() => {
    const prev = currentScope
    currentScope = owner
    try { fn() } finally { currentScope = prev }
  })
}

/**
 * Run `fn` when the enclosing scope is disposed (an island leaving the page, an @if branch or @for row going away).
 * Outside a scope it does nothing.
 * @example
 * ```ts
 * if (browser) {
 *   const onResize = () => (width = innerWidth)
 *   addEventListener('resize', onResize)
 *   onDispose(() => removeEventListener('resize', onResize))
 * }
 * ```
 * @see https://clarusjs.com/reference/runtime#ondispose
 */
export function onDispose(fn: () => void): void {
  currentScope?.push(fn)
}

/**
 * Read signals without making the running effect (or template expression) depend on them: it doesn't run again
 * when they change.
 * @example
 * ```ts
 * effect(() => {
 *   log(query.get(), untrack(() => page.get())) // runs again when query changes, not page
 * })
 * ```
 * @see https://clarusjs.com/reference/runtime#untrack
 */
export function untrack<T>(fn: () => T): T {
  const prev = current
  current = null
  try { return fn() } finally { current = prev }
}

// Effects waiting for the current batch to end (null outside a batch).
let queue: Set<Effect> | null = null

/**
 * Run `fn`, then the effects its writes affect, once each: they never see some of its writes without the others.
 * @example
 * ```ts
 * batch(() => {
 *   first.set('Ada')
 *   last.set('Lovelace')
 * }) // an effect reading both runs once, with both names
 * ```
 * @see https://clarusjs.com/reference/runtime#batch
 */
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

/**
 * A reactive value: what reads it (the template, an effect, a derived value) updates when it changes. In an island's
 * script, `let count = state(0)` is read and written as a plain variable (`count++`); in a `.ts` module (a store),
 * through `get()` and `set()`.
 * @example
 * ```ts
 * // stores/cart.ts
 * export const items = state<string[]>([])
 * export const add = (item: string) => items.set([...items.get(), item])
 * ```
 * @see https://clarusjs.com/reference/runtime#state
 */
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

/**
 * Run `fn` now and again whenever a signal it read changes. Returns a function that stops it; in an island it stops
 * when the island leaves the page.
 * @example
 * ```ts
 * effect(() => {
 *   document.title = `${count.get()} new messages`
 * })
 * ```
 * @see https://clarusjs.com/reference/runtime#effect
 */
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
/**
 * A value computed from other signals, kept up to date as they change. Read-only. In an island's script it reads as
 * a plain variable.
 * @example
 * ```ts
 * let price = state(20)
 * let quantity = state(3)
 * const total = derived(() => price * quantity) // 60, then follows both
 * ```
 * @see https://clarusjs.com/reference/runtime#derived
 */
export function derived<T>(fn: () => T): ReadSignal<T> {
  const s = state<T>(undefined as T)
  effect(() => s.set(fn()))
  return { get: s.get }
}

/**
 * Use a store (a module-level `state()`) in an island: `let items = shared(todos)` makes `items` read and write the
 * store, so every island using it stays in sync. On the server it renders the store's initial value.
 * @example
 * ```ts
 * import { todos } from '../stores/todos.ts'
 * let items = shared(todos)
 * function add(text) { items = [...items, text] } // every island showing todos updates
 * ```
 * @see https://clarusjs.com/reference/runtime#shared
 */
export function shared<T>(store: Signal<T>): Signal<T> {
  return store
}
