// @vitest-environment happy-dom
// #287: a keyed result cache: seen keys make no request; invalidate by prefix; setData, prefetch; unused entries go.
import { afterEach, expect, test, vi } from 'vitest'
import { invalidate, prefetch, resource, setData } from '../../src/fetch/index.ts'
import { scope, state } from '../../src/runtime/index.ts'
import { deferred, flush } from './helpers.ts'

afterEach(() => vi.useRealTimers())
let n = 0
const uniq = () => `k${n++}` // each test its own key names: the cache is module-level

test('a seen key is served from the cache: no request', async () => {
  const name = uniq()
  const page = state(1)
  const f = vi.fn(() => Promise.resolve(`page ${page.get()} #${f.mock.calls.length}`))
  const r = resource(f, { key: () => [name, { page: page.get() }] })
  await flush()
  page.set(2)
  await flush()
  page.set(1)
  await flush()
  expect(f).toHaveBeenCalledTimes(2)
  expect(r.value).toBe('page 1 #1')
})

test('key objects in any property order are one entry', async () => {
  const name = uniq()
  const f = vi.fn(() => Promise.resolve(1))
  resource(f, { key: () => [name, { a: 1, b: 2 }] })
  await flush()
  const g = vi.fn(() => Promise.resolve(2))
  const r = resource(g, { key: () => [name, { b: 2, a: 1 }] })
  await flush()
  expect(g).not.toHaveBeenCalled()
  expect(r.value).toBe(1)
})

test('stale: after stale ms a cached key fetches again; stale: 0 always fetches', async () => {
  vi.useFakeTimers()
  const name = uniq()
  const page = state(1)
  const f = vi.fn(() => Promise.resolve(page.get()))
  resource(f, { key: () => [name, page.get()], stale: 1000 })
  await vi.advanceTimersByTimeAsync(0)
  page.set(2); await vi.advanceTimersByTimeAsync(0)
  page.set(1); await vi.advanceTimersByTimeAsync(0)
  expect(f).toHaveBeenCalledTimes(2) // page 1 still fresh
  await vi.advanceTimersByTimeAsync(1000)
  page.set(2); await vi.advanceTimersByTimeAsync(0)
  expect(f).toHaveBeenCalledTimes(3) // page 2 is older than 1 s
  const always = uniq()
  const g = vi.fn(() => Promise.resolve(1))
  resource(g, { key: () => [always], stale: 0 })
  resource(g, { key: () => [always], stale: 0 })
  await vi.advanceTimersByTimeAsync(0)
  resource(g, { key: () => [always], stale: 0 })
  await vi.advanceTimersByTimeAsync(0)
  expect(g).toHaveBeenCalledTimes(2) // the first two shared a request; the third fetched again
})

test('the previous value stays while a new key loads; loading is true', async () => {
  const name = uniq()
  const page = state(1)
  const second = deferred<string>()
  const r = resource(() => (page.get() === 1 ? Promise.resolve('one') : second.promise), { key: () => [name, page.get()] })
  await flush()
  page.set(2)
  expect(r).toMatchObject({ value: 'one', loading: true })
  second.resolve('two')
  await flush()
  expect(r).toMatchObject({ value: 'two', loading: false })
})

test('two resources with one key share a request and both get the answer, even if one moves on mid-request', async () => {
  const name = uniq()
  const answer = deferred<string>()
  const f = vi.fn(() => answer.promise)
  const where = state('shared')
  const a = resource(f, { key: () => [name, where.get()] })
  const b = resource(f, { key: () => [name, 'shared'] })
  expect(f).toHaveBeenCalledTimes(1)
  where.set('elsewhere') // a moves on (a second request, for its new key)
  answer.resolve('answer')
  await flush()
  expect(b.value).toBe('answer')
  expect(a.value).toBe('answer') // the same deferred answers a's new key too
})

test('invalidate(prefix): the visible resources refetch now; others on their next use; prefix matching is by element', async () => {
  const name = uniq()
  const page = state(1)
  let version = 1
  const f = vi.fn(() => Promise.resolve(`p${page.get()} v${version}`))
  const r = resource(f, { key: () => [name, { page: page.get() }] })
  await flush()
  page.set(2); await flush()
  const other = vi.fn(() => Promise.resolve('x'))
  resource(other, { key: () => [`${name}x`] })
  resource(other, { key: () => ['other', name] })
  await flush()
  version = 2
  invalidate([name])
  await flush()
  expect(f).toHaveBeenCalledTimes(3) // page 2 (visible) refetched
  expect(r.value).toBe('p2 v2')
  expect(other).toHaveBeenCalledTimes(2) // neither of the others matched
  page.set(1); await flush()
  expect(f).toHaveBeenCalledTimes(4) // page 1 was invalidated: fetched on its next use
  expect(r.value).toBe('p1 v2')
})

