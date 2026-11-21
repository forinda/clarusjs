// @clarusjs/theme-docs: the layout in a real build, used the way a site uses it (config, headings, slots).
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createBuilder } from 'vite'
import { beforeAll, expect, test } from 'vitest'
import clarusjs from 'clarusjs/vite'

let html = ''

beforeAll(async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'theme-docs-'))
  const w = (path: string, text: string) => { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }
  mkdirSync(resolve(root, 'node_modules/@clarusjs'), { recursive: true })
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/@clarusjs/theme-docs'), 'dir')
  symlinkSync(resolve(import.meta.dirname, '../node_modules/clarusjs'), resolve(root, 'node_modules/clarusjs'), 'dir')
  w('src/config.ts', `export const config = {
  brand: { text: 'acme', accent: '.dev' },
  sections: [{ key: 'guide', title: 'Guide', href: '/guide/start', groups: [{ title: 'Basics', items: [{ title: 'Start', href: '/guide/start' }, { title: 'Next', href: '/guide/next' }] }] }],
  social: [{ label: 'GitHub', href: 'https://github.com/acme/x', icon: 'github' }],
  editLink: (path: string) => 'https://example.com/edit' + path,
  footer: 'Acme footer',
}
`)
  const page = (title: string, path: string, body: string) => `@import layout from '@clarusjs/theme-docs/layout.tscl'\n@import { config } from '../../config.ts'\n<layout [config]="config" [title]="'${title}'" [path]="'${path}'" [headings]="[{ id: 'one', text: 'One', level: 2 }, { id: 'two', text: 'Two', level: 3 }]">${body}</layout>\n`
  w('src/pages/guide/start.tscl', page('Start', '/guide/start', "<h1>Start</h1><h2 id=\"one\">One</h2>@slot('sidebar-top') {<p class=\"promo\">Promo</p>}@slot('footer') {<p>Custom footer</p>}"))
  w('src/pages/guide/next.tscl', page('Next', '/guide/next', '<h1>Next</h1>'))
  w('src/pages/index.tscl', "@import layout from '@clarusjs/theme-docs/layout.tscl'\n@import { config } from '../config.ts'\n<layout [config]=\"config\" [title]=\"'Home'\"><h1>Home</h1></layout>\n")
  await (await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [clarusjs()] })).buildApp()
  html = readFileSync(resolve(root, 'dist/client/guide/start/index.html'), 'utf8')
}, 120_000)

test('header: brand, section links with the current one marked, social icon links, ⋯ menu, ☰ for the drawer', () => {
  expect(html).toMatch(/<a class="brand" href="\/"><span>acme<span class="js">\.dev<\/span><\/span><\/a>/)
  expect(html).toContain('<a href="/guide/start" aria-current="true">Guide</a>')
  expect(html).toMatch(/<a href="https:\/\/github\.com\/acme\/x" aria-label="GitHub" title="GitHub">\s*<svg/)
  expect(html).toContain('popovertarget="more"')
  expect(html).toContain('<button type="button" class="menu-button" popovertarget="sidebar" aria-label="Open menu">')
})

test('sidebar: a popover nav with the current page, slots, and the header links for phones', () => {
  expect(html).toMatch(/<nav id="sidebar" class="sidebar" aria-label="Pages" popover>/)
  expect(html).toContain('<a href="/guide/start" aria-current="page">Start</a>')
  expect(html).toContain('<p class="promo">Promo</p>')
  expect(html).toMatch(/<div class="sidebar-links">.*GitHub/s)
})

test('content and "On this page": crumb, both forms of the table of contents, edit link, pager, footer slot', () => {
  expect(html).toContain('<p class="crumb">Guide › Basics</p>')
  expect(html).toMatch(/<aside class="toc" aria-label="On this page">.*<a href="#one">One<\/a>.*<li class="sub"><a href="#two">Two<\/a>/s)
  expect(html).toMatch(/<details class="toc-inline">\s*<summary>On this page<\/summary>/)
  expect(html).toContain('<a class="edit" href="https://example.com/edit/guide/start">')
  expect(html).toMatch(/<a class="next" href="\/guide\/next"><small>Next<\/small>Next<\/a>/)
  expect(html).toContain('<footer class="site-footer"><p>Custom footer</p></footer>')
})
