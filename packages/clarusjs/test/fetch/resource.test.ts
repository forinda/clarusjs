// @vitest-environment happy-dom
// #258: resource(): an island's fetched data, with chains through signals, latest-wins and cleanup.
import { expect, test, vi } from 'vitest'
import { resource } from '../../src/fetch/index.ts'
import { scope, state } from '../../src/runtime/index.ts'
import { deferred, flush } from './helpers.ts'

test('runs on attach: loading, then value', async () => {
  const r = resource(() => Promise.resolve(42))
  expect(r.loading).toBe(true)
  expect(r.value).toBeUndefined()
  await flush()
  expect(r).toMatchObject({ value: 42, loading: false, error: undefined })
})

test('re-runs when a signal it reads changes (chains)', async () => {
  const id = state(1)
  const fetcher = vi.fn(({}: { signal: AbortSignal }) => Promise.resolve(id.get() * 10))
  const r = resource(fetcher)
  await flush()
  expect(r.value).toBe(10)
  id.set(2)
  await flush()
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(r.value).toBe(20)
})

test('a stale run\'s result is ignored, and the old run is aborted', async () => {
  const id = state(1)
  const runs = [deferred<string>(), deferred<string>()]
  const signals: AbortSignal[] = []
  const r = resource(({ signal }) => { signals.push(signal); return runs[id.get() - 1]!.promise })
  id.set(2)
  expect(signals[0]!.aborted).toBe(true)
  runs[1]!.resolve('second')
  await flush()
  runs[0]!.resolve('first')
  await flush()
  expect(r.value).toBe('second')
})

test('a falsy fetcher result is "not ready": no request; an in-flight run is aborted and the last value kept', async () => {
  const id = state<number | undefined>(1)
  const second = deferred<number>()
  const signals: AbortSignal[] = []
  const r = resource(({ signal }) => {
    const v = id.get()
    if (v === undefined) return undefined
    signals.push(signal)
    return v === 1 ? Promise.resolve(1) : second.promise
  })
  await flush()
  expect(r.value).toBe(1)
  id.set(2)
  expect(r.loading).toBe(true)
  id.set(undefined)
  expect(signals[1]!.aborted).toBe(true)
  expect(r).toMatchObject({ value: 1, loading: false })
  second.resolve(2)
  await flush()
  expect(r.value).toBe(1)
})

test('errors (thrown or rejected) become error; value keeps the last success', async () => {
  const mode = state<'ok' | 'throw' | 'reject'>('ok')
  const r = resource(() => {
    if (mode.get() === 'throw') throw new TypeError('sync')
    return mode.get() === 'reject' ? Promise.reject(new Error('async')) : Promise.resolve('fine')
  })
  await flush()
  mode.set('throw')
  await flush()
  expect(r.error).toBeInstanceOf(TypeError)
  expect(r).toMatchObject({ value: 'fine', loading: false })
  mode.set('reject')
  await flush()
  expect((r.error as Error).message).toBe('async')
  mode.set('ok')
  expect(r.error).toBeUndefined() // cleared when a run starts
})

test('refetch() runs now and aborts an in-flight run', async () => {
  const signals: AbortSignal[] = []
  let n = 0
  const first = deferred<number>()
  const r = resource(({ signal }) => { signals.push(signal); return n++ === 0 ? first.promise : Promise.resolve(n) })
  const done = r.refetch()
  expect(signals[0]!.aborted).toBe(true)
  await done
  expect(r.value).toBe(2)
  first.resolve(1)
  await flush()
  expect(r.value).toBe(2)
})

test('mutate(v) sets value; a later run overwrites it', async () => {
  const r = resource(() => Promise.resolve('server'))
  await flush()
  r.mutate('optimistic')
  expect(r.value).toBe('optimistic')
  await r.refetch()
  expect(r.value).toBe('server')
})

