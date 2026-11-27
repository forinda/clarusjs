// #43: fenced code is highlighted at build time with Shiki: dual themes via CSS variables, notation, code groups.
import { expect, test } from 'vitest'
import { compile } from 'clarusjs/compiler'
import markdown from '../src/index.ts'

const md = (code: string, options = {}) => markdown(options).toTscl(code, '/a/src/pages/x.md', { route: '/x', root: '/a', addDependency: () => {} })

test('a fenced block is highlighted with light and dark colours as CSS variables, no inline colours', () => {
  const out = md('```ts\nconst a: number = 1\n```\n')
  expect(out).toMatch(/^<div class="code-block language-ts"><span class="lang">ts<\/span><pre class="shiki shiki-themes github-light-default github-dark-default"/)
  expect(out).toContain('--shiki-light:')
  expect(out).toContain('--shiki-dark:')
  expect(out).not.toMatch(/style="color:/)
})

test('tscl blocks are highlighted as templates, and stay static text that compiles', () => {
  const out = md('```tscl\n@if (on) { <b [x]="y">{{ n }}</b> }\n```\n')
  expect(out).toContain('<div class="code-block language-tscl">')
  expect(out).not.toMatch(/\{\{|@if/) // escaped: shown as text
  expect(out).toMatch(/--shiki-light:[^"]*">&#64;if</)
  expect(() => compile(out, { file: 'x.tscl', target: 'server' })).not.toThrow()
})

test('notation: {2} highlights a line; [!code ++] marks a diff line and the comment is removed', () => {
  const lines = md('```ts {2}\na()\nb()\n```\n').match(/<span class="line[^"]*">/g)!
  expect(lines).toEqual(['<span class="line">', '<span class="line highlighted">'])
  const diff = md('```ts\nold() // [!code --]\nnew() // [!code ++]\n```\n')
  expect(diff).toContain('<span class="line diff remove">')
  expect(diff).toContain('<span class="line diff add">')
  expect(diff).not.toContain('[!code')
})

test('an unknown language is plain escaped text; a title and :line-numbers are supported', () => {
  const out = md('```nope\n<a> & {{ b }}\n```\n')
  expect(out).toContain('<div class="code-block language-nope">')
  expect(out).toContain('&#x3C;a> &#x26; &#123;&#123; b }}')
  const titled = md('```ts [vite.config.ts] :line-numbers\na()\nb()\n```\n')
  expect(titled).toContain('<div class="code-block language-ts line-numbers"><p class="code-title">vite.config.ts</p><span class="lang">ts</span>')
  expect(titled).toContain('<div class="line-numbers-column" aria-hidden="true"><span>1</span><span>2</span></div>')
})

test('::: code-group: radio tabs labelled from the titles, the first checked; no JavaScript needed', () => {
  const out = md('::: code-group\n```sh [pnpm]\npnpm add x\n```\n```sh [npm]\nnpm install x\n```\n:::\n')
  expect(out).toMatch(/^<div class="code-group"><input type="radio" name="cl-group-0" id="cl-group-0-0" checked><label for="cl-group-0-0">pnpm<\/label><div class="code-block language-sh">/)
  expect(out).toContain('<input type="radio" name="cl-group-0" id="cl-group-0-1"><label for="cl-group-0-1">npm</label>')
  expect(out.trimEnd()).toMatch(/<\/div>\n?<\/div>$/)
})

test('with copy: { tag, from }, each block gets your copy component', () => {
  const out = md('```ts\na()\n```\n', { copy: { tag: 'copy', from: '/src/components/copy.tscl' } })
  expect(out.split('\n')[0]).toBe("@import copy from '/src/components/copy.tscl'")
  expect(out).toMatch(/<\/pre><copy attach="interaction" \/><\/div>/)
  expect(() => compile(out, { file: 'x.tscl', target: 'server' })).not.toThrow()
})

test('#122: the light theme\'s comments use an AA colour (#59636e), not #6e7781', () => {
  const out = markdown({ layout: false }).toTscl('```ts\n// a comment\n```\n', '/a/src/pages/x.md', { route: '/x', root: '/a', addDependency: () => {} })
  expect(out.toLowerCase()).toContain('--shiki-light:#59636e')
  expect(out.toLowerCase()).not.toContain('#6e7781')
})

test('lineNumbers: true numbers every code block but shell ones; :no-line-numbers opts one out', () => {
  const numbered = (code: string) => md(code, { lineNumbers: true }).includes('line-numbers-column')
  expect(numbered('```ts\na()\n```\n')).toBe(true)
  expect(numbered('```tscl\n<p>x</p>\n```\n')).toBe(true)
  for (const lang of ['sh', 'bash', 'shell', 'zsh', 'console', 'powershell', 'ps1']) expect(numbered('```' + lang + '\nls\n```\n')).toBe(false)
  expect(numbered('```ts :no-line-numbers\na()\n```\n')).toBe(false)
  expect(numbered('```sh :line-numbers\nls\n```\n')).toBe(true) // asked for, on a shell block too
  // Off by default: only :line-numbers numbers a block.
  expect(md('```ts\na()\n```\n').includes('line-numbers-column')).toBe(false)
})

test('lineNumbers: a shell script is numbered (a file title, or a #! line); a command is not', () => {
  const numbered = (code: string) => md(code, { lineNumbers: true }).includes('line-numbers-column')
  expect(numbered('```bash [deploy.sh]\nset -e\npnpm build\n```\n')).toBe(true)
  expect(numbered('```bash\n#!/usr/bin/env bash\nset -e\n```\n')).toBe(true)
  expect(numbered('```sh\npnpm add clarusjs\n```\n')).toBe(false)
})

// A keyword in its own coloured span: highlighted (plain text is one span per line).
const keyword = (out: string, word: string) => new RegExp(`<span style="--shiki-light:#[0-9a-f]{6};--shiki-dark:#[0-9a-f]{6}">${word}</span>`, 'i').test(out)

test('zig is highlighted', () => {
  expect(keyword(md('```zig\nconst std = @import("std");\npub fn main() void {}\n```\n'), 'const')).toBe(true)
})

test('langs: a site adds Shiki grammars of its own (markdown({ langs: [rust] }))', async () => {
  const rust = (await import('shiki/langs/rust.mjs')).default
  const code = '```rust\nfn main() { let x = 1; }\n```\n'
  expect(keyword(md(code, { langs: rust }), 'fn')).toBe(true)
})

test('langs by name: loaded from content\'s own Shiki, so the site installs nothing; an unknown name is a clear error', () => {
  const code = '```go\nfunc main() { var x = 1 }\n```\n'
  expect(keyword(md(code, { langs: ['go'] }), 'func')).toBe(true)
  expect(() => md('', { langs: ['no-such-language'] })).toThrow('@clarusjs/content: Shiki has no grammar "no-such-language"')
  expect(() => md('', { langs: ['../evil'] })).toThrow('@clarusjs/content: Shiki has no grammar "../evil"')
})

test('with mermaid: { tag, from }, a ```mermaid block is its source in <pre class="mermaid">, not highlighted, with your diagram component', () => {
  const out = md('```mermaid\ngraph TD\n  A["{x} @y <b>"] --> B\n```\n\n```ts\na()\n```\n', { mermaid: { tag: 'diagram', from: '@clarusjs/theme-docs/mermaid.tscl' } })
  expect(out.split('\n')[0]).toBe("@import diagram from '@clarusjs/theme-docs/mermaid.tscl'")
  expect(out).toContain('<div class="mermaid-diagram"><pre class="mermaid" tabindex="0">graph TD\n  A[&quot;&#123;x&#125; &#64;y &lt;b&gt;&quot;] --&gt; B</pre><diagram attach="visible" /></div>')
  expect(out).toContain('<div class="code-block language-ts">') // other blocks as before
})

test('without the mermaid option a ```mermaid block is code, as before; with it, a page without diagrams imports nothing', () => {
  expect(md('```mermaid\ngraph TD\n```\n')).toContain('<div class="code-block language-mermaid">')
  expect(md('```ts\na()\n```\n', { mermaid: { tag: 'diagram', from: '/x.tscl' } })).not.toContain('@import diagram')
})

test('a language Shiki has is loaded the first time a page uses it, by name or alias, with no langs option', () => {
  const lua = md('```lua\nlocal x = 1\n```\n')
  expect(lua).toContain('<div class="code-block language-lua">')
  expect(keyword(lua, 'local')).toBe(true)
  expect(keyword(md('```rb\ndef f\nend\n```\n'), 'def')).toBe(true) // Shiki's alias for ruby
})

test('a language Shiki doesn\'t have stays plain text, and a name that isn\'t one never reaches require()', () => {
  expect(md('```notalang\nx\n```\n')).toContain('<span class="line"><span>x</span></span>')
  expect(md('```../../etc\nx\n```\n')).toContain('<span class="line"><span>x</span></span>')
})

test('::: code-group NAME: a named group is marked to sync (data-sync), and with codeGroups: { tag, from } gets your sync component', () => {
  const src = '::: code-group sdk\n```ts [TypeScript]\na()\n```\n```py [Python]\na()\n```\n:::\n\n::: code-group\n```sh [pnpm]\nx\n```\n:::\n'
  const plain = md(src)
  expect(plain).toContain('<div class="code-group" data-sync="sdk"><input type="radio" name="cl-group-0" id="cl-group-0-0" checked>')
  expect(plain).toContain('<div class="code-group"><input type="radio" name="cl-group-1"') // unnamed: as before
  const synced = md(src, { codeGroups: { tag: 'codeTabs', from: '@clarusjs/theme-docs/code-tabs.tscl' } })
  expect(synced.split('\n')[0]).toBe("@import codeTabs from '@clarusjs/theme-docs/code-tabs.tscl'")
  expect(synced.match(/<codeTabs \/>/g)).toHaveLength(1) // in the named group only
  expect(synced).toMatch(/<div class="code-group" data-sync="sdk">[\s\S]*<codeTabs \/><\/div>/)
  expect(md('::: code-group\n```sh [a]\nx\n```\n:::\n', { codeGroups: { tag: 'codeTabs', from: '/x.tscl' } })).not.toContain('@import codeTabs')
  expect(md('::: code-group a"b\n```sh [a]\nx\n```\n:::\n')).toContain('data-sync="a&quot;b"')
})

test('review (#660): a fence named like an object property (constructor, __proto__) is plain text, not a crash', () => {
  for (const name of ['constructor', '__proto__', 'toString']) expect(md('```' + name + '\nx\n```\n')).toContain('<span class="line"><span>x</span></span>')
})

test('review (#660): only a written name syncs a code group, not a default title; any space but a newline separates it', () => {
  const opts = { titles: { 'code-group': 'Examples' }, codeGroups: { tag: 'codeTabs', from: '/x.tscl' } }
  const unnamed = md('::: code-group\n```sh [a]\nx\n```\n:::\n', opts)
  expect(unnamed).not.toContain('data-sync')
  expect(unnamed).not.toContain('codeTabs')
  const nbsp = md('::: code-group sdk\n```sh [a]\nx\n```\n:::\n', opts)
  expect(nbsp).toContain('data-sync="sdk"')
  expect(nbsp.split('\n')[0]).toBe("@import codeTabs from '/x.tscl'")
})
