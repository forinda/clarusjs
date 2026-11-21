// Size budget: the published package (bin, the bundled server, README, LICENSE). Raising it is a deliberate change
// in its own PR (AGENTS.md). Set from the first build: 509 KB packed, 2.4 MB unpacked (Volar, the HTML/CSS/Emmet
// services with their data, and the clarusjs compiler, minified).
import { execSync } from 'node:child_process'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'

test('size budget: the published package stays within 600 KB packed, 2.8 MB unpacked, with no dependencies', () => {
  const pkgDir = resolve(import.meta.dirname, '..')
  const [info] = JSON.parse(execSync('npm pack --dry-run --json --ignore-scripts', { cwd: pkgDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))
  expect(info.size, `tarball ${info.size} B`).toBeLessThanOrEqual(600 * 1024)
  expect(info.unpackedSize, `unpacked ${info.unpackedSize} B`).toBeLessThanOrEqual(2.8 * 1024 * 1024)
  expect(info.files.map((f: { path: string }) => f.path).sort()).toEqual(['LICENSE', 'README.md', 'bin/clarusjs-ls.js', 'dist/server.js', 'package.json'])
}, 30_000)