test('initial: shown at once, then revalidated in the browser', async () => {
  const fetcher = vi.fn(() => Promise.resolve('fresh'))
  const r = resource(fetcher, { initial: 'from load' })
  expect(r).toMatchObject({ value: 'from load', loading: false })
  expect(fetcher).toHaveBeenCalledTimes(1)
  await flush()
  expect(r.value).toBe('fresh')
})

test('refetch.onStart: false: no run on attach; refetch() runs it and then it follows its signals', async () => {
  const id = state(1)
  const fetcher = vi.fn(() => Promise.resolve(id.get()))
  const r = resource(fetcher, { initial: 0, refetch: { onStart: false } })
  await flush()
  expect(fetcher).not.toHaveBeenCalled()
  expect(r.value).toBe(0)
  await r.refetch()
  expect(r.value).toBe(1)
  id.set(2)
  await flush()
  expect(r.value).toBe(2)
})

test('disposed with its island: in-flight run aborted, no later run', async () => {
  const id = state(1)
  const signals: AbortSignal[] = []
  const fetcher = vi.fn(({ signal }: { signal: AbortSignal }) => { signals.push(signal); id.get(); return new Promise(() => {}) })
  const dispose = scope(() => { resource(fetcher) })
  dispose()
  expect(signals[0]!.aborted).toBe(true)
  id.set(2)
  expect(fetcher).toHaveBeenCalledTimes(1)
})

test('disposed with its island after a lazy start (onStart: false): its signals no longer run it', async () => {
  const id = state(1)
  const fetcher = vi.fn(() => Promise.resolve(id.get()))
  let r!: ReturnType<typeof resource<number>>
  const dispose = scope(() => { r = resource(fetcher, { refetch: { onStart: false } }) })
  await r.refetch() // outside the island's scope, as a click handler would be
  dispose()
  id.set(2)
  expect(fetcher).toHaveBeenCalledTimes(1)
})

test('async fetchers: await inside works; resolving to undefined is "not ready" (the last value is kept)', async () => {
  const team = state<{ id: number } | undefined>({ id: 1 })
  const r = resource(async ({ signal }) => {
    const t = team.get() // read before the first await: tracked
    if (!t) return undefined
    await Promise.resolve(signal)
    return `members of ${t.id}`
  })
  await flush()
  expect(r.value).toBe('members of 1')
  team.set(undefined)
  await flush()
  expect(r).toMatchObject({ value: 'members of 1', loading: false })
  team.set({ id: 2 })
  await flush()
  expect(r.value).toBe('members of 2')
})

test('review: a synchronous throw before any await becomes error, with no uncaught exception', async () => {
  const r = resource((): Promise<number> => { throw new RangeError('bad id') })
  await flush()
  expect(r.error).toBeInstanceOf(RangeError)
  expect(r.loading).toBe(false)
})

test('review: a fetcher reading its own resource doesn\'t loop (a guard on loading, a cursor from value)', async () => {
  // Declared first: the first run happens inside resource(), before a const would be assigned.
  let calls = 0
  let guarded: ReturnType<typeof resource<number>> | undefined
  guarded = resource(() => { calls++; if (guarded?.loading) return undefined; return Promise.resolve(1) })
  await flush()
  expect(calls).toBe(1)
  let pages = 0
  let list: ReturnType<typeof resource<number[]>> | undefined
  list = resource(() => { pages++; return Promise.resolve([...(list?.value ?? []), pages]) })
  await flush()
  await flush()
  expect(pages).toBe(1)
  expect(list!.value).toEqual([1])
  await list!.refetch() // "load more": reads its own value, untracked
  expect(list!.value).toEqual([1, 2])
})

test('review: refetch() resolves when its run ends, also inside a signals batch()', async () => {
  const { batch: signalsBatch } = await import('../../src/runtime/index.ts')
  let n = 0
  const r = resource(() => Promise.resolve(++n))
  await flush()
  let done!: Promise<void>
  signalsBatch(() => { done = r.refetch() })
  await done
  expect(r).toMatchObject({ value: 2, loading: false })
})
