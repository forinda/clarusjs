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

test('no layout renders the bare HTML (folder layouts still wrap it); layout: false in frontmatter, none at all; strings are quoted safely', () => {
  expect(markdown().toTscl('Plain.\n', '/a/src/pages/x.md', { route: '/x', root: '/a', addDependency: () => {} })).toBe('<p>Plain.</p>\n')
  expect(page('---\nlayout: false\n---\nPlain.\n')).toBe('@layout none\n<p>Plain.</p>\n')
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

test('#116: frontmatter image is the page social card image', () => {
  expect(page('---\ntitle: T\nimage: /cards/t.png\n---\nx\n')).toContain('<cl-head><meta property="og:image" content="/cards/t.png"></cl-head>')
})

test('frontmatter sitemap: false opts the page out of the sitemap', () => {
  expect(page('---\ntitle: T\nsitemap: false\n---\nx\n')).toContain('<cl-head><meta name="sitemap" content="false"></cl-head>')
})

test('review: frontmatter head scripts keep their content exactly (JSON-LD, inline code) and compile', async () => {
  const out = page(`---\ntitle: T\nhead:\n  - [script, { type: application/ld+json }, '{"@type":"Article","name":"a {{ b }} @c"}']\n  - [script, { async: true, src: "https://x.dev/a.js" }]\n  - [script, {}, "window.x = 'a@b' && 1 < 2"]\n---\nx\n`)
  const code = compile(out.replace(/^@import.*\n/, '').replace(/<\/?cl-layout[^>]*>/g, ''), { file: 'x.tscl', target: 'server' }).code
  const { render } = await import(`data:text/javascript,${encodeURIComponent(code.replace(/from 'clarusjs\/runtime\/server'/, `from '${new URL('../../clarusjs/src/runtime/server.ts', import.meta.url).href}'`))}`)
  const html = render({})
  expect(html).toContain('<script type="application/ld+json">{"@type":"Article","name":"a {\\u007b b }} @c"}</script>')
  expect(html).toContain('<script async src="https://x.dev/a.js"></script>')
  expect(html).toContain("<script>window.x = 'a@b' && 1 < 2</script>")
})

test('review: a frontmatter title with {{ }} and @ stays text in <cl-head>', () => {
  const out = page('---\ntitle: "Use {{ x }} @if"\ntitleTemplate: false\n---\nx\n')
  expect(out).toContain('<cl-head><title>Use &#123;&#123; x }} &#64;if</title></cl-head>')
})

test('#124: the layout gets the page headings (h2, h3) for its "On this page"', () => {
  const out = page("# Title\n\n## First part\n\n### A detail\n\n## Second 'part'\n\n#### Too deep\n")
  expect(out).toContain(`[headings]="[{ id: 'first-part', text: 'First part', level: 2 }, { id: 'a-detail', text: 'A detail', level: 3 }, { id: 'second-part', text: 'Second \\'part\\'', level: 2 }]"`)
})

test('#157: steps: true wraps each h2 and what follows it in a <section class="step">, the intro stays outside', () => {
  const out = page('---\ntitle: Lesson\nsteps: true\n---\n# Lesson\n\nIntro.\n\n## Read\n\nText.\n\n### Detail\n\nMore.\n\n## Write\n\n```js\nx\n```\n')
  expect(out).toMatch(/<h1 id="lesson" tabindex="-1">Lesson<\/h1>\n<p>Intro\.<\/p>\n<section class="step" aria-labelledby="read">\n<h2 id="read"/)
  expect(out).toMatch(/<p>More\.<\/p>\n<\/section>\n<section class="step" aria-labelledby="write">\n<h2 id="write"/)
  expect(out).toMatch(/<\/pre><\/div>\n<\/section>\n<\/cl-layout>/)
  expect(out.match(/<section/g)).toHaveLength(2)
  expect(() => compile(out.replace(/^@import.*\n/, '').replace(/<\/?cl-layout[^>]*>/g, ''), { file: 'x.tscl', target: 'server' })).not.toThrow()
  // Without it, no sections.
  expect(page('# A\n\n## B\n\nx\n')).not.toContain('<section')
})

test('#168: headings (On this page, lesson steps) are top-level only: a ## inside a blockquote is neither', () => {
  const out = page('---\nsteps: true\n---\n# L\n\n## Read\n\n> ## Note\n> quoted\n\n## Write\n\nx\n')
  expect(out).toContain(`[headings]="[{ id: 'read', text: 'Read', level: 2 }, { id: 'write', text: 'Write', level: 2 }]"`)
  expect(out.match(/<section class="step"/g)).toHaveLength(2)
})

test('a verbatim element is left as written: its text is already shown as text, so it is not escaped twice', () => {
  const out = page('<p class="lead"><code verbatim>{{ }} @if</code> holes, and {{ x }} outside.</p>\n')
  expect(out).toContain('<code verbatim>{{ }} @if</code> holes, and &#123;&#123; x }} outside.')
  // The page shows {{ }} @if in the code element (not &#123;…), and the entities elsewhere decode to {{ x }}.
  const { code } = compile(out.replace(/^@import.*\n/, '').replace(/<\/?cl-layout[^>]*>/g, ''), { file: 'x.tscl', target: 'server' })
  expect(code).toContain('<code>{{ }} @if</code> holes, and &#123;&#123; x }} outside.')
})

test('only a real verbatim attribute keeps an element as written, and never its opening tag', () => {
  const out = page('<p verbatim-x="1">{{ a }}</p>\n\n<p title="verbatim">{{ b }}</p>\n\n<code verbatim title="{{ c }} @d">{{ e }}</code>\n')
  expect(out).toContain('<p verbatim-x="1">&#123;&#123; a }}</p>')
  expect(out).toContain('<p title="verbatim">&#123;&#123; b }}</p>')
  expect(out).toContain('<code verbatim title="&#123;&#123; c }} &#64;d">{{ e }}</code>')
})

test('#390: frontmatter lastmod becomes the sitemap:lastmod marker (the build uses it, then strips it)', () => {
  expect(page('---\ntitle: News\nlastmod: 2026-11-01\n---\n# News\n')).toContain('<cl-head><meta name="sitemap:lastmod" content="2026-11-01"></cl-head>')
  expect(page("---\ntitle: News\nlastmod: '2026-11-01T09:30:00Z'\n---\n# News\n")).toContain('content="2026-11-01T09:30:00Z"')
})

test('#396 review: an empty lastmod still becomes a marker, so the build rejects it rather than using git\'s date', () => {
  expect(page("---\ntitle: News\nlastmod: ''\n---\n# News\n")).toContain('<meta name="sitemap:lastmod" content="">')
})

test('without a layout to pass them to, the title (templated) and description go in the page head', () => {
  const bare = markdown({}).toTscl('---\ntitle: Notes\ndescription: "A plain page"\n---\n\n# Notes\n', '/app/src/pages/notes.md', { route: '/notes', root: '/a', addDependency: () => {} })
  expect(bare).toContain('<cl-head><title data-cl-template>Notes</title><meta name="description" content="A plain page"></cl-head>')
  // layout: false too; titleTemplate: false keeps the title as written.
  const off = markdown({ layout: '/src/layouts/docs.tscl' }).toTscl('---\nlayout: false\ntitle: Bare\ntitleTemplate: false\n---\n\nHi\n', '/app/src/pages/bare.md', { route: '/bare', root: '/a', addDependency: () => {} })
  expect(off).toContain('<cl-head><title>Bare</title></cl-head>')
  // With a layout, they go to it as before, not into the head.
  expect(page('---\ntitle: Intro\ndescription: d\n---\n\nHi\n')).not.toContain('<cl-head>')
})
