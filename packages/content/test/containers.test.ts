// #111: ::: containers and GitHub alerts render to static HTML, or through your own component.
import { expect, test } from 'vitest'
import { compile } from 'clarusjs/compiler'
import markdown from '../src/index.ts'

const html = (code: string, options = {}) => markdown(options).toTscl(code, '/a/src/pages/x.md', { route: '/x', root: '/a', addDependency: () => {} })

test('::: tip with the default title, and a custom title', () => {
  expect(html('::: tip\nUse **this**.\n:::\n')).toBe('<div class="custom-block tip"><p class="custom-block-title">Tip</p>\n<p>Use <strong>this</strong>.</p>\n</div>\n')
  expect(html('::: warning Read this first\nCareful.\n:::\n')).toContain('<div class="custom-block warning"><p class="custom-block-title">Read this first</p>')
})

test('::: details is a native <details>; containers nest; unknown types stay text', () => {
  expect(html('::: details Show me\nHidden.\n:::\n')).toBe('<details class="custom-block details"><summary>Show me</summary>\n<p>Hidden.</p>\n</details>\n')
  expect(html(':::: info\nOuter.\n\n::: tip\nInner.\n:::\n::::\n')).toMatch(/<div class="custom-block info">[\s\S]*<div class="custom-block tip">[\s\S]*Inner[\s\S]*<\/div>\n<\/div>/)
  expect(html('::: nope\nx\n:::\n')).toContain('<p>::: nope')
})

test('GitHub alerts map to the same blocks', () => {
  expect(html('> [!NOTE]\n> Remember this.\n')).toBe('<div class="custom-block info"><p class="custom-block-title">Note</p>\n<p>Remember this.</p>\n</div>\n')
  expect(html('> [!CAUTION]\n> Danger zone.\n')).toContain('<div class="custom-block danger"><p class="custom-block-title">Caution</p>')
  expect(html('> Just a quote.\n')).toBe('<blockquote>\n<p>Just a quote.</p>\n</blockquote>\n')
})

test('titles can be localized', () => {
  expect(html('::: tip\nx\n:::\n', { titles: { tip: 'Astuce' } })).toContain('<p class="custom-block-title">Astuce</p>')
})

test('with a container component, blocks render through it; a title fills its title slot', () => {
  const opts = { layout: false as const, container: { tag: 'callout', from: '/src/components/callout.tscl' } }
  const out = markdown(opts).toTscl('::: tip\nUse it.\n:::\n\n::: danger Watch {{ out }} @here\nx\n:::\n', '/a/src/pages/x.md', { route: '/x', root: '/a', addDependency: () => {} })
  expect(out.split('\n')[0]).toBe("@import callout from '/src/components/callout.tscl'")
  // Every block passes its resolved title (the type's default, a configured title or an alert's name).
  expect(out).toContain('<callout [type]="\'tip\'">@slot(\'title\') {Tip}\n<p>Use it.</p>\n</callout>')
  expect(out).toContain("<callout [type]=\"'danger'\">@slot('title') {Watch &#123;&#123; out &#125;&#125; &#64;here}")
  expect(() => compile(out, { file: 'x.tscl', target: 'server' })).not.toThrow()
  // details stays a native <details> even with a component.
  expect(markdown(opts).toTscl('::: details\nx\n:::\n', '/a/src/pages/x.md', { route: '/x', root: '/a', addDependency: () => {} })).toContain('<details class="custom-block details"><summary>Details</summary>')
})

test('a ::: inside a fenced example does not close the container', () => {
  expect(html('::: tip\n```text\n:::\n```\n\nStill inside.\n:::\n')).toMatch(/<div class="custom-block tip">[\s\S]*<p>Still inside\.<\/p>\n<\/div>\n$/)
})
