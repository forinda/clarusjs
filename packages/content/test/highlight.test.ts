// #43: fenced code is highlighted at build time with Shiki: dual themes via CSS variables, notation, code groups.
import { expect, test } from 'vitest'
import { compile } from 'clarusjs/compiler'
import markdown from '../src/index.ts'

const md = (code: string, options = {}) => markdown(options).toTscl(code, '/a/src/pages/x.md', { route: '/x' })

test('a fenced block is highlighted with light and dark colours as CSS variables, no inline colours', () => {
  const out = md('```ts\nconst a: number = 1\n```\n')
  expect(out).toMatch(/^<div class="code-block language-ts"><span class="lang">ts<\/span><pre class="shiki shiki-themes github-light github-dark"/)
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
