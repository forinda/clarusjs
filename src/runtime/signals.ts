// Fine-grained reactivity used by compiled attach() functions. Browser only.

export type Signal<T> = { get(): T; set(v: T): void }
export type ReadSignal<T> = { get(): T }

type Effect = { run(): void; deps: Set<Set<Effect>>; active: boolean }

let current: Effect | null = null

export function state<T>(initial: T): Signal<T> {
  let value = initial
  const subs = new Set<Effect>()
  return {
    get() {
      if (current?.active) { subs.add(current); current.deps.add(subs) }
      return value
    },
    set(v) {
      if (Object.is(v, value)) return
      value = v
      for (const e of [...subs]) if (e.active) e.run() // an effect disposed earlier in this loop must not run
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
  return () => { e.active = false; for (const subs of e.deps) subs.delete(e); e.deps.clear() }
}

// ponytail: eager derived, may compute twice on diamond graphs; switch to push-pull (alien-signals style) when nested derived lands
export function derived<T>(fn: () => T): ReadSignal<T> {
  const s = state<T>(undefined as T)
  effect(() => s.set(fn()))
  return { get: s.get }
}