test('invalidate during a request: the old response isn\'t stored, the resource ends with fresh data', async () => {
  const name = uniq()
  const answers = [deferred<string>(), deferred<string>()]
  let i = 0
  const r = resource(() => answers[i++]!.promise, { key: () => [name] })
  invalidate([name]) // while the first request is in flight
  answers[1]!.resolve('fresh')
  await flush()
  answers[0]!.resolve('old')
  await flush()
  expect(r.value).toBe('fresh')
  const again = resource(() => Promise.resolve('should not fetch'), { key: () => [name] })
  await flush()
  expect(again.value).toBe('fresh') // the entry holds the fresh answer
})

test('setData(key, fn) updates the entry and the resources showing it; creates a missing entry; mutate() writes the entry', async () => {
  const name = uniq()
  const a = resource(() => Promise.resolve(['x']), { key: () => [name] })
  await flush()
  setData<string[]>([name], (prev) => [...(prev ?? []), 'y'])
  expect(a.value).toEqual(['x', 'y'])
  const fresh = uniq()
  setData([fresh], 'seeded')
  const b = resource(() => Promise.resolve('fetched'), { key: () => [fresh] })
  await flush()
  expect(b.value).toBe('seeded')
  b.mutate('mutated')
  const c = resource(() => Promise.resolve('fetched'), { key: () => [fresh] })
  await flush()
  expect(c.value).toBe('mutated')
})

test('prefetch(key, fetcher) fills the entry; a resource opening that key makes no request', async () => {
  const name = uniq()
  await prefetch([name, 2], () => Promise.resolve('page 2'))
  const f = vi.fn(() => Promise.resolve('fetched'))
  const r = resource(f, { key: () => [name, 2] })
  await flush()
  expect(f).not.toHaveBeenCalled()
  expect(r.value).toBe('page 2')
})

test('an entry nothing shows is dropped after keep (default 5 min); a user returning before that keeps it', async () => {
  vi.useFakeTimers()
  const name = uniq()
  const f = vi.fn(() => Promise.resolve(1))
  const open = () => scope(() => { resource(f, { key: () => [name] }) })
  open()() // shown, then its island goes
  await vi.advanceTimersByTimeAsync(4 * 60_000)
  const close = open() // back before 5 min: cached
  await vi.advanceTimersByTimeAsync(0)
  expect(f).toHaveBeenCalledTimes(1)
  close()
  await vi.advanceTimersByTimeAsync(5 * 60_000)
  open()
  await vi.advanceTimersByTimeAsync(0)
  expect(f).toHaveBeenCalledTimes(2) // dropped: fetched again
  const short = uniq()
  const g = vi.fn(() => Promise.resolve(1))
  scope(() => { resource(g, { key: () => [short], keep: 1000 }) })()
  await vi.advanceTimersByTimeAsync(1000)
  scope(() => { resource(g, { key: () => [short] }) })
  await vi.advanceTimersByTimeAsync(0)
  expect(g).toHaveBeenCalledTimes(2)
})

test('a falsy key is "not ready": no request, value kept', async () => {
  const name = uniq()
  const id = state<number | undefined>(1)
  const f = vi.fn(() => Promise.resolve(id.get()))
  const r = resource(f, { key: () => id.get() !== undefined && [name, id.get()] })
  await flush()
  id.set(undefined)
  await flush()
  expect(f).toHaveBeenCalledTimes(1)
  expect(r).toMatchObject({ value: 1, loading: false })
})

test('initial with key seeds the entry as fresh: no browser request', async () => {
  const name = uniq()
  const f = vi.fn(() => Promise.resolve('fetched'))
  const r = resource(f, { key: () => [name], initial: 'from load' })
  await flush()
  expect(f).not.toHaveBeenCalled()
  expect(r.value).toBe('from load')
})

test('an error isn\'t cached: the entry keeps its last value and the next use fetches', async () => {
  const name = uniq()
  let fail = false
  const f = vi.fn(() => (fail ? Promise.reject(new Error('down')) : Promise.resolve('ok')))
  const r = resource(f, { key: () => [name] })
  await flush()
  fail = true
  await r.refetch()
  expect(r).toMatchObject({ value: 'ok', error: expect.any(Error) })
  fail = false
  const again = resource(f, { key: () => [name] })
  await flush()
  expect(again.value).toBe('ok')
})

