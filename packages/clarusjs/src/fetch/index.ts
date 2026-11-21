// clarusjs/fetch: data an island fetches itself, in the browser. resource() runs a fetcher in an effect, so a fetcher
// that reads a signal (another resource's value, a state) runs again when it changes: requests chain through signals.
// The latest run wins (older runs are aborted and ignored), a disposed island aborts its run, and nothing is fetched
// on the server. batch() turns keys asked of one endpoint at the same moment into one request.
// @see https://clarusjs.com/guide/fetching
import { effect, onDispose, state, untrack } from '../runtime/index.ts'
import { browser } from '../runtime/env.ts'

/**
 * An island's fetched data. Its getters read signals, so a template that shows them updates on its own.
 * @see https://clarusjs.com/reference/fetch#resource
 */
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

/**
 * A fetcher's answer: a value, a promise of one, or undefined/null/false for "not ready" (a chain still waiting). An
 * async fetcher resolving to undefined is "not ready" too. Signals it reads before its first `await` are tracked.
 */
type Fetcher<T> = (ctx: { signal: AbortSignal }) => T | Promise<T> | undefined | null | false

/**
 * Runs `fetcher` in the browser and gives its answer as `value`, `loading` and `error`, which update an island's
 * template on their own. It runs again when a signal the fetcher reads changes (another resource's `value`, a
 * `state`), so requests chain; a falsy return means "not ready" (no request). The latest run wins; an island that
 * goes away aborts its run. On the server the fetcher never runs.
 *
 * @param fetcher Returns the value or a promise of it (it can be `async`); pass `signal` on to `fetch`. Signals it
 *   reads before its first `await` are the ones it follows.
 * @param options `initial` (a starting value), `retry`, `refetch: { interval, focus, onStart }`.
 * @returns A {@link Resource}: `value`, `loading`, `error`, `refetch()`, `mutate()`.
 * @example
 * ```ts
 * const team = resource(({ signal }) => json('/api/team', { signal }))
 * // A chain: waits for the team, and runs again when it changes.
 * const members = resource(({ signal }) => team.value && json(`/api/teams/${team.value.id}/members`, { signal }), {
 *   retry: 2,
 *   refetch: { interval: 30_000 },
 * })
 * ```
 * @see https://clarusjs.com/reference/fetch#resource
 */
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
  let busy = false // a run is in flight (quietly too): interval and focus skip
  let inFetcher = false // the fetcher is running: reading this resource there mustn't subscribe it to itself
  const retry = typeof options.retry === 'number' ? { count: options.retry } : options.retry ?? { count: 0 }
  const delay = retry.delay ?? ((attempt: number) => Math.min(500 * 2 ** (attempt - 1), 8000))

  const run = () => {
    tick.get()
    controller?.abort()
    const id = ++runs
    const c = (controller = new AbortController())
    let out: ReturnType<Fetcher<T>>
    inFetcher = true
    try { out = fetcher({ signal: c.signal }) } catch (err) { out = Promise.reject(err) } finally { inFetcher = false } // reads here are tracked
    pending = untrack(() => {
      const wasQuiet = quiet
      quiet = false
      if (out === undefined || out === null || out === false) {
        controller = undefined
        busy = false
        loading.set(false) // not ready: keep the last value
        return Promise.resolve()
      }
      error.set(undefined)
      if (!wasQuiet) loading.set(true)
      busy = true
      const latest = () => id === runs && !disposed
      // The first attempt is the tracked call above; retries call the fetcher again (untracked) after a delay.
      const attempt = async (n: number, first: unknown): Promise<T> => {
        try { return await (n === 0 ? first : fetcher({ signal: c.signal })) as T } catch (err) {
          if (n >= retry.count || c.signal.aborted) throw err
          await sleep(delay(n + 1), c.signal)
          return attempt(n + 1, undefined)
        }
      }
      return attempt(0, out).then(
        // An async fetcher can't return "not ready" directly: it resolves to undefined. Same meaning: keep the value.
        (v) => { if (latest()) { if (v !== undefined) value.set(v); loading.set(false); busy = false } },
        (err) => { if (latest()) { error.set(err); loading.set(false); busy = false } },
      )
    })
  }

  const timers: (() => void)[] = []
  const dispose = () => { disposed = true; stop?.(); controller?.abort(); for (const t of timers) t() }
  // Interval and focus refetches don't interrupt a run in flight (it's already fresh); only refetch() does.
  const again = () => { if (!busy && document.visibilityState !== 'hidden') void self.refetch() }
  if (browser) {
    onDispose(dispose)
    if (options.refetch?.onStart !== false) stop = effect(run)
    const { interval, focus } = options.refetch ?? {}
    if (interval) { const t = setInterval(again, interval); timers.push(() => clearInterval(t)) }
    if (focus) { document.addEventListener('visibilitychange', again); timers.push(() => document.removeEventListener('visibilitychange', again)) }
  }

  // Read inside its own fetcher (a guard on loading, a cursor from value): untracked, or its own writes would rerun it.
  const read = <V>(s: { get(): V }) => (inFetcher ? untrack(s.get) : s.get())
  const self: Resource<T> = {
    get value() { return read(value) },
    get loading() { return read(loading) },
    get error() { return read(error) },
    refetch() {
      if (!browser || disposed) return Promise.resolve()
      if (stop) tick.set(untrack(tick.get) + 1)
      else stop = effect(run) // the first run of a resource that didn't start on attach
      // Inside a signals batch() the run starts when the batch ends: wait for that, then for the run.
      return Promise.resolve().then(() => pending)
    },
    mutate(v) { if (browser) value.set(v) }, // on the server a (module-level) resource stays as it was
  }
  return self
}

