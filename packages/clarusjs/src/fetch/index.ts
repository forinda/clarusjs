// clarusjs/fetch: data an island fetches itself, in the browser. resource() runs a fetcher in an effect, so a fetcher
// that reads a signal (another resource's value, a state) runs again when it changes: requests chain through signals.
// The latest run wins (older runs are aborted and ignored), a disposed island aborts its run, and nothing is fetched
// on the server. batch() turns keys asked of one endpoint at the same moment into one request.
// @see https://clarusjs.com/guide/fetching
import { effect, onDispose, state, untrack } from '../runtime/index.ts'
import { browser } from '../runtime/env.ts'

/** An island's fetched data. Its getters read signals, so a template that shows them updates on its own. */
export type Resource<T> = {
  /** The last successful answer (kept during a refetch and after an error), or `initial`. */
  readonly value: T | undefined
  /** A run is in flight. */
  readonly loading: boolean
  /** The last run's error, cleared when a run starts. */
  readonly error: unknown
  /** Run now, aborting a run in flight. */
  refetch(): Promise<void>
  /** Set the shown value (e.g. optimistically, before a POST); the next run overwrites it. */
  mutate(value: T): void
}

export type ResourceOptions<T> = {
  /** The starting value (from the page's load()): shown in server HTML and while the browser revalidates. */
  initial?: T
  /** Attempts after a failed one: a count, or a count and the delay before each (default 500 ms, doubling, ≤ 8 s). */
  retry?: number | { count: number; delay?(attempt: number): number }
  /**
   * When to run again: every `interval` ms while the page is visible; on `focus` (the page shown again). `onStart`
   * (default true): run on attach. With `onStart: false` the resource doesn't follow its signals until a first run.
   */
  refetch?: { interval?: number; focus?: boolean; onStart?: boolean }
}

/** A fetcher's answer: a value, a promise of one, or undefined/null/false for "not ready" (a chain still waiting). */
type Fetcher<T> = (ctx: { signal: AbortSignal }) => T | Promise<T> | undefined | null | false

export function resource<T>(fetcher: Fetcher<T>, options: ResourceOptions<T> = {}): Resource<T> {
  const value = state<T | undefined>(options.initial)
  const loading = state(!browser && options.initial === undefined)
  const error = state<unknown>(undefined)
  const tick = state(0) // refetch(): makes the effect run again, so the fetcher's signals are tracked anew
  let controller: AbortController | undefined
  let runs = 0
  let pending: Promise<void> = Promise.resolve()
  let stop: (() => void) | undefined
  let disposed = false
  let quiet = options.initial !== undefined // revalidating initial: no loading state for the first run

  const run = () => {
    tick.get()
    controller?.abort()
    const id = ++runs
    const c = (controller = new AbortController())
    let out: ReturnType<Fetcher<T>>
    try { out = fetcher({ signal: c.signal }) } catch (err) { out = Promise.reject(err) } // reads here are tracked
    pending = untrack(() => {
      const wasQuiet = quiet
      quiet = false
      if (out === undefined || out === null || out === false) {
        controller = undefined
        loading.set(false) // not ready: keep the last value
        return Promise.resolve()
      }
      error.set(undefined)
      if (!wasQuiet) loading.set(true)
      const latest = () => id === runs && !disposed
      return Promise.resolve(out).then(
        (v) => { if (latest()) { value.set(v); loading.set(false) } },
        (err) => { if (latest()) { error.set(err); loading.set(false) } },
      )
    })
  }

  const dispose = () => { disposed = true; stop?.(); controller?.abort() }
  if (browser) {
    onDispose(dispose)
    if (options.refetch?.onStart !== false) stop = effect(run)
  }

  return {
    get value() { return value.get() },
    get loading() { return loading.get() },
    get error() { return error.get() },
    refetch() {
      if (!browser || disposed) return Promise.resolve()
      if (stop) tick.set(untrack(tick.get) + 1)
      else stop = effect(run) // the first run of a resource that didn't start on attach
      return pending
    },
    mutate(v) { value.set(v) },
  }
}
