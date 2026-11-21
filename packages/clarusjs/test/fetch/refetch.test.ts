// @vitest-environment happy-dom
// #258: retry with backoff; refetch on an interval (while visible) and on focus; all of it stops with the island.
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { resource } from '../../src/fetch/index.ts'
import { scope } from '../../src/runtime/index.ts'

let visibility: 'visible' | 'hidden' = 'visible'
beforeEach(() => {
  vi.useFakeTimers()
  visibility = 'visible'
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
})
afterEach(() => vi.useRealTimers())
const show = (v: 'visible' | 'hidden') => { visibility = v; document.dispatchEvent(new Event('visibilitychange')) }
/** A fetcher failing `fails` times, then answering its call number. */
const flaky = (fails: number) => vi.fn(() => (flaky.calls++ < fails ? Promise.reject(new Error(`fail ${flaky.calls}`)) : Promise.resolve(flaky.calls)))
flaky.calls = 0
beforeEach(() => { flaky.calls = 0 })

test('retry: 2 retries with backoff 500 ms then 1000 ms, then succeeds', async () => {
  const f = flaky(2)
  const r = resource(f, { retry: 2 })
  await vi.advanceTimersByTimeAsync(0)
  expect(f).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(499)
  expect(f).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(1)
  expect(f).toHaveBeenCalledTimes(2)
  expect(r.loading).toBe(true)
  await vi.advanceTimersByTimeAsync(1000)
  expect(f).toHaveBeenCalledTimes(3)
  expect(r).toMatchObject({ value: 3, error: undefined, loading: false })
})

test('retry: gives up after count; error is the last failure', async () => {
  const r = resource(flaky(5), { retry: 1 })
  await vi.advanceTimersByTimeAsync(10_000)
  expect((r.error as Error).message).toBe('fail 2')
  expect(r.loading).toBe(false)
})

test('retry: a custom delay(attempt) is used', async () => {
  const delay = vi.fn((attempt: number) => attempt * 100)
  const f = flaky(2)
  resource(f, { retry: { count: 2, delay } })
  await vi.advanceTimersByTimeAsync(100)
  expect(f).toHaveBeenCalledTimes(2)
  await vi.advanceTimersByTimeAsync(200)
  expect(f).toHaveBeenCalledTimes(3)
  expect(delay.mock.calls.map((c) => c[0])).toEqual([1, 2])
})

test('no retry on abort; a pending retry delay is cancelled by a newer run and by dispose', async () => {
  const f = flaky(10)
  let r!: ReturnType<typeof resource<number>>
  const dispose = scope(() => { r = resource(f, { retry: 3 }) })
  await vi.advanceTimersByTimeAsync(0)
  void r.refetch() // a newer run: the first run's pending retry is dropped
  await vi.advanceTimersByTimeAsync(0)
  expect(f).toHaveBeenCalledTimes(2)
  dispose()
  await vi.advanceTimersByTimeAsync(20_000)
  expect(f).toHaveBeenCalledTimes(2)
})

test('interval: refetches every interval while visible; skips while hidden and while a run is in flight', async () => {
  let slow = false
  const f = vi.fn(() => (slow ? new Promise<number>((res) => setTimeout(() => res(0), 5000)) : Promise.resolve(1)))
  resource(f, { refetch: { interval: 1000 } })
  await vi.advanceTimersByTimeAsync(0)
  await vi.advanceTimersByTimeAsync(1000)
  expect(f).toHaveBeenCalledTimes(2)
  visibility = 'hidden'
  await vi.advanceTimersByTimeAsync(3000)
  expect(f).toHaveBeenCalledTimes(2)
  visibility = 'visible'
  slow = true
  await vi.advanceTimersByTimeAsync(1000)
  expect(f).toHaveBeenCalledTimes(3)
  await vi.advanceTimersByTimeAsync(3000) // the slow run is still in flight: no new run
  expect(f).toHaveBeenCalledTimes(3)
})

test('focus: refetches when the page becomes visible again; not while a run is in flight', async () => {
  let slow = false
  const f = vi.fn(() => (slow ? new Promise<number>(() => {}) : Promise.resolve(1)))
  resource(f, { refetch: { focus: true } })
  await vi.advanceTimersByTimeAsync(0)
  show('hidden')
  show('visible')
  await vi.advanceTimersByTimeAsync(0)
  expect(f).toHaveBeenCalledTimes(2)
  slow = true
  show('hidden'); show('visible')
  show('hidden'); show('visible')
  expect(f).toHaveBeenCalledTimes(3)
})

test('dispose removes the interval and the visibility listener', async () => {
  const f = vi.fn(() => Promise.resolve(1))
  const dispose = scope(() => { resource(f, { refetch: { interval: 1000, focus: true } }) })
  await vi.advanceTimersByTimeAsync(0)
  dispose()
  await vi.advanceTimersByTimeAsync(5000)
  show('hidden'); show('visible')
  expect(f).toHaveBeenCalledTimes(1)
})

test('a run cut short by "not ready" doesn\'t block later interval refetches', async () => {
  const { state } = await import('../../src/runtime/index.ts')
  const ready = state(true)
  let hang = true
  const f = vi.fn(() => (ready.get() ? (hang ? new Promise<number>(() => {}) : Promise.resolve(1)) : undefined))
  resource(f, { refetch: { interval: 1000 } })
  ready.set(false) // the hanging run is aborted: nothing is in flight now
  hang = false
  await vi.advanceTimersByTimeAsync(1000) // the interval's refetch runs (the fetcher says "not ready" again)
  expect(f).toHaveBeenCalledTimes(3)
})