/** Wait `ms`; rejects when `signal` aborts first. */
const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(t); reject(signal.reason) }
    const t = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, ms)
    signal.addEventListener('abort', abort, { once: true })
  })

/** Keys asked of one endpoint at the same moment, answered by one request. */
export type Batch<T> = { get(key: string): Promise<T> }

/**
 * One request for the keys asked at the same moment (the same task, or within `wait` ms), from the islands asking
 * then (islands attaching later, such as on idle or when visible, join with a longer `wait`):
 * `load(keys)` answers each key. Concurrent asks for a key share its request; nothing is kept after it settles.
 * `max` splits a large batch. Share it from a module (`export const stats = batch(…)`).
 *
 * @param load Fetches the answers for `keys`: an object with one entry per key.
 * @param options `wait` (ms to collect keys), `max` (keys per request).
 * @returns `{ get(key) }`: a promise of that key's answer.
 * @example
 * ```ts
 * // stores/stats.ts: every card on the page joins the same request
 * export const stats = batch((keys, { signal }) => json(`/api/stats?keys=${keys.join(',')}`, { signal }))
 * // in a card's script
 * const visits = resource(() => stats.get('visits'))
 * ```
 * @see https://clarusjs.com/reference/fetch#batch
 */
export function batch<T>(
  load: (keys: string[], ctx: { signal: AbortSignal }) => Record<string, T> | Promise<Record<string, T>>,
  options: { wait?: number; max?: number } = {},
): Batch<T> {
  type Waiting = { resolve(v: T): void; reject(e: unknown): void }
  let queued: Map<string, Waiting> | undefined
  const inFlight = new Map<string, Promise<T>>()
  const send = (keys: Map<string, Waiting>) => {
    // ponytail: a batch request isn't aborted when its callers go (others may wait on it); it runs to the end.
    const settle = (fn: (key: string, w: Waiting) => void) => { for (const [key, w] of keys) { inFlight.delete(key); fn(key, w) } }
    Promise.resolve()
      .then(() => load([...keys.keys()], { signal: new AbortController().signal }))
      .then(
        // Only the answer's own keys count; an answer that isn't an object (null, a forgotten return) answers none.
        (answers) => settle((key, w) => (answers !== null && typeof answers === 'object' && Object.hasOwn(answers, key) ? w.resolve(answers[key]!) : w.reject(new Error(`batch: no answer for "${key}"`)))),
        (err) => settle((_, w) => w.reject(err)),
      )
  }
  const flush = () => {
    const all = [...queued!]
    queued = undefined
    const max = Math.max(1, options.max ?? all.length)
    for (let i = 0; i < all.length; i += max) send(new Map(all.slice(i, i + max)))
  }
  return {
    get(key) {
      const pending = inFlight.get(key)
      if (pending) return pending
      if (!queued) {
        queued = new Map()
        // Until the current task ends by default: islands attach one after another (each after its own import),
        // in different microtasks of one task.
        setTimeout(flush, options.wait ?? 0)
      }
      let w!: Waiting
      const promise = new Promise<T>((resolve, reject) => { w = { resolve, reject } })
      queued.set(key, w)
      inFlight.set(key, promise)
      return promise
    },
  }
}

/**
 * `fetch(url, init)`, then the response's JSON. A response that isn't 2xx throws an Error naming the URL and status
 * (its `status` property holds the code), so a resource's `retry` and `error` see it.
 *
 * @example
 * ```ts
 * const me = resource(({ signal }) => json<User>('/api/me', { signal }))
 * ```
 * @see https://clarusjs.com/reference/fetch#json
 */
export async function json<T = any>(url: string | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    await res.text().catch(() => {}) // read it, so the request ends: a browser keeps an unread body's request open
    throw Object.assign(new Error(`${url}: ${res.status} ${res.statusText}`.trim()), { status: res.status })
  }
  return res.json() as Promise<T>
}
