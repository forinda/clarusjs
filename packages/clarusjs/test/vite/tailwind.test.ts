// #146: Tailwind CSS v4 through its official Vite plugin, with no clarusjs-specific setup.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { createBuilder } from 'vite'
import { beforeAll, expect, test } from 'vitest'
import clarusjs from '../../src/vite/plugin.ts'

let root = ''
let css = ''
let html = ''

beforeAll(async () => {
  root = mkdtempSync(resolve(tmpdir(), 'clarus-tailwind-'))
  const w = (path: string, text: string) => { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }
  w('src/styles/app.css', '@import "tailwindcss";\n')
  w('src/layouts/main.tscl', "@import '../styles/app.css'\n<html><head><title>T</title></head><body class=\"bg-slate-50 p-4\"><slot /></body></html>\n")
  w('src/components/card.tscl', '<section class="card"><slot /></section>\n<style scoped>\n  @reference "../styles/app.css";\n  :scope { @apply rounded-lg p-6 shadow-md; }\n</style>\n')
  w('src/components/toggle.tscl', "<script>\n  let on = state(false)\n</script>\n<button [class]=\"on ? 'bg-emerald-500 text-white' : 'bg-zinc-200'\" (click)=\"on = !on\">toggle</button>\n")
  w('src/pages/index.tscl', [
    "@import layout from '../layouts/main.tscl'",
    "@import card from '../components/card.tscl'",
    "@import toggle from '../components/toggle.tscl'",
    '<layout><main><h1 class="text-3xl font-bold underline">Hi</h1><card>c</card><toggle /></main></layout>',
  ].join('\n'))
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '../..'), resolve(root, 'node_modules/clarusjs'), 'dir')
  await (await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [tailwindcss(), clarusjs()] })).buildApp()
  const assets = resolve(root, 'dist/client/assets')
  css = (readdirSync(assets, { recursive: true }) as string[]).filter((f) => f.endsWith('.css')).map((f) => readFileSync(resolve(assets, f), 'utf8')).join('\n')
  html = readFileSync(resolve(root, 'dist/client/index.html'), 'utf8')
}, 120_000)

test('utilities used in templates are generated, and the page links the stylesheet', () => {
  for (const cls of ['text-3xl', 'font-bold', 'underline', 'bg-slate-50', 'p-4']) expect(css, cls).toContain(`.${cls}`)
  expect(html).toMatch(/<link rel="stylesheet" href="\/assets\/[^"]+\.css">/)
})

test('classes only in an island binding (client-side branches) are generated too', () => {
  for (const cls of ['bg-emerald-500', 'text-white', 'bg-zinc-200']) expect(css, cls).toContain(`.${cls}`)
})

test('a scoped <style> can @apply utilities through @reference', () => {
  // Minified: @scope(.cl-c-card-x) to ([class*=cl-c-]:not(.cl-c-card-x)>*){:scope{border-radius:…}}
  expect(css).toMatch(/@scope\s*\(\.cl-c-card-[a-z0-9]+\)\s*to\s*\(\[class\*="?cl-c-"?\]:not\(\.cl-c-card-[a-z0-9]+\)\s*>\s*\*\)\s*\{\s*:scope\s*\{[^}]*border-radius/)
  expect(css).not.toContain('@apply')
  expect(css).not.toContain('@reference')
})

test('dev server: the page links the stylesheet, and Vite serves it with the utilities and the scoped @apply', async () => {
  const { createServer } = await import('vite')
  const server = await createServer({ root, configFile: false, logLevel: 'silent', server: { port: 0 }, plugins: [tailwindcss(), clarusjs()] })
  await server.listen()
  try {
    const base = server.resolvedUrls!.local[0]!
    const page = await (await fetch(base)).text()
    const links = [...page.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]!)
    const sheets = await Promise.all(links.map(async (href) => (await fetch(new URL(href, base))).text()))
    const all = sheets.join('\n')
    expect(all).toContain('text-3xl')
    expect(all).toContain('bg-emerald-500')
    expect(all).not.toContain('@apply')
  } finally {
    await server.close()
  }
}, 60_000)
