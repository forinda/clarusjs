// Pending changesets name packages that changesets will release. A changeset for a private package (the VS Code
// extension, the docs site) is never consumed: changesets 3 skips private packages (privatePackages.version is false),
// so the file stays, and the release workflow keeps opening empty "version packages" PRs instead of publishing.
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'

const root = resolve(import.meta.dirname, '../../..')

test('every pending changeset names a published workspace package', () => {
  const packages = new Map<string, boolean>()
  for (const dir of ['packages', 'examples']) {
    for (const name of readdirSync(resolve(root, dir))) {
      try {
        const pkg = JSON.parse(readFileSync(resolve(root, dir, name, 'package.json'), 'utf8')) as { name: string; private?: boolean }
        packages.set(pkg.name, pkg.private === true)
      } catch {
        // not a package
      }
    }
  }
  const problems: string[] = []
  for (const file of readdirSync(resolve(root, '.changeset')).filter((f) => f.endsWith('.md') && f !== 'README.md')) {
    const front = readFileSync(resolve(root, '.changeset', file), 'utf8').match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ''
    for (const [, name] of front.matchAll(/^\s*['"]?([^'":]+)['"]?\s*:/gm)) {
      if (!packages.has(name!)) problems.push(`${file}: ${name} isn't a workspace package`)
      else if (packages.get(name!)) problems.push(`${file}: ${name} is private (release it by hand; changesets never consumes this)`)
    }
  }
  expect(problems).toEqual([])
})