test('review P1: an unkeyed fetcher returning { hit } is just a value', async () => {
  const r = resource(() => ({ hit: 5, other: 1 }))
  await flush()
  expect(r.value).toEqual({ hit: 5, other: 1 })
})

test('review P2: a cached undefined doesn\'t crash; it\'s a hit like any value', async () => {
  const name = uniq()
  setData([name], undefined)
  const f = vi.fn(() => Promise.resolve(1))
  expect(() => resource(f, { key: () => [name] })).not.toThrow()
  await flush()
  expect(f).not.toHaveBeenCalled()
})

test('review P4: setData during a request wins in every resource, including the one that started the request', async () => {
  const name = uniq()
  const answer = deferred<string>()
  const a = resource(() => answer.promise, { key: () => [name] })
  setData([name], 'optimistic')
  answer.resolve('server, older')
  await flush()
  expect(a.value).toBe('optimistic')
})

test('review P5: two refetches on one key finishing out of order: the newest answer wins', async () => {
  const name = uniq()
  const answers = [deferred<string>(), deferred<string>(), deferred<string>()]
  let i = 0
  const r = resource(() => answers[i++]!.promise, { key: () => [name] })
  answers[0]!.resolve('first'); await flush()
  void r.refetch(); void r.refetch()
  answers[2]!.resolve('newest'); await flush()
  answers[1]!.resolve('older'); await flush()
  expect(r.value).toBe('newest')
})

test('review P3/P6: invalidate makes one request per key, not per resource; a later user never gets the discarded answer', async () => {
  const name = uniq()
  let version = 1
  const f = vi.fn(() => Promise.resolve(`v${version}`))
  const a = resource(f, { key: () => [name] })
  const b = resource(f, { key: () => [name] })
  await flush()
  version = 2
  invalidate([name])
  await flush()
  expect(f).toHaveBeenCalledTimes(2) // one for both
  expect([a.value, b.value]).toEqual(['v2', 'v2'])
  const lone = uniq()
  const slow = deferred<string>()
  const answers = [slow.promise, Promise.resolve('fresh')]
  let j = 0
  scope(() => { resource(() => answers[j++]!, { key: () => [lone] }) })() // starts a request, then its island goes
  invalidate([lone]) // no users now, a request in flight
  slow.resolve('discarded')
  const later = resource(() => answers[j++]!, { key: () => [lone] })
  await flush()
  expect(later.value).toBe('fresh')
})

test('review P7: a keyed fetcher\'s falsy result is "not ready": nothing cached, no loading', async () => {
  const name = uniq()
  const team = state<number | undefined>(undefined)
  const r = resource(() => team.get() !== undefined && Promise.resolve(team.get()), { key: () => [name] })
  expect(r.loading).toBe(false)
  await flush()
  const g = vi.fn(() => Promise.resolve('fetched'))
  const other = resource(g, { key: () => [name] })
  await flush()
  expect(g).toHaveBeenCalledTimes(1) // nothing was cached for the key
  expect(other.value).toBe('fetched')
})

test('review: keep follows the users still there, not the largest ever', async () => {
  vi.useFakeTimers()
  const name = uniq()
  const f = vi.fn(() => Promise.resolve(1))
  const long = scope(() => { resource(f, { key: () => [name], keep: 60_000 }) })
  const short = scope(() => { resource(f, { key: () => [name], keep: 1000 }) })
  await vi.advanceTimersByTimeAsync(0)
  long()
  short() // the last user's keep: 1 s
  await vi.advanceTimersByTimeAsync(1000)
  resource(f, { key: () => [name] })
  await vi.advanceTimersByTimeAsync(0)
  expect(f).toHaveBeenCalledTimes(2)
})

test('review: a key getter that throws is an error, also with initial', async () => {
  let r!: ReturnType<typeof resource<number>>
  expect(() => { r = resource(() => Promise.resolve(1), { key: () => { throw new Error('bad key') }, initial: 0 }) }).not.toThrow()
  await flush()
  expect((r.error as Error).message).toBe('bad key')
})

test('ready(): resolves with the first answer; rejects when the first run fails; at once when there is a value', async () => {
  const r = resource(() => new Promise<number>((res) => setTimeout(() => res(7), 5)))
  expect(await r.ready()).toBe(7)
  expect(await r.ready()).toBe(7)
  const bad = resource(() => Promise.reject(new Error('down')))
  await expect(bad.ready()).rejects.toThrow('down')
  const name = uniq()
  const page = state(1)
  const keyed = resource(() => Promise.resolve(page.get() * 10), { key: () => [name, page.get()] })
  expect(await keyed.ready()).toBe(10)
})
