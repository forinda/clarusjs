// #436: tests made temp directories and left them in /tmp (a day of runs filled its inodes). The shared setup removes
// what each test file made once it's done.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

test("a test file's temp directories are gone once it has run", () => {
  const root = fileURLToPath(new URL('./fixtures/temp-dirs/', import.meta.url))
  const pkg = fileURLToPath(new URL('..', import.meta.url))
  const report = join(tmpdir(), `clarus-temp-dirs-${process.pid}.json`)
  const run = spawnSync('pnpm', ['exec', 'vitest', 'run', '--root', root], {
    cwd: pkg,
    encoding: 'utf8',
    env: { ...process.env, CI: '1', TEMP_DIRS_OUT: report },
  })
  expect(run.status, run.stdout + run.stderr).toBe(0)
  const dirs: string[] = JSON.parse(readFileSync(report, 'utf8'))
  rmSync(report)
  expect(dirs).toHaveLength(2)
  for (const dir of dirs) expect(existsSync(dir), dir).toBe(false)
}, 60_000)
