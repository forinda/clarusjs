// /guide/testing shows the tested files themselves (with <<<), so its samples can't drift from what runs.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'

const read = (path: string) => readFileSync(resolve(import.meta.dirname, '..', path), 'utf8')

test('the guide shows the tested files with <<<', () => {
  const page = read('src/pages/guide/testing.md')
  for (const f of ['test/guide/vitest.config.example.ts', 'test/guide/greeting.tscl', 'test/guide/greeting.test.ts', 'e2e/guide-testing.spec.ts']) {
    expect(page, f).toMatch(new RegExp(`^<<< \\.\\./\\.\\./\\.\\./${f.replace(/\./g, '\\.')}`, 'm'))
  }
})

test('it has the sections', () => {
  const page = read('src/pages/guide/testing.md')
  for (const h of ['## Set up', '## Test what a component renders', '## Test islands in a browser', '## In CI', '## Not covered yet']) expect(page).toContain(h)
})

test('the example config is the minimal one', () => {
  const config = read('test/guide/vitest.config.example.ts')
  expect(config).toContain('clarusjs()')
  expect(config).not.toContain('projects')
})
