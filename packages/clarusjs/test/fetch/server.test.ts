// #258: on the server a resource never fetches: it renders its loading state, or its initial value.
import { expect, test, vi } from 'vitest'

vi.mock('../../src/runtime/env.ts', () => ({ browser: false }))

test('on the server nothing is fetched', async () => {
  const { resource } = await import('../../src/fetch/index.ts')
  const fetcher = vi.fn(() => Promise.resolve(1))
  expect(resource(fetcher)).toMatchObject({ value: undefined, loading: true })
  expect(resource(fetcher, { initial: 7 })).toMatchObject({ value: 7, loading: false })
  expect(fetcher).not.toHaveBeenCalled()
})

test('review: mutate() is a no-op on the server (a module-level resource must not carry one request\'s value into another)', async () => {
  const { resource } = await import('../../src/fetch/index.ts')
  const r = resource(() => Promise.resolve(1), { initial: 0 })
  r.mutate(5)
  expect(r.value).toBe(0)
})

test('on the server, key and the cache functions do nothing', async () => {
  const { resource, invalidate, setData, prefetch } = await import('../../src/fetch/index.ts')
  const f = vi.fn(() => Promise.resolve(1))
  expect(resource(f, { key: () => ['s'], initial: 2 }).value).toBe(2)
  setData(['s'], 3)
  invalidate(['s'])
  await prefetch(['s'], f)
  expect(f).not.toHaveBeenCalled()
})
