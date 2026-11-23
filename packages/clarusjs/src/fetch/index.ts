// clarusjs/fetch: data an island fetches itself, in the browser. resource() runs a fetcher in an effect, so a fetcher
// that reads a signal (another resource's value, a state) runs again when it changes: requests chain through signals.
// The latest run wins (older runs are aborted and ignored), a disposed island aborts its run, and nothing is fetched
// on the server. batch() turns keys asked of one endpoint at the same moment into one request.
// @see https://clarusjs.com/guide/fetching
import { batch as group, effect, onDispose, state, untrack } from '../runtime/index.ts'
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
  /** Cancel the run in flight: back to idle, the value kept, no error and no callbacks (a cancel isn't a failure). */
  abort(): void
  /** Set the shown value (e.g. optimistically, before a POST); the next run overwrites it. Keyed: its cache entry. */
  mutate(value: T): void
  /** The first answer (`value`), or the first run's error. On the server, `initial`. In handlers, not top level. */
  ready(): Promise<T | undefined>
}

/**
 * `resource()`'s options: a starting value, retry, refetch, and (with `key`) caching.
 * @see https://clarusjs.com/reference/fetch#resource
 */
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
  /** Cache answers by this key (`['items', { page }]`), page-wide: seen keys need no request until invalidated. */
  key?: () => unknown[] | undefined | null | false
  /** With `key`: refetch cached answers older than this (ms). Unset: fresh until invalidated. */
  stale?: number
  /** With `key`: keep an unshown answer this long (ms, default 5 min). */
  keep?: number
  /** Fail a run (retries included) after this many ms, with a `TimeoutError`: an error, unlike `abort()`. */
  timeout?: number
} & Callbacks<T>

/**
 * What happens after a request settles, once per request (an event, so the same error twice is two calls; an effect
 * on `error` is for state). A cancel calls none of them; with `retry`, after the last attempt. Browser only.
 * @see https://clarusjs.com/guide/fetching#errors
 */
export type Callbacks<T> = {
  /** It succeeded. Return `false` to skip `configure()`'s `onSuccess`. */
  onSuccess?(value: T): unknown
  /** It failed (a timeout too). Return `false` to skip `configure()`'s `onError` (handled here). */
  onError?(error: unknown): unknown
  /** After either, last: `(value, undefined)` or `(undefined, error)`. */
  onSettled?(value: T | undefined, error: unknown): unknown
  /** Anything for `configure()`'s handlers: `{ success: 'Saved' }`, `{ silent: true }`. */
  meta?: Record<string, unknown>
}

/**
 * Handlers for every resource and action on the page, after their own callbacks: toasts in one place.
 * @see https://clarusjs.com/reference/fetch#configure
 */
export type Handlers = {
  onSuccess?(value: unknown, ctx: { meta: Record<string, unknown> | undefined }): void
  onError?(error: unknown, ctx: { meta: Record<string, unknown> | undefined }): void
}
let handlers: Handlers = {}

/**
 * Set the handlers every resource and action calls after its own callbacks (one place for toasts); replaces the
 * previous ones. An instance's `meta` reaches them; its own callback returning `false` skips them.
 * @example
 * ```ts
 * configure({
 *   onError: (e, { meta }) => { if (!meta?.silent) toast.error(String(e)) },
 *   onSuccess: (_, { meta }) => { if (meta?.success) toast(String(meta.success)) },
 * })
 * ```
 * @see https://clarusjs.com/reference/fetch#configure
 */
export function configure(next: Handlers): void {
  handlers = next
}

/** A callback that throws is reported (like an uncaught error), and changes nothing. */
const call = (fn: ((...a: any[]) => unknown) | undefined, ...args: unknown[]): unknown => {
  // Browsers: reportError (a window 'error' event, as uncaught; error trackers see it). Elsewhere: the console.
  try { return fn?.(...args) } catch (err) { (globalThis.reportError ?? console.error)(err) }
}
/** A settled request: the instance's callbacks, then the global handlers unless the instance said `false`. */
const settled = <T>(o: Callbacks<T>, ok: boolean, value: unknown, err: unknown): void => {
  const ctx = { meta: o.meta }
  if (ok) { if (call(o.onSuccess, value) !== false) call(handlers.onSuccess, value, ctx) }
  else if (call(o.onError, err) !== false) call(handlers.onError, err, ctx)
  call(o.onSettled, ok ? value : undefined, ok ? undefined : err)
}

