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
