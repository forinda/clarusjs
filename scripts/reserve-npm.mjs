#!/usr/bin/env node
// Publishes a 0.0.0 placeholder for a new package, so its trusted-publisher rule can be set on npm before the first
// automated release (npm only offers the rule on a package that exists). Run by a maintainer, logged in to npm:
//
//   node scripts/reserve-npm.mjs @clarusjs/prettier-plugin            # publish the placeholder
//   node scripts/reserve-npm.mjs @clarusjs/prettier-plugin --dry-run  # show what would be published
//
// Then: npmjs.com → package → Settings → Trusted publishers (see RELEASE.md).
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [name, ...flags] = process.argv.slice(2)
const dryRun = flags.includes('--dry-run')
if (!name || !/^@clarusjs\/[a-z0-9-]+$|^clarusjs(-[a-z0-9-]+)?$/.test(name)) {
  console.error('usage: node scripts/reserve-npm.mjs @clarusjs/<name> [--dry-run]')
  process.exit(1)
}

// Never over an existing package: a placeholder would become its newest version.
try {
  execFileSync('npm', ['view', name, 'name'], { stdio: 'pipe' })
  console.error(`${name} is already on npm: nothing to reserve.`)
  process.exit(1)
} catch (err) {
  if (!String(err.stderr).includes('E404')) throw err
}

const dir = mkdtempSync(join(tmpdir(), 'clarusjs-reserve-'))
try {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name,
    version: '0.0.0',
    description: 'Placeholder: the first release is published from https://github.com/forinda/clarusjs',
    license: 'MIT',
    repository: { type: 'git', url: 'git+https://github.com/forinda/clarusjs.git' },
  }, null, 2) + '\n')
  writeFileSync(join(dir, 'README.md'), `# ${name}\n\nPlaceholder. The first release is published from [clarusjs](https://github.com/forinda/clarusjs).\n`)
  writeFileSync(join(dir, 'LICENSE'), readFileSync(new URL('../LICENSE', import.meta.url)))
  execFileSync('npm', ['publish', '--access', 'public', ...(dryRun ? ['--dry-run'] : [])], { cwd: dir, stdio: 'inherit' })
  if (!dryRun) console.log(`\nReserved ${name}@0.0.0. Next: add its trusted publisher on npmjs.com (RELEASE.md, "Trusted publishing").`)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
