// Run by temp-dirs.test.ts in its own Vitest: makes temp directories the way the suite's tests do, and writes where.
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'

test('makes temp directories, static and dynamic imports alike', async () => {
  const a = mkdtempSync(join(tmpdir(), 'clarus-leak-'))
  writeFileSync(join(a, 'file.txt'), 'x')
  const fs = await import('node:fs')
  const b = fs.mkdtempSync(join(tmpdir(), 'clarus-leak-'))
  expect(existsSync(a) && existsSync(b)).toBe(true) // there while the test runs
  writeFileSync(process.env.TEMP_DIRS_OUT!, JSON.stringify([a, b])) // where they were, for the test that runs this
})
