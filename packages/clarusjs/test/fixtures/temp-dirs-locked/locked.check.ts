// Run by temp-dirs.test.ts in its own Vitest: one temp directory that can't be removed (a read-only folder with a
// file in it), then one that can. The cleanup must still remove the second, and say what it couldn't.
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'vitest'

test('makes a locked temp directory, then a plain one', () => {
  const locked = mkdtempSync(join(tmpdir(), 'clarus-locked-'))
  mkdirSync(join(locked, 'ro'))
  writeFileSync(join(locked, 'ro', 'file.txt'), 'x')
  chmodSync(join(locked, 'ro'), 0o555)
  const plain = mkdtempSync(join(tmpdir(), 'clarus-plain-'))
  writeFileSync(process.env.TEMP_DIRS_OUT!, JSON.stringify({ locked, plain }))
})
