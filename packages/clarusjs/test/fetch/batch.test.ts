// @vitest-environment happy-dom
// #258: batch(): keys asked of one endpoint at the same moment become one request; json(): fetch that throws on errors.
import { afterEach, expect, test, vi } from 'vitest'
import { batch, json, resource } from '../../src/fetch/index.ts'
import { flush } from './helpers.ts'

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
const answer = (keys: string[]) => Object.fromEntries(keys.map((k) => [k, k.toUpperCase()]))

test('keys asked in the same microtask go out in one load; each get gets its part', async () => {
  const load = vi.fn(answer)
  const b = batch(load)
  const got = await Promise.all([b.get('a'), b.get('b'), b.get('c')])
  expect(got).toEqual(['A', 'B', 'C'])
  expect(load).toHaveBeenCalledTimes(1)
  expect(load.mock.calls[0]![0]).toEqual(['a', 'b', 'c'])
})

test('keys asked in different microtasks of one task (islands attaching one after another) still go out together', async () => {
  const load = vi.fn(answer)
  const b = batch(load)
  const p1 = b.get('a')
  await Promise.resolve()
  await Promise.resolve()
  const p2 = b.get('b')
  await Promise.all([p1, p2])
  expect(load).toHaveBeenCalledTimes(1)
  expect(load.mock.calls[0]![0]).toEqual(['a', 'b'])
})

test('concurrent gets of one key share one request and one promise', async () => {
  const load = vi.fn(answer)
  const b = batch(load)
  const [p1, p2] = [b.get('a'), b.get('a')]
  expect(p1).toBe(p2)
  await p1
  expect(load.mock.calls[0]![0]).toEqual(['a'])
})

test('keys asked after a settled request go out again (no result cache)', async () => {
  const load = vi.fn(answer)
  const b = batch(load)
  await b.get('a')
  await b.get('a')
  expect(load).toHaveBeenCalledTimes(2)
})

test('wait: 10 collects keys for 10 ms', async () => {
  vi.useFakeTimers()
  const load = vi.fn(answer)
  const b = batch(load, { wait: 10 })
  void b.get('a')
  await vi.advanceTimersByTimeAsync(5)
  void b.get('b')
  await vi.advanceTimersByTimeAsync(5)
  expect(load).toHaveBeenCalledTimes(1)
  expect(load.mock.calls[0]![0]).toEqual(['a', 'b'])
})

test('max: 2 splits [a, b, c] into two loads', async () => {
  const load = vi.fn(answer)
  const b = batch(load, { max: 2 })
  await Promise.all(['a', 'b', 'c'].map((k) => b.get(k)))
  expect(load.mock.calls.map((c) => c[0])).toEqual([['a', 'b'], ['c']])
})

test('a key missing from the answer rejects that get with an error naming it; the others resolve', async () => {
  const b = batch((keys: string[]) => answer(keys.filter((k) => k !== 'b')))
  const [a, missing] = await Promise.allSettled([b.get('a'), b.get('b')])
  expect(a).toEqual({ status: 'fulfilled', value: 'A' })
  expect((missing as PromiseRejectedResult).reason.message).toBe('batch: no answer for "b"')
})

test('a failed load rejects every key in it', async () => {
  const b = batch(() => Promise.reject(new Error('down')))
  const results = await Promise.allSettled([b.get('a'), b.get('b')])
  expect(results.map((r) => (r as PromiseRejectedResult).reason.message)).toEqual(['down', 'down'])
})

test('json: non-2xx throws an Error with the status; 2xx returns the parsed body; init (signal) is passed to fetch', async () => {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => (url === '/bad' ? new Response('no', { status: 503, statusText: 'Service Unavailable' }) : Response.json({ ok: 1 })))
  vi.stubGlobal('fetch', fetchMock)
  const signal = new AbortController().signal
  expect(await json('/good', { signal })).toEqual({ ok: 1 })
  expect(fetchMock.mock.calls[0]![1]).toEqual({ signal })
  await expect(json('/bad')).rejects.toThrow('/bad: 503 Service Unavailable')
  // The failed response's body is read, so the request ends (a browser keeps an unread one open).
  const bad = (await fetchMock.mock.results[1]!.value) as Response
  expect(bad.bodyUsed).toBe(true)
})

test('resource + batch: three resources on one batch make one request', async () => {
  const load = vi.fn(answer)
  const b = batch(load)
  const rs = ['x', 'y', 'z'].map((k) => resource(() => b.get(k)))
  await flush()
  expect(rs.map((r) => r.value)).toEqual(['X', 'Y', 'Z'])
  expect(load).toHaveBeenCalledTimes(1)
})