/** `signal`, also aborted after `ms` with a `TimeoutError`. */
const within = (signal: AbortSignal, ms: number | undefined) => (ms === undefined ? signal : AbortSignal.any([signal, AbortSignal.timeout(ms)]))

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

  const keyed = browser && !!options.key
  let entry: Entry | undefined // the cache entry this (keyed) resource shows
  let force = false // refetch(): fetch even when the cache has a fresh answer
  const user: User = {
    keep: options.keep ?? KEEP,
    push: (v) => { if (!disposed) value.set(v as T) }, // answers reach a keyed resource only through its entry
    rerun: () => { if (stop) tick.set(untrack(tick.get) + 1) }, // invalidated: run again (a miss), not forced
  }
  const join = (e?: Entry) => {
    if (e === entry) return
    if (entry) { entry.users.delete(user); release(entry, user) }
    entry = e
    if (e) { e.users.add(user); clearTimeout(e.drop) }
  }
  if (keyed && options.initial !== undefined) {
    try {
      const k = untrack(options.key!)
      if (k) { const e = entryOf(k); if (!e.has) store(e, options.initial, e.seq) } // seeded as fresh: no request
    } catch {} // a key that throws is an error on the first run
  }

  const run = () => {
    tick.get()
    const forced = force
    force = false
    controller?.abort()
    const id = ++runs
    const c = (controller = new AbortController())
    const signal = within(c.signal, options.timeout)
    let state: 'not ready' | 'hit' | 'fetch' = 'fetch'
    let out: unknown // the fetcher's answer (unkeyed), the entry's request (keyed), or a cached value (a hit)
    inFetcher = true
    try {
      if (keyed) {
        const k = options.key!()
        if (!k) state = 'not ready'
        else {
          const e = entryOf(k)
          join(e)
          if (!forced && e.has && !e.invalid && (options.stale === undefined || Date.now() - e.at < options.stale)) {
            state = 'hit'
            out = e.value
          } else if (!forced && e.pending) out = e.pending // the same key asked at the same time: one request
          else {
            // ponytail: own signal, so it (and its retries) ends even if this resource goes; abort if nobody awaits.
            const rs = within(new AbortController().signal, options.timeout)
            const first = fetcher({ signal: rs }) // reads here are tracked
            if (first === undefined || first === null || first === false) state = 'not ready'
            else out = track(e, retrying(first, () => fetcher({ signal: rs }), rs))
          }
        }
        if (state === 'not ready') join(undefined)
      } else {
        out = fetcher({ signal }) // reads here are tracked
        if (out === undefined || out === null || out === false) state = 'not ready'
      }
    } catch (err) { out = Promise.reject(err); state = 'fetch' } finally { inFetcher = false }
    pending = untrack(() => {
      const wasQuiet = quiet
      quiet = false
      if (state !== 'fetch') {
        controller = undefined
        busy = false
        if (state === 'hit') { value.set(out as T); error.set(undefined) }
        loading.set(false) // not ready: keep the last value
        return Promise.resolve()
      }
      error.set(undefined)
      if (!wasQuiet) loading.set(true)
      busy = true
      const latest = () => id === runs && !disposed
      // Keyed answers arrive through the entry (store → push), only if still its newest.
      return (keyed ? (out as Promise<T>) : retrying(out, () => fetcher({ signal }), signal)).then(
        // An async "not ready" resolves to undefined: keep the value.
        (v) => { if (latest()) { if (!keyed && v !== undefined) value.set(v); loading.set(false); busy = false; if (v !== undefined) settled(options, true, v, undefined) } },
        (err) => { if (latest()) { error.set(err); loading.set(false); busy = false; settled(options, false, undefined, err) } },
      )
    })
  }

  function retrying(first: unknown, again: () => unknown, signal: AbortSignal): Promise<T> {
    const attempt = async (n: number): Promise<T> => {
      try { return await (n === 0 ? first : again()) as T } catch (err) {
        if (n >= retry.count || signal.aborted) throw err
        await sleep(delay(n + 1), signal)
        return attempt(n + 1)
      }
    }
    return attempt(0)
  }

  const timers: (() => void)[] = []
  const dispose = () => { disposed = true; stop?.(); controller?.abort(); for (const t of timers) t(); join(undefined) }
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
      force = true
      if (stop) tick.set(untrack(tick.get) + 1)
      else stop = effect(run) // the first run of a resource that didn't start on attach
      // Inside a signals batch() the run starts when the batch ends: wait for that, then for the run.
      return Promise.resolve().then(() => pending)
    },
    abort() {
      if (!controller) return
      runs++ // its answer, or its abort, is no longer this resource's
      controller.abort()
      controller = undefined
      busy = false
      loading.set(false)
    },
    // Server: unchanged. Keyed: writes the entry.
    mutate(v) { if (browser) { if (entry) store(entry, v, ++entry.seq); else value.set(v) } },
    async ready() {
      for (let p; p !== pending; ) { p = pending; await p } // until no newer run started meanwhile
      const v = untrack(value.get)
      if (v === undefined && untrack(error.get) !== undefined) throw untrack(error.get)
      return v
    },
  }
  return self
}

