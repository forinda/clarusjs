// #368: the theme's stylesheet is written with Tailwind (src/styles/theme.css) and built to the plain src/theme.css the
// package ships. Sites need no Tailwind; the tokens still restyle everything.
import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { expect, test } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const cli = resolve(dirname(createRequire(import.meta.url).resolve('@tailwindcss/cli/package.json')), 'dist/index.mjs')
/** The built stylesheet, written to a file as `pnpm css` writes it (stdout ends with one more newline). */
const build = (input: string) => {
  const out = resolve(mkdtempSync(resolve(tmpdir(), 'theme-css-')), 'theme.css')
  execFileSync(process.execPath, [cli, '-i', input, '-o', out], { cwd: root, stdio: 'ignore' })
  return readFileSync(out, 'utf8')
}

test('src/theme.css is the build of src/styles/theme.css (run pnpm css after editing the source)', () => {
  expect(readFileSync(resolve(root, 'src/theme.css'), 'utf8')).toBe(build('src/styles/theme.css'))
})

test("a Tailwind class used in one of the theme's components is built, on the theme's tokens", () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'theme-styles-'))
  cpSync(resolve(root, 'src/styles'), resolve(dir, 'styles'), { recursive: true })
  writeFileSync(resolve(dir, 'part.tscl'), '<nav class="tw:bg-accent-soft tw:text-muted tw:font-mono" hidden>visible block contents</nav>\n')
  const css = execFileSync(process.execPath, [cli, '-i', resolve(dir, 'styles/theme.css')], { encoding: 'utf8', cwd: dir })
  expect(css).toMatch(/\.tw\\:bg-accent-soft \{\s*background-color: var\(--accent-soft\);/)
  expect(css).toMatch(/\.tw\\:text-muted \{\s*color: var\(--muted\);/)
  expect(css).toMatch(/\.tw\\:font-mono \{\s*font-family: var\(--mono\);/)
  // Plain words in the markup are not utilities: they would meet a site's own class names (.hidden, .block…).
  expect(css).not.toMatch(/^\s*\.(hidden|visible|block|contents) \{/m)
})

test('no Tailwind reset: the theme keeps its own base styles, and a site its own', () => {
  const css = readFileSync(resolve(root, 'src/theme.css'), 'utf8')
  expect(css).not.toContain('preflight')
  expect(css).not.toMatch(/@layer base\s*\{[^}]*\*,\s*::after,\s*::before/)
  expect(css).toContain('--accent: #0b6e70') // the tokens, as before
})
