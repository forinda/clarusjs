// #42: Markdown pages become .tscl text: static HTML inside the layout, with components and anchors.
import { expect, test } from 'vitest'
import { compile } from 'clarusjs/compiler'
import markdown, { slugify } from '../src/index.ts'

const md = markdown({ layout: '/src/layouts/docs.tscl' })
const page = (code: string, route = '/guide/intro') => md.toTscl(code, '/app/src/pages/guide/intro.md', { route })

test('frontmatter title and description go to the layout, with the route as path', () => {
  const out = page('---\ntitle: Intro\ndescription: "What it is, and why"\n---\n\nHello *world*.\n')
  expect(out).toBe([
    "@import cl-layout from '/src/layouts/docs.tscl'",
    '<cl-layout [title]="\'Intro\'" [description]="\'What it is, and why\'" [path]="\'/guide/intro\'"><p>Hello <em>world</em>.</p>',
    '</cl-layout>',
    '',
  ].join('\n'))
})

test('without a title in frontmatter, the first heading is the title; headings get ids and anchor links', () => {
  const out = page('# Getting started\n\n## Install it\n')
  expect(out).toContain('[title]="\'Getting started\'"')
  expect(out).toContain('<h1 id="getting-started" tabindex="-1">Getting started <a class="header-anchor" href="#getting-started" aria-label="Permalink to Getting started">#</a></h1>')
  expect(out).toContain('<h2 id="install-it" tabindex="-1">Install it <a class="header-anchor" href="#install-it" aria-label="Permalink to Install it">#</a></h2>')
})

test('template syntax in prose and code stays text: holes, directives and braces are escaped', () => {
  const out = page('Write `{{ count }}` or {{ x }}.\n\n@if is a directive.\n\n```\n{{ y }}\n@for (a of b) {}\n```\n')
  expect(out).not.toMatch(/\{\{/)
  expect(out).toContain('&#123;&#123; count }}')
  expect(out).toContain('<p>&#64;if is a directive.</p>')
  expect(out).not.toMatch(/@(if|for)\b/)
  // It still compiles: nothing in the output is read as a template.
  expect(() => compile(out, { file: 'x.tscl', target: 'server' })).not.toThrow()
})

test('@import lines at the top pass through, so components can be used in the Markdown', () => {
  const out = page("@import callout from '../../components/callout.tscl'\n\n# Title\n\n<callout [type]=\"'tip'\">\n\nMarkdown **inside**.\n\n</callout>\n")
  expect(out.split('\n').slice(0, 2)).toEqual(["@import cl-layout from '/src/layouts/docs.tscl'", "@import callout from '../../components/callout.tscl'"])
  expect(out).toContain('<callout [type]="\'tip\'">\n<p>Markdown <strong>inside</strong>.</p>\n</callout>')
})

test('layout: false in frontmatter (or no layout) renders the bare HTML; strings are quoted safely', () => {
  expect(markdown().toTscl('Plain.\n', '/a/src/pages/x.md', { route: '/x' })).toBe('<p>Plain.</p>\n')
  expect(page('---\nlayout: false\n---\nPlain.\n')).toBe('<p>Plain.</p>\n')
  const tricky = page('---\ntitle: "It\'s a \\"quote\\" \\\\ here"\n---\nx\n')
  expect(tricky).toContain('[title]="\'It\\\'s a \\u0022quote\\u0022 \\\\ here\'"')
})

test('slugify: lowercase words joined with dashes; duplicates numbered', () => {
  expect(slugify('Hello, World!')).toBe('hello-world')
  expect(slugify('  CSS & @scope  ')).toBe('css-scope')
  const out = page('## Same\n\n## Same\n')
  expect(out).toContain('id="same"')
  expect(out).toContain('id="same-1"')
})