// The keyed cache (#287): one entry per key, shared by every resource on the page. In the browser only.
type User = { keep: number; push(v: unknown): void; rerun(): void }
type Entry = {
  key: unknown[]; value?: unknown; has: boolean; at: number; invalid: boolean
  seq: number // bumped by each request, invalidate(), setData() and mutate(): only the newest answer is stored
  pending?: Promise<unknown>; users: Set<User>; keep?: number; drop?: ReturnType<typeof setTimeout>
}
const KEEP = 5 * 60_000
const cache = new Map<string, Entry>()
/**
 * A key's hash: JSON with object keys sorted, so { page, q } and { q, page } are one key. Keys are plain values:
 * like JSON, undefined properties drop out, and Maps and Sets are all `{}`.
 */
const hash = (v: unknown) => JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : x))
const entryOf = (key: unknown[]): Entry => {
  const h = hash(key)
  let e = cache.get(h)
  if (!e) cache.set(h, (e = { key, has: false, at: 0, invalid: false, seq: 0, users: new Set() }))
  return e
}
/** Nothing (else) shows `e`: drop it after its users' keep (the one leaving, if it was the last) unless one comes back. */
const release = (e: Entry, leaving?: User) => {
  e.keep = e.users.size ? Math.max(...[...e.users].map((u) => u.keep)) : leaving?.keep ?? e.keep
  if (e.users.size) return
  clearTimeout(e.drop)
  e.drop = setTimeout(() => { if (!e.users.size) cache.delete(hash(e.key)) }, e.keep ?? KEEP)
}
/** Store an answer if it's still the entry's newest (no later request, invalidate or setData), and show it. */
const store = (e: Entry, v: unknown, seq: number) => {
  if (seq !== e.seq) return
  Object.assign(e, { value: v, has: true, at: Date.now(), invalid: false })
  for (const u of e.users) u.push(v)
}
/** The entry's newest request: stores what it gets (if still newest). */
const track = <T>(e: Entry, answer: Promise<T>): Promise<T> => {
  const seq = ++e.seq
  const p = answer.then((v) => { if (v !== undefined) store(e, v, seq); return v })
  e.pending = p
  const clear = () => { if (e.pending === p) e.pending = undefined }
  p.then(clear, clear)
  return p
}

/**
 * Mark every cached answer whose key starts with `prefix` (element by element) as stale: the resources showing one
 * fetch it again now, the others when next used. With no prefix: everything.
 * @example
 * ```ts
 * await fetch(`/api/items/${id}`, { method: 'PATCH', body })
 * invalidate(['items']) // every cached page of items
 * ```
 * @see https://clarusjs.com/reference/fetch#invalidate
 */
export function invalidate(prefix: unknown[] = []): void {
  if (!browser) return
  const parts = prefix.map(hash)
  group(() => {
    for (const e of cache.values()) {
      if (!parts.every((p, i) => i < e.key.length && hash(e.key[i]) === p)) continue
      e.seq++ // an answer already on its way is stale
      e.pending = undefined
      e.invalid = true
      for (const u of e.users) u.rerun() // the first starts one request; the others share it
    }
  })
}

/**
 * Set a cached answer (an optimistic edit) and show it in every resource using that key; creates it if missing.
 * @example
 * ```ts
 * setData(['items', { page }], (rows) => rows.map((r) => (r.id === id ? { ...r, name } : r)))
 * ```
 * @see https://clarusjs.com/reference/fetch#setdata
 */
export function setData<T>(key: unknown[], value: T | ((prev: T | undefined) => T)): void {
  if (!browser) return
  const e = entryOf(key)
  store(e, typeof value === 'function' ? (value as (prev: T | undefined) => T)(e.value as T | undefined) : value, ++e.seq)
  release(e)
}

/**
 * Fetch an answer into the cache ahead of time (the next page), unless it's there and fresh. Errors are ignored.
 * @example
 * ```ts
 * prefetch(['items', { page: page + 1 }], ({ signal }) => json(`/api/items?page=${page + 1}`, { signal }))
 * ```
 * @see https://clarusjs.com/reference/fetch#prefetch
 */
export function prefetch<T>(key: unknown[], fetcher: (ctx: { signal: AbortSignal }) => T | Promise<T>): Promise<void> {
  if (!browser) return Promise.resolve()
  const e = entryOf(key)
  const p = e.has && !e.invalid ? Promise.resolve() : e.pending ?? track(e, (async () => fetcher({ signal: new AbortController().signal }))())
  release(e)
  return p.then(() => {}, () => {})
}

/** Wait `ms`; rejects when `signal` aborts first. */
const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(t); reject(signal.reason) }
    const t = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, ms)
    signal.addEventListener('abort', abort, { once: true })
  })

