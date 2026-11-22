// The project's own clarusjs command line (check, explain), run as a child process: the same version and the same
// results as the project's scripts and CI.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

/** The clarusjs package folder `root` uses: node_modules/clarusjs here or in a parent folder. */
function clarusDir(root: string): string | undefined {
  for (let dir = resolve(root); ; dir = dirname(dir)) {
    const candidate = resolve(dir, 'node_modules/clarusjs/package.json')
    if (existsSync(candidate)) return dirname(candidate)
    if (dir === dirname(dir)) return undefined
  }
}

/** Run `clarusjs <args>` for the project at `root`. */
export function runClarus(args: string[], root: string): { status: number; stdout: string; stderr: string } {
  const dir = clarusDir(root)
  if (!dir) return { status: 1, stdout: '', stderr: `clarusjs isn't installed in ${root} (no node_modules/clarusjs): install it, or pass the project's folder as root.` }
  const bin = (JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8')) as { bin?: { clarusjs?: string } }).bin?.clarusjs ?? 'dist/cli/index.js'
  // A workspace checkout runs the source (its dist/ may be stale or not built); the published package has no src/.
  const source = resolve(dir, 'src/cli/index.ts')
  const argv = existsSync(source) ? ['--experimental-strip-types', '--no-warnings', source] : [resolve(dir, bin)]
  const run = spawnSync(process.execPath, [...argv, ...args], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return { status: run.status ?? 1, stdout: run.stdout ?? '', stderr: run.stderr || (run.error ? String(run.error) : '') }
}
