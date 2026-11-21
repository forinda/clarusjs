// `browser` from clarusjs/runtime: false where a script renders on the server (Node, no DOM).
import { expect, test, vi } from 'vitest'
import { browser } from '../../src/runtime/index.ts'

test('browser is false on the server', () => {
  expect(browser).toBe(false)
})

test('a window without a document (some server runtimes define one) is still the server', async () => {
  ;(globalThis as { window?: unknown }).window = globalThis
  try {
    vi.resetModules() // evaluate env.ts again, with the window set
    const { browser: fresh } = await import('../../src/runtime/env.ts')
    expect(fresh).toBe(false)
  } finally {
    delete (globalThis as { window?: unknown }).window
  }
})
