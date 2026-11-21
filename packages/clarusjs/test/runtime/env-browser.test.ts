// @vitest-environment happy-dom
// `browser` from clarusjs/runtime: true where an island attaches.
import { expect, test } from 'vitest'
import { browser } from '../../src/runtime/index.ts'

test('browser is true in the browser', () => {
  expect(browser).toBe(true)
})
