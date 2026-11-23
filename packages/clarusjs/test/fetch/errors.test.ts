// @vitest-environment happy-dom
// #431: a resource can be cancelled (abort(), not an error) or time out (an error); its outcome reaches callbacks
// (onSuccess, onError, onSettled), once per run, and then the handlers given to configure() (toasts in one place).
import { afterEach, expect, test, vi } from 'vitest'
import { action, configure, resource } from '../../src/fetch/index.ts'
import { deferred, flush } from './helpers.ts'

afterEach(() => { configure({}); vi.unstubAllGlobals() })
const abortable = ({ signal }: { signal: AbortSignal }) => new Promise<number>((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)))

test('abort() cancels the run in flight: back to idle, no error, the last value kept, no callbacks', async () => {
  const onError = vi.fn()
  const onSettled = vi.fn()
  let n = 0
  const r = resource((ctx) => (++n === 1 ? Promise.resolve(1) : abortable(ctx)), { onError, onSettled })
  await flush()
  onSettled.mockClear()
  void r.refetch()
  await flush()
  expect(r.loading).toBe(true)
  r.abort()
  await flush()
  expect(r).toMatchObject({ value: 1, loading: false, error: undefined })
  expect(onError).not.toHaveBeenCalled()
  expect(onSettled).not.toHaveBeenCalled()
})

test('timeout fails the run with a TimeoutError: an error, so onError and error see it', async () => {
  const onError = vi.fn()
  const r = resource(abortable, { timeout: 20, onError })
  await new Promise((done) => setTimeout(done, 60))
  expect(r.loading).toBe(false)
  expect(r.error).toMatchObject({ name: 'TimeoutError' })
  expect(onError).toHaveBeenCalledTimes(1)
})

test('callbacks run once per settled run: onSuccess(value), onError(error), onSettled(value, error)', async () => {
  let n = 0
  const calls: string[] = []
  const r = resource(async () => { n++; if (n === 2) throw new Error('second'); return n }, {
    onSuccess: (v) => calls.push(`ok ${v}`),
    onError: (e) => calls.push(`err ${(e as Error).message}`),
    onSettled: (v, e) => calls.push(`settled ${v} ${(e as Error | undefined)?.message}`),
  })
  await flush()
  await r.refetch()
  await r.refetch()
  expect(calls).toEqual(['ok 1', 'settled 1 undefined', 'err second', 'settled undefined second', 'ok 3', 'settled 3 undefined'])
})

test('the same error twice still calls onError twice (an event per run, unlike an effect on error)', async () => {
  const onError = vi.fn()
  const r = resource(() => Promise.reject(new Error('down')), { onError })
  await flush()
  await r.refetch()
  expect(onError).toHaveBeenCalledTimes(2)
})

test('with retry, onError runs once, after the last attempt', async () => {
  const onError = vi.fn()
  const fetcher = vi.fn(() => Promise.reject(new Error('x')))
  resource(fetcher, { retry: { count: 2, delay: () => 1 }, onError })
  await new Promise((done) => setTimeout(done, 30))
  expect(fetcher).toHaveBeenCalledTimes(3)
  expect(onError).toHaveBeenCalledTimes(1)
})

test('configure(): global handlers run after the instance\'s, with its meta; onError returning false stops the global one', async () => {
  const seen: unknown[] = []
  configure({ onError: (e, { meta }) => seen.push(['global err', (e as Error).message, meta]), onSuccess: (v, { meta }) => seen.push(['global ok', v, meta]) })
  resource(() => Promise.resolve(5), { meta: { success: 'Loaded' }, onSuccess: () => seen.push('own ok') })
  resource(() => Promise.reject(new Error('a')), { meta: { silent: true } })
  resource(() => Promise.reject(new Error('b')), { onError: () => false })
  await flush()
  expect(seen).toEqual(['own ok', ['global ok', 5, { success: 'Loaded' }], ['global err', 'a', { silent: true }]])
})

test('a callback that throws is reported, and the resource\'s state stays as the run left it', async () => {
  const report = vi.spyOn(console, 'error').mockImplementation(() => {}) // reportError where it exists (browsers)
  vi.stubGlobal('reportError', undefined)
  const r = resource(() => Promise.resolve(7), { onSuccess: () => { throw new Error('toast broke') } })
  await flush()
  expect(r).toMatchObject({ value: 7, loading: false, error: undefined })
  expect(report).toHaveBeenCalledWith(expect.objectContaining({ message: 'toast broke' }))
  report.mockRestore()
})

test('a client that rejects with its own error on abort (axios: CanceledError) still reports a timeout as TimeoutError', async () => {
  class CanceledError extends Error { name = 'CanceledError' }
  const client = (signal: AbortSignal) => new Promise<never>((_, reject) => signal.addEventListener('abort', () => reject(new CanceledError('canceled'))))
  const onError = vi.fn()
  const r = resource(({ signal }) => client(signal), { timeout: 20, onError })
  const a = action((_: void, { signal }) => client(signal), { timeout: 20 })
  await a.run()
  await new Promise((done) => setTimeout(done, 40))
  expect(r.error).toMatchObject({ name: 'TimeoutError' })
  expect(onError).toHaveBeenCalledWith(expect.objectContaining({ name: 'TimeoutError' }), undefined)
  expect(a.error).toMatchObject({ name: 'TimeoutError' })
})
