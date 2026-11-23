// @vitest-environment happy-dom
// #429: action(): a one-off async call (delete, save, like) with pending, error and result; run() never rejects,
// runAsync() does; a call while one runs joins it (no double submit) or, with concurrency: 'latest', replaces it.
import { afterEach, expect, test, vi } from 'vitest'
import { action, configure, type Action } from '../../src/fetch/index.ts'
import { scope } from '../../src/runtime/index.ts'
import { deferred, flush } from './helpers.ts'

afterEach(() => configure({}))
const abortable = (signal: AbortSignal) => new Promise<never>((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)))

test('run(input): pending while it runs, then result; the function gets the input and a signal', async () => {
  const fn = vi.fn(async (id: number, { signal }: { signal: AbortSignal }) => { expect(signal).toBeInstanceOf(AbortSignal); return id * 2 })
  const a = action(fn)
  expect(a).toMatchObject({ pending: false, error: undefined, result: undefined })
  const p = a.run(21)
  expect(a.pending).toBe(true)
  expect(await p).toBe(42)
  expect(a).toMatchObject({ pending: false, error: undefined, result: 42 })
  expect(fn.mock.calls[0]![0]).toBe(21)
})

test('a failure: run() resolves undefined (never rejects) and error holds it; runAsync() rejects with it', async () => {
  const a = action(async () => { throw new Error('nope') })
  expect(await a.run()).toBeUndefined()
  expect(a).toMatchObject({ pending: false, error: { message: 'nope' } })
  await expect(a.runAsync()).rejects.toThrow('nope')
  expect(a.error).toMatchObject({ message: 'nope' })
})

test('the next call clears the last error; result stays until a new success', async () => {
  let fail = true
  const a = action(async (n: number) => { if (fail) throw new Error('x'); return n })
  fail = false
  await a.run(1)
  fail = true
  await a.run(2)
  expect(a).toMatchObject({ result: 1, error: { message: 'x' } })
  fail = false
  const p = a.run(3)
  expect(a.error).toBeUndefined()
  await p
  expect(a.result).toBe(3)
})

test('a call while one runs joins it: one request, the same answer (no double submit)', async () => {
  const d = deferred<string>()
  const fn = vi.fn(() => d.promise)
  const a = action(fn)
  const p1 = a.run()
  const p2 = a.run()
  d.resolve('done')
  expect(await Promise.all([p1, p2])).toEqual(['done', 'done'])
  expect(fn).toHaveBeenCalledTimes(1)
})

test("concurrency: 'latest' aborts the call in flight (no callbacks for it) and runs the new one", async () => {
  const onError = vi.fn()
  const onSuccess = vi.fn()
  const a = action(async (n: number, { signal }) => (n === 1 ? abortable(signal) : n), { concurrency: 'latest', onError, onSuccess })
  const p1 = a.run(1)
  const p2 = a.run(2)
  expect(await p1).toBeUndefined()
  expect(await p2).toBe(2)
  expect(onError).not.toHaveBeenCalled()
  expect(onSuccess).toHaveBeenCalledTimes(1)
  expect(a).toMatchObject({ pending: false, result: 2, error: undefined })
})

test('abort(): back to idle, no error, no callbacks; runAsync() of the cancelled call rejects with the AbortError', async () => {
  const onSettled = vi.fn()
  const a = action((_: void, { signal }) => abortable(signal), { onSettled })
  const p = a.runAsync()
  a.abort()
  await expect(p).rejects.toMatchObject({ name: 'AbortError' })
  expect(a).toMatchObject({ pending: false, error: undefined })
  expect(onSettled).not.toHaveBeenCalled()
})

test('timeout fails the call with a TimeoutError: an error, so onError sees it', async () => {
  const onError = vi.fn()
  const a = action((_: void, { signal }) => abortable(signal), { timeout: 20, onError })
  await a.run()
  expect(a.error).toMatchObject({ name: 'TimeoutError' })
  expect(onError).toHaveBeenCalledWith(expect.objectContaining({ name: 'TimeoutError' }), undefined)
})

test('callbacks get the input too; configure() handlers run after, with meta; false skips them', async () => {
  const seen: unknown[] = []
  configure({ onSuccess: (v, { meta }) => seen.push(['global', v, meta]), onError: () => seen.push('global err') })
  const save = action(async (name: string) => `saved ${name}`, { meta: { success: 'Saved' }, onSuccess: (v, input) => seen.push(['own', v, input]) })
  const quiet = action(async () => { throw new Error('x') }, { onError: () => false })
  await save.run('Ada')
  await quiet.run()
  expect(seen).toEqual([['own', 'saved Ada', 'Ada'], ['global', 'saved Ada', { success: 'Saved' }]])
})

test('created in an island scope, the call in flight is aborted when the island goes away', async () => {
  let signal!: AbortSignal
  let a!: Action<void, never>
  const dispose = scope(() => { a = action((_: void, ctx) => { signal = ctx.signal; return abortable(ctx.signal) }) })
  const p = a.run()
  dispose()
  expect(signal.aborted).toBe(true)
  expect(await p).toBeUndefined()
  await flush()
})

test('#434 review: a call made from a pending subscriber joins the call that announced it (one fn run)', async () => {
  const { effect } = await import('../../src/runtime/index.ts')
  const fn = vi.fn(() => new Promise((done) => setTimeout(done, 5)))
  const a = action(fn)
  effect(() => { if (a.pending) void a.run() })
  await a.run()
  expect(fn).toHaveBeenCalledTimes(1)
})
