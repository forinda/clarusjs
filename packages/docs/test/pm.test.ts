// The package-manager tabs: one neutral command, as each manager spells it.
import { expect, test } from 'vitest'
import { command, managers } from '../src/pm.ts'

test('init: a package.json without questions, in every manager', () => {
  expect(managers.map((m) => command(m, 'init'))).toEqual(['pnpm init', 'npm init -y', 'yarn init -y', 'bun init -y'])
})

test('sh: a shell line every manager shares, unchanged', () => {
  expect(managers.map((m) => command(m, 'sh mkdir my-site && cd my-site'))).toEqual(Array(4).fill('mkdir my-site && cd my-site'))
})
