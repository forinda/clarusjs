// #368: the theme's stylesheet is written with Tailwind (src/styles/theme.css) and built to the plain src/theme.css the
// package ships. Sites need no Tailwind; the tokens still restyle everything.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { expect, test } from 'vitest'
import { classes } from '../scripts/classes.js'

const root = resolve(import.meta.dirname, '..')
const cli = resolve(dirname(createRequire(import.meta.url).resolve('@tailwindcss/cli/package.json')), 'dist/index.mjs')
/** The built stylesheet, written to a file as `pnpm css` writes it (stdout ends with one more newline). */
const build = (input: string) => {
  execFileSync(process.execPath, [resolve(root, 'scripts/classes.js')], { cwd: root })
  const out = resolve(mkdtempSync(resolve(tmpdir(), 'theme-css-')), 'theme.css')
  execFileSync(process.execPath, [cli, '-i', input, '-o', out], { cwd: root, stdio: 'ignore' })
  return readFileSync(out, 'utf8')
}

test('src/theme.css is the build of src/styles/theme.css (run pnpm css after editing the source)', () => {
  expect(readFileSync(resolve(root, 'src/theme.css'), 'utf8')).toBe(build('src/styles/theme.css'))
})

test("only class attributes are read: a class in a component is built on the theme's tokens, other words aren't", () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'theme-classes-'))
  writeFileSync(resolve(dir, 'part.tscl'), '{{-- hidden block --}}\n<nav class="bg-accent-soft text-muted {{ x }}" hidden>visible contents</nav>\n')
  expect(classes(dir)).toEqual(['bg-accent-soft', 'text-muted'])
  const css = readFileSync(resolve(root, 'src/theme.css'), 'utf8')
  expect(css).toMatch(/\.bg-accent-soft \{\s*background-color: var\(--accent-soft\);/)
  expect(css).toMatch(/\.font-sans \{\s*font-family: var\(--sans\);/) // the sidebar's ⌘K
  expect(css).not.toContain('tw\\:')
})

test("no class the theme styles itself is also a Tailwind utility (a part's .contents would get display: contents)", () => {
  const own = new Set<string>()
  for (const file of ['src/styles/theme.css', 'src/lesson.css']) {
    const text = readFileSync(resolve(root, file), 'utf8').replace(/^@import[^\n]*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    for (const m of text.matchAll(/\.([a-z][\w-]*)/g)) own.add(m[1]!)
  }
  const dir = mkdtempSync(resolve(tmpdir(), 'theme-own-'))
  writeFileSync(resolve(dir, 'in.css'), `@import 'tailwindcss/theme.css' source(none);\n@import 'tailwindcss/utilities.css' source(none);\n@source inline("${[...own].join(' ')}");\n`)
  const css = execFileSync(process.execPath, [cli, '-i', resolve(dir, 'in.css')], { encoding: 'utf8', cwd: root })
  expect([...own].filter((name) => new RegExp(`^\\s*\\.${name} \\{`, 'm').test(css))).toEqual([])
})

test('no Tailwind reset: the theme keeps its own base styles, and a site its own', () => {
  const css = readFileSync(resolve(root, 'src/theme.css'), 'utf8')
  expect(css).not.toContain('preflight')
  expect(css).not.toMatch(/@layer base\s*\{[^}]*\*,\s*::after,\s*::before/)
  expect(css).toContain('--accent: #0b6e70') // the tokens, as before
})
