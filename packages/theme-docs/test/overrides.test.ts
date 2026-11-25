// #361: themeDocs({ components }) replaces a part of the layout with a file of the site's own, checked against the
// part it replaces (the inputs and slots the layout passes).
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createBuilder } from 'vite'
import { expect, test } from 'vitest'
import clarusjs from 'clarusjs/vite'
import { themeDocs } from '../src/vite.js'

const unscoped = (html: string) => html.replace(/ class="cl-c-[\w-]+"/g, '').replace(/ cl-c-[\w-]+(?=[" ])/g, '')

function site(files: Record<string, string>): { root: string; build(components: Record<string, string>): Promise<void> } {
  const root = mkdtempSync(resolve(tmpdir(), 'theme-overrides-'))
  const w = (path: string, text: string) => { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }
  mkdirSync(resolve(root, 'node_modules/@clarusjs'), { recursive: true })
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/@clarusjs/theme-docs'), 'junction')
  symlinkSync(resolve(import.meta.dirname, '../node_modules/clarusjs'), resolve(root, 'node_modules/clarusjs'), 'junction')
  w('src/config.ts', "export const config = { brand: { text: 'acme' }, sections: [{ key: 'guide', title: 'Guide', href: '/guide/start', groups: [{ title: 'Basics', items: [{ title: 'Start', href: '/guide/start' }] }] }], footer: 'Acme footer' }\n")
  w('src/pages/guide/start.tscl', "@import layout from '@clarusjs/theme-docs/layout.tscl'\n@import { config } from '../../config.ts'\n<layout [config]=\"config\" [title]=\"'Start'\" [path]=\"'/guide/start'\"><h1>Start</h1>@slot('sidebar-top') {<p class=\"promo\">Promo</p>}</layout>\n")
  w('src/pages/index.tscl', '<h1>Home</h1>\n') // the brand links here
  for (const [path, text] of Object.entries(files)) w(path, text)
  return {
    root,
    async build(components) {
      await (await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [themeDocs({ components }), clarusjs()] })).buildApp()
    },
  }
}
const page = (root: string) => unscoped(readFileSync(resolve(root, 'dist/client/guide/start/index.html'), 'utf8'))

test("a part replaced by the site's own file: it gets the layout's inputs; the other parts stay the theme's", async () => {
  const s = site({
    'src/theme/header.tscl': "@import type { ThemeConfig } from '@clarusjs/theme-docs/nav.ts'\n@input config: ThemeConfig\n@input path: string = '/'\n@input app: boolean = false\n<header class=\"my-header\">{{ config.brand.text }} at {{ path }}<slot name=\"end\"></slot></header>\n",
    'src/theme/sidebar.tscl': "@import type { ThemeConfig } from '@clarusjs/theme-docs/nav.ts'\n@input config: ThemeConfig\n@input path: string = '/'\n<nav id=\"sidebar\" class=\"my-sidebar\"><slot name=\"top\"></slot><slot name=\"bottom\"></slot></nav>\n",
  })
  await s.build({ header: '/src/theme/header.tscl', sidebar: 'src/theme/sidebar.tscl' })
  const html = page(s.root)
  expect(html).toMatch(/<header class="my-header">acme at \/guide\/start\s*<\/header>/)
  expect(html).not.toContain('class="site-header"')
  expect(html).toMatch(/<nav id="sidebar" class="my-sidebar"><p class="promo">Promo<\/p><\/nav>/) // the layout's slot, forwarded
  expect(html).toContain('<footer class="page-footer">') // not replaced: the theme's
}, 120_000)

test('mistakes are build errors that say what to fix', async () => {
  const s = site({
    'src/theme/header.tscl': "@input config: object\n@input user: string\n<header>{{ user }}</header>\n",
    'src/theme/sidebar.tscl': "@input config: object\n@input path: string = '/'\n<nav><slot name=\"top\"></slot></nav>\n",
  })
  await expect(s.build({ hedaer: '/src/theme/header.tscl' })).rejects.toThrow("themeDocs: components.hedaer isn't a part of the theme; the parts are header, sidebar, contents, pageFooter, footer")
  await expect(s.build({ header: '/src/theme/nope.tscl' })).rejects.toThrow('themeDocs: components.header: no file at /src/theme/nope.tscl')
  await expect(s.build({ header: '/src/theme/header.tscl' })).rejects.toThrow('themeDocs: components.header (/src/theme/header.tscl) requires @input user, which the layout never passes: give it a default, or remove it')
  await expect(s.build({ sidebar: '/src/theme/sidebar.tscl' })).rejects.toThrow('themeDocs: components.sidebar (/src/theme/sidebar.tscl) has no <slot name="bottom">, which the layout fills')
}, 120_000)

test("the query a module is asked for with (?render: the layout rendered in the browser) is kept on the site's file", () => {
  const s = site({ 'src/theme/footer.tscl': '@input config: object\n<footer><slot /></footer>\n' })
  const plugin = themeDocs({ components: { footer: '/src/theme/footer.tscl' } }) as unknown as { configResolved(c: { root: string }): void; resolveId(id: string, importer?: string): string | undefined }
  plugin.configResolved({ root: s.root })
  const layout = resolve(import.meta.dirname, '../src/layout.tscl')
  expect(plugin.resolveId('./parts/footer.tscl', layout)).toBe(resolve(s.root, 'src/theme/footer.tscl'))
  expect(plugin.resolveId('./parts/footer.tscl?render', `${layout}?render`)).toBe(resolve(s.root, 'src/theme/footer.tscl') + '?render')
  expect(plugin.resolveId('./parts/header.tscl', layout)).toBeUndefined() // not replaced: Vite resolves it
})

test("a replacement outside src/ keeps its styles and its island: clarusjs finds it through the theme's plugin", async () => {
  const s = site({
    // Its slot (the layout fills it) and its styles, and an island of its own beside it.
    'theme/footer.tscl': "@import likes from './likes.tscl'\n@input config: object\n<footer class=\"mine\"><slot /><likes /></footer>\n<style scoped>\n  :scope { letter-spacing: 3.25px; }\n</style>\n",
    'theme/likes.tscl': '<script>\n  let n = state(0)\n</script>\n<button type="button" (click)="n++">{{ n }}</button>\n',
  })
  await s.build({ footer: '/theme/footer.tscl' })
  const html = page(s.root)
  expect(html).toMatch(/<cl-island c="likes" src="\/assets\/[^"]+\.js"/) // the island it imports has its client chunk
  const sheets = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => readFileSync(resolve(s.root, 'dist/client', '.' + m[1]), 'utf8')).join('\n')
  expect(sheets).toContain('3.25px')
}, 120_000)
