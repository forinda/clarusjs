// The theme's own dependencies (#367): Tailwind builds its stylesheet, so it is a dev dependency only. Sites that use
// the theme get plain CSS and need no Tailwind of their own.
import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

test('Tailwind is a dev dependency: nothing a site installs with the theme pulls it in', () => {
  expect(pkg.dependencies).toBeUndefined()
  expect(Object.keys(pkg.peerDependencies)).toEqual(['clarusjs', 'mermaid'])
  expect(pkg.peerDependenciesMeta).toEqual({ mermaid: { optional: true } }) // only a site that draws diagrams installs it
  expect(pkg.devDependencies.tailwindcss).toBe('4.3.5')
  expect(pkg.devDependencies['@tailwindcss/cli']).toBe('4.3.5')
})

test("the Tailwind CLI runs in this package (the stylesheet's build)", async () => {
  const { execFileSync } = await import('node:child_process')
  const { createRequire } = await import('node:module')
  const { dirname, resolve } = await import('node:path')
  const cli = resolve(dirname(createRequire(import.meta.url).resolve('@tailwindcss/cli/package.json')), 'dist/index.mjs')
  // Without colors: CI sets FORCE_COLOR, which puts escape codes inside the version line.
  const env = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' }
  expect(execFileSync(process.execPath, [cli, '--help'], { encoding: 'utf8', env })).toMatch(/tailwindcss v4\.3\.5/)
})
