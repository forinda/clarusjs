// #436: tests made temp directories and left them in /tmp (a day of runs filled its inodes). The shared setup removes
// what each test file made once it's done.
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, readFileSync, rmSync } from 'node:fs'
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
    shell: process.platform === 'win32', // pnpm is a .cmd there, which runs only through a shell
  })
  expect(run.status, `${run.error ?? ''}${run.stdout}${run.stderr}`).toBe(0)
  const dirs: string[] = JSON.parse(readFileSync(report, 'utf8'))
  rmSync(report)
  expect(dirs).toHaveLength(2)
  for (const dir of dirs) expect(existsSync(dir), dir).toBe(false)
}, 60_000)

// One that can't be removed doesn't stop the others; the run says which it couldn't. (POSIX permissions: not on
// Windows, and root ignores them.)
test.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
  "a temp directory that can't be removed doesn't keep the others: they go, and the failure is reported",
  () => {
    const root = fileURLToPath(new URL('./fixtures/temp-dirs-locked/', import.meta.url))
    const pkg = fileURLToPath(new URL('..', import.meta.url))
    const report = join(tmpdir(), `clarus-temp-dirs-locked-${process.pid}.json`)
    const run = spawnSync('pnpm', ['exec', 'vitest', 'run', '--root', root], {
      cwd: pkg,
      encoding: 'utf8',
      env: { ...process.env, CI: '1', TEMP_DIRS_OUT: report },
    })
    const { locked, plain }: { locked: string; plain: string } = JSON.parse(readFileSync(report, 'utf8'))
    rmSync(report)
    try {
      expect(existsSync(plain), 'the plain one').toBe(false)
      expect(existsSync(locked), 'the locked one').toBe(true)
      expect(run.status).not.toBe(0)
      expect(run.stdout + run.stderr).toContain("couldn't remove 1 temp directory")
    } finally {
      chmodSync(join(locked, 'ro'), 0o755)
      rmSync(locked, { recursive: true, force: true })
    }
  },
  60_000,
)
