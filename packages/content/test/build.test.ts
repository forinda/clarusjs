// #42: a Vite build of an app with Markdown pages, through the clarusjs plugin.
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createBuilder } from 'vite'
import { expect, test } from 'vitest'
import clarusjs from 'clarusjs/vite'
import markdown from '../src/index.ts'

test('Markdown pages build to static HTML in their layout, with components, styles and anchors', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'clarusjs-content-'))
  const w = (path: string, text: string) => { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }
  w('src/styles/base.css', 'main { max-width: 40rem; }\n')
  w('src/layouts/docs.tscl', "@import '../styles/base.css'\n@input title: string = ''\n@input path: string = '/'\n<html><head><title>{{ title }}</title></head><body><main data-path=\"{{ path }}\"><slot /></main></body></html>\n")
  w('src/components/note.tscl', '@input kind: string = "info"\n<aside class="note {{ kind }}"><slot /></aside>\n<style>\n  :scope { padding: 1rem; }\n</style>\n')
  w('src/pages/guide/intro.md', "---\ntitle: Intro\n---\n@import note from '../../components/note.tscl'\n\n# Hello\n\nUse `{{ x }}` in templates.\n\n<note [kind]=\"'tip'\">\n\nA **tip**.\n\n</note>\n")
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '../../clarusjs'), resolve(root, 'node_modules/clarusjs'), 'dir')
  await (await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [clarusjs({ sources: [markdown({ layout: '/src/layouts/docs.tscl' })] })] })).buildApp()
  const html = readFileSync(resolve(root, 'dist/client/guide/intro/index.html'), 'utf8')
  expect(html).toContain('<title>Intro</title>')
  expect(html).toContain('<main data-path="/guide/intro">')
  expect(html).toContain('<h1 id="hello" tabindex="-1">Hello <a class="header-anchor" href="#hello" aria-label="Permalink to Hello">#</a></h1>')
  expect(html).toContain('<p>Use <code>&#123;&#123; x }}</code> in templates.</p>') // shown as text, not a hole
  expect(html).toMatch(/<aside class="note tip" data-cl-c="note-[a-z0-9]+">\s*<p>A <strong>tip<\/strong>\.<\/p>\s*<\/aside>/)
  // The layout's imported stylesheet and the component styles are linked.
  expect(html).toMatch(/<link rel="stylesheet" href="\/assets\/[^"]*base-[\w-]+\.css"><link rel="stylesheet" href="\/assets\/cl-styles-/)
}, 120_000)
