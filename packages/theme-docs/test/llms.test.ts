// #50: llms.txt (and llms-full.txt) from the docs pages, as llmstxt.org describes.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { llmsFull, llmsTxt } from '../src/vite.js'

const dir = mkdtempSync(resolve(tmpdir(), 'theme-llms-'))
const write = (file: string, text: string) => { mkdirSync(resolve(dir, file, '..'), { recursive: true }); writeFileSync(resolve(dir, file), text) }
write('index.tscl', "<docs [title]=\"'Home'\"><h1>Home</h1></docs>\n")
write('guide/start.md', "---\ntitle: Getting started\ngroup: Introduction\norder: 1\ndescription: Install it and write a page.\n---\n@import pm from '~/components/pm.tscl'\n\n# Getting started\n\nRun `pnpm add clarusjs`.\n")
write('guide/forms.md', '---\ntitle: Forms\ngroup: Interactivity\ndescription: Two-way binding.\n---\n\n# Forms\n\nUse [(value)].\n')
write('guide/hidden.md', '---\ntitle: Secret\nsidebar: false\n---\n\n# Secret\n')
write('tour/[step].tscl', '<p>x</p>\n')
write('404.tscl', '<h1>Not found</h1>\n')
// A page kept out of search engines is kept out of llms.txt too (and the sidebar).
write('view/login.tscl', '<cl-head>\n  <meta name="robots" content="noindex" />\n</cl-head>\n<p>x</p>\n')

test('llms.txt: title, summary, then each sidebar group with its pages, linked, with their descriptions', () => {
  const text = llmsTxt(dir, { title: 'clarusjs', summary: 'A compiler for islands.', site: 'https://clarusjs.com' })
  expect(text).toBe(`# clarusjs

> A compiler for islands.

## Introduction

- [Getting started](https://clarusjs.com/guide/start): Install it and write a page.

## Interactivity

- [Forms](https://clarusjs.com/guide/forms): Two-way binding.

## Other pages

- [Home](https://clarusjs.com/)
`)
})

test('llms-full.txt: every listed page, Markdown pages as their Markdown (no frontmatter, no imports)', () => {
  const text = llmsFull(dir, { title: 'clarusjs', summary: 'A compiler for islands.', site: 'https://clarusjs.com' }, (href) => (href === '/' ? 'Home page text.' : ''))
  expect(text.startsWith('# clarusjs\n\n> A compiler for islands.\n')).toBe(true)
  expect(text).toContain('Source: https://clarusjs.com/guide/start\n\n# Getting started\n\nRun `pnpm add clarusjs`.')
  expect(text).not.toContain('@import')
  expect(text).not.toContain('description: Install')
  expect(text).toContain('Source: https://clarusjs.com/\n\nHome page text.') // a template page: its rendered text
  expect(text).not.toContain('Secret')
  expect(text).not.toContain('Not found')
})

test('without a site, links are root-relative', () => {
  expect(llmsTxt(dir, { title: 't' })).toContain('- [Forms](/guide/forms): Two-way binding.')
})
