// Builds dist/server.js before the tests (the e2e test drives the built bin).
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

export default function setup(): void {
  const pkg = resolve(import.meta.dirname, '..')
  execFileSync(process.execPath, [resolve(pkg, 'node_modules/vite/bin/vite.js'), 'build', '--logLevel', 'warn'], { cwd: pkg, stdio: 'inherit' })
}
