// A setup file for the packages' Vitest runs (#436): every temp directory a test file makes with mkdtempSync is
// removed once that file has run. Tests left them in /tmp, and a day of local runs filled its inodes (CI starts
// fresh, so it never noticed). Tests stay as they are: node:fs is wrapped here, for static and dynamic imports alike.
import { afterAll, vi } from 'vitest'

const made = vi.hoisted(() => new Set<string>())

vi.mock('node:fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs')>()
  const mkdtempSync = ((prefix: string, options?: Parameters<typeof fs.mkdtempSync>[1]) => {
    const dir = fs.mkdtempSync(prefix, options)
    made.add(String(dir))
    return dir
  }) as typeof fs.mkdtempSync
  return { ...fs, mkdtempSync, default: { ...fs, mkdtempSync } }
})

// Registered first, so it runs after the test file's own afterAll (which may still close a server in one of them).
afterAll(async () => {
  const { rmSync } = await vi.importActual<typeof import('node:fs')>('node:fs')
  // Each one tried, even after one fails (a file still locked on Windows): the rest still go, and the failures are
  // reported together.
  const failed: string[] = []
  for (const dir of made) {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3 })
    } catch (error) {
      failed.push(`${dir}: ${(error as Error).message}`)
    }
  }
  made.clear()
  if (failed.length)
    throw new Error(
      `couldn't remove ${failed.length} temp director${failed.length === 1 ? 'y' : 'ies'}:\n${failed.join('\n')}`,
    )
})
