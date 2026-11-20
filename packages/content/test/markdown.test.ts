// #42: Markdown pages become .tscl text: static HTML inside the layout, with components and anchors.
import { expect, test } from 'vitest'
import { compile } from 'clarusjs/compiler'
import markdown, { slugify } from '../src/index.ts'

const md = markdown({ layout: '/src/layouts/docs.tscl' })
const page = (code: string, route = '/guide/intro') => md.toTscl(code, '/app/src/pages/guide/intro.md', { route, root: '/a', addDependency: () => {} })

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
  expect(out).toContain('<h1 id="getting-started" tabindex="-1">Getting started</h1>') // the title has no anchor link
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
  expect(markdown().toTscl('Plain.\n', '/a/src/pages/x.md', { route: '/x', root: '/a', addDependency: () => {} })).toBe('<p>Plain.</p>\n')
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

test('heading ids never collide, even with a heading that looks like a numbered duplicate', () => {
  const ids = [...page('## Same\n\n## Same\n\n## Same-1\n').matchAll(/<h2 id="([^"]+)"/g)].map((m) => m[1])
  expect(ids).toEqual(['same', 'same-1', 'same-1-1'])
})

test('component tags inside code spans and fences stay literal text', () => {
  const out = page("@import note from '../../components/note.tscl'\n\nUse `<note>` like this:\n\n```html\n<note [kind]=\"'tip'\">Hi</note>\n```\n\n<note>Real</note>\n")
  expect(out).toContain('<code>&lt;note&gt;</code>')
  // The fence is highlighted: its text (tags stripped) is the example as written.
  expect(out.replace(/<[^>]+>/g, '')).toContain('&#x3C;note [kind]="\'tip\'">Hi&#x3C;/note>')
  expect(out).toContain('<note>Real</note>')
  expect(out).not.toContain('cl-tag')
})

test('cl-layout is reserved for the generated layout import', () => {
  expect(() => page("@import cl-layout from '../../components/x.tscl'\n\nHi\n")).toThrow(/cl-layout is reserved/)
})

test('#113: relative links to page source files become their routes (anchors kept); others are left alone', () => {
  const out = markdown().toTscl(
    '[a](./setup.md) [b](../index.md#top) [c](./api/index.tscl) [d](/guide/x) [e](https://x.dev/y.md) [f](./notes.txt) [g](../../outside.md)',
    '/app/src/pages/guide/intro.md', { route: '/guide/intro', root: '/app', addDependency: () => {} },
  )
  expect(out).toContain('<a href="/guide/setup">a</a>')
  expect(out).toContain('<a href="/#top">b</a>')
  expect(out).toContain('<a href="/guide/api">c</a>')
  expect(out).toContain('<a href="/guide/x">d</a>')
  expect(out).toContain('<a href="https://x.dev/y.md">e</a>')
  expect(out).toContain('<a href="./notes.txt">f</a>')
  expect(out).toContain('<a href="../../outside.md">g</a>') // not a page: left for the link checker to report
})

test('CRLF: a closing fence with \\r\\n still ends the code, so later component tags are protected', () => {
  const out = page("@import note from '../../components/note.tscl'\r\n\r\n```html\r\n<b>x</b>\r\n```\r\n\r\n<note [kind]=\"'tip'\">Hi</note>\r\n")
  expect(out).toContain(`<note [kind]="'tip'">Hi</note>`)
})

test('#115: frontmatter head tags and titleTemplate: false become <cl-head>', () => {
  const out = page('---\ntitle: Home\ntitleTemplate: false\nhead:\n  - [meta, { name: robots, content: noindex }]\n  - [link, { rel: alternate, href: "/feed.xml?a=1&b={{x}}" }]\n---\n# Home\n')
  expect(out).toContain('<cl-head><title>Home</title><meta name="robots" content="noindex"><link rel="alternate" href="/feed.xml?a=1&amp;b=&#123;&#123;x}}"></cl-head>')
  expect(() => compile(out.replace(/^@import.*\n/, '').replace(/<\/?cl-layout[^>]*>/g, ''), { file: 'x.tscl', target: 'server' })).not.toThrow()
  expect(page('---\ntitle: Plain\n---\nx\n')).not.toContain('cl-head')
})

test('frontmatter jsonLd becomes JSON-LD scripts in <cl-head>, as JSON the template leaves alone', () => {
  const out = page('---\ntitle: T\njsonLd:\n  "@context": https://schema.org\n  "@type": Article\n  headline: "{{ not a hole }} </script>"\n---\nx\n')
  expect(out).toContain('<cl-head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"{\\u007b not a hole }} \\u003c/script\\u003e"}</script></cl-head>')
  // The JSON survives the template compiler unchanged.
  expect(compile(out.replace(/^@import.*\n/, '').replace(/<\/?cl-layout[^>]*>/g, ''), { file: 'x.tscl', target: 'server' }).code).toContain('\\\\u007b not a hole')
})
