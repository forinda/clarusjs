// The package's shape: ESLint is a peer (the project's own runs), never a dependency.
import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

test('eslint and clarusjs are peers, and nothing is a runtime dependency', () => {
  expect(Object.keys(pkg.peerDependencies)).toEqual(['clarusjs', 'eslint'])
  expect(pkg.dependencies).toBeUndefined()
})

test('ESLint itself loads in this workspace', async () => {
  const { Linter } = await import('eslint')
  expect(new Linter().verify('let a = 1', { rules: { 'prefer-const': 'error' } })[0]?.ruleId).toBe('prefer-const')
})
