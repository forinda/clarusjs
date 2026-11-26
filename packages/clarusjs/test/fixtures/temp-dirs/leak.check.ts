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
  // In another encoding the caller gets it encoded; the directory itself must still go.
  const c = Buffer.from(fs.mkdtempSync(join(tmpdir(), 'clarus-leak-'), { encoding: 'hex' }), 'hex').toString()
  expect(existsSync(a) && existsSync(b) && existsSync(c)).toBe(true) // there while the test runs
  writeFileSync(process.env.TEMP_DIRS_OUT!, JSON.stringify([a, b, c])) // where they were, for the test that runs this
})
