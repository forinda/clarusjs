// #57: a failing browser test leaves a trace (uploaded by CI with test-results/), so the failure can be replayed.
import { expect, test } from 'vitest'
import config from '../playwright.config.ts'

test('traces are kept for failing tests, and only for those', () => {
  expect(config.use?.trace).toBe('retain-on-failure')
  expect(config.outputDir ?? 'test-results').toBe('test-results') // the folder CI uploads
})