/**
 * Keys asked of one endpoint at the same moment, answered by one request: what `batch()` gives.
 * @see https://clarusjs.com/reference/fetch#batch
 */
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
 * What `request()` reads from a response: by default from its `Content-Type` (JSON for `application/json` and
 * `+json` types, text for `text/*` and XML, else a Blob; nothing for a 204), or as `as` says.
 * @see https://clarusjs.com/reference/fetch#request
 */
export type ReadAs = 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData' | 'response' | 'stream'

/**
 * `request()`'s options: `fetch`'s, plus `body` (a plain object or array is sent as JSON), `as`, `parse` and `timeout`.
 * @see https://clarusjs.com/reference/fetch#request
 */
export type RequestOptions = Omit<RequestInit, 'body'> & {
  /** What `fetch` takes, or a plain object or array: sent as JSON, with `Content-Type: application/json` unless set. */
  body?: BodyInit | Record<string, unknown> | unknown[] | null
  /** What to read from the response; by default its `Content-Type` decides. */
  as?: ReadAs
  /** Your own reader per content type (`'application/x-ndjson'`, without parameters), ahead of the built-in ones. */
  parse?: Record<string, (res: Response) => unknown>
  /** Abort after this many ms, with a `TimeoutError` (on top of `signal`). */
  timeout?: number
}

/**
 * The error a non-2xx response throws: its `status`, and its body read like a success's (`data`).
 * @see https://clarusjs.com/reference/fetch#request
 */
export type ResponseError = Error & { status: number; data: unknown }

const read = (res: Response, as: ReadAs | undefined, parse: RequestOptions['parse']): unknown => {
  const type = res.headers.get('content-type')?.split(';')[0]!.trim().toLowerCase() ?? ''
  const own = parse?.[type]
  if (own) return own(res)
  if (as === 'response') return res
  if (as === 'stream') return res.body
  if (as) return res[as]()
  if (res.status === 204) return undefined
  if (type === 'application/json' || type.endsWith('+json')) return res.json()
  return type.startsWith('text/') || type.endsWith('xml') ? res.text() : res.blob()
}

/**
 * `fetch`, then the response read by its `Content-Type` (or as `as` says). A response that isn't 2xx throws an Error
 * naming the URL and status, with `status` and the error body (`data`), so a resource's `retry` and `error` see it.
 *
 * @param options `fetch`'s options, plus `body` (a plain object or array goes as JSON), `as`, `parse`, `timeout`.
 * @example
 * ```ts
 * const csv = await request<string>('/api/export', { as: 'text', timeout: 10_000 })
 * await request(`/api/posts/${id}`, { method: 'PATCH', body: { title } })
 * ```
 * @see https://clarusjs.com/reference/fetch#request
 */
export async function request<T = any>(url: string | URL, options: RequestOptions = {}): Promise<T> {
  const { as, parse, timeout, body, ...init } = options
  if (body !== undefined) {
    const plain = body !== null && typeof body === 'object' && (Array.isArray(body) || [Object.prototype, null].includes(Object.getPrototypeOf(body)))
    if (plain) {
      const headers = new Headers(init.headers)
      if (!headers.has('content-type')) headers.set('content-type', 'application/json')
      Object.assign(init, { body: JSON.stringify(body), headers })
    } else (init as RequestInit).body = body as BodyInit | null
  }
  if (timeout !== undefined) init.signal = AbortSignal.any([AbortSignal.timeout(timeout), ...(init.signal ? [init.signal] : [])])
  const res = await fetch(url, init as RequestInit)
  if (!res.ok) {
    // Read it (so the request ends: a browser keeps an unread body's request open), and keep it: a 422's errors.
    const data = await Promise.resolve(read(res, as === 'response' || as === 'stream' ? 'text' : undefined, parse)).catch(() => undefined)
    throw Object.assign(new Error(`${url}: ${res.status} ${res.statusText}`.trim()), { status: res.status, data })
  }
  return read(res, as, parse) as T
}

/**
 * `request()` reading JSON whatever the `Content-Type`. A non-2xx response throws (with `status` and `data`).
 * @example
 * ```ts
 * const me = resource(({ signal }) => json<User>('/api/me', { signal }))
 * ```
 * @see https://clarusjs.com/reference/fetch#json
 */
export const json = <T = any>(url: string | URL, options?: RequestOptions): Promise<T> => request<T>(url, { ...options, as: 'json' })

/**
 * `request()` reading text whatever the `Content-Type`. A non-2xx response throws (with `status` and `data`).
 * @example
 * ```ts
 * const readme = resource(({ signal }) => text('/README.md', { signal }))
 * ```
 * @see https://clarusjs.com/reference/fetch#text
 */
export const text = (url: string | URL, options?: RequestOptions): Promise<string> => request<string>(url, { ...options, as: 'text' })
