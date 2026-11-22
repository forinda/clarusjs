#!/usr/bin/env node
// The class names in the theme's templates, for Tailwind to build utilities from (pnpm css). Tailwind reads this list,
// not the templates: it would read every word in them (comments and text too) and build .hidden, .block…, which would
// then meet a site's own class names. Only static class="…" values; a {{ hole }} inside one is skipped.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** @param {string} dir @returns {string[]} the sorted class names used in dir's .tscl files */
export function classes(dir) {
  const names = new Set()
  for (const file of readdirSync(dir, { recursive: true, encoding: 'utf8' })) {
    if (!file.endsWith('.tscl')) continue
    const text = readFileSync(join(dir, file), 'utf8').replace(/\{\{--[\s\S]*?--\}\}/g, '')
    for (const [, value] of text.matchAll(/(?<![\w[-])class="([^"]*)"/g)) {
      for (const name of value.replace(/\{\{[\s\S]*?\}\}/g, ' ').split(/\s+/)) if (name) names.add(name)
    }
  }
  return [...names].sort()
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const out = resolve(root, 'node_modules/.cache/theme-docs/classes.txt')
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, classes(resolve(root, 'src')).join('\n') + '\n')
}
