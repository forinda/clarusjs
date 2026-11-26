// #180: island scripts also run on the server, where clarusjs/navigation does nothing and there is no current URL.
import { expect, test } from 'vitest'
import { back, currentUrl, navigate } from '../../src/runtime/navigation.ts'

test('on the server: currentUrl is null (it is what the server renders) and navigating does nothing', async () => {
  expect(currentUrl.get()).toBeNull()
  expect(currentUrl.initial).toBeNull()
  await expect(navigate('/x')).resolves.toBeUndefined()
  expect(() => back()).not.toThrow()
})

test('on the server: abort() does nothing', async () => {
  const { abort } = await import('../../src/runtime/navigation.ts')
  expect(() => abort()).not.toThrow()
})

test('on the server: searchParams is null, setSearch() does nothing, navigationState() is undefined', async () => {
  const { searchParams, setSearch, navigationState } = await import('../../src/runtime/navigation.ts')
  expect(searchParams.get()).toBeNull()
  await expect(setSearch({ q: 'x' })).resolves.toBeUndefined()
  expect(navigationState()).toBeUndefined()
})
