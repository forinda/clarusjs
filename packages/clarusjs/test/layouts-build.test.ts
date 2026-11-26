// #456: folder layouts (+layout.tscl wraps every page under its folder) and config layouts (by route pattern), in a
// real build. + files are never routes; @layout none opts a page out.
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createBuilder } from 'vite'
import { beforeAll, expect, test } from 'vitest'
import clarusjs from '../src/vite/plugin.ts'
import { unscoped } from './helpers.ts'

let root: string
const page = (route: string) => unscoped(readFileSync(resolve(root, 'dist/client', route.replace(/^\//, ''), 'index.html'), 'utf8'))

beforeAll(async () => {
  root = mkdtempSync(resolve(tmpdir(), 'clarus-layouts-'))
  const w = (path: string, text: string) => { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }
  w('src/layouts/shell.tscl', '@input path: string = \'\'\n<!doctype html>\n<html><head><title>T</title></head><body data-path="{{ path }}"><slot /></body></html>\n')
  w('src/layouts/banner.tscl', '<div class="banner"><slot /></div>\n')
  w('src/pages/+layout.tscl', '<div class="site"><nav>site</nav><slot /></div>\n')
  w('src/pages/index.tscl', '<h1>Home</h1>\n')
  w('src/pages/admin/+layout.tscl', '<div class="admin"><aside><slot name="aside">admin menu</slot></aside><main><slot /></main></div>\n')
  w('src/pages/admin/users.tscl', "@slot('aside') {<em>users menu</em>}\n<h1>Users</h1>\n")
  w('src/pages/admin/sign-in.tscl', '@layout none\n<h1>Sign in</h1>\n')
  w('src/pages/embed/widget.tscl', '<p>widget</p>\n')
  // #472: page sources (Markdown, say) get the folder layouts too.
  w('src/pages/admin/notes.note', 'hello')
  w('src/pages/+guard.ts', 'export function guard() {}\n')
  // #472: a folder layout's own data, from +layout.load.ts, with the route's params.
  w('src/pages/teams/team.css', '.team { color: teal; }\n')
  w('src/pages/teams/+layout.tscl', "@import './team.css'\n@input team: string = '?'\n@input members: number = 0\n<section class=\"team\" data-team=\"{{ team }}\" data-members=\"{{ members }}\"><slot /></section>\n")
  w('src/pages/teams/+layout.load.ts', "export function load({ params }: { params: Record<string, string> }) { return { team: params.id ?? 'all', members: 3 } }\n")
  w('src/pages/teams/[id].tscl', '<h1>Team</h1>\n')
  w('src/pages/teams/[id].load.ts', "export function entries() { return [{ id: 'red' }] }\nexport function load() { return {} }\n")
  w('src/pages/admin/+guard.ts', 'export function guard() {}\n')
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  const layouts = [
    { layout: '/src/layouts/shell.tscl', exclude: ['/embed/*'] },
    { layout: '/src/layouts/banner.tscl', include: ['/admin/*'] },
  ]
  await (await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [clarusjs({ layouts, sources: [{ extension: '.note', toTscl: (code) => `<p class="note">${code}</p>\n` }] })] })).buildApp()
}, 120_000)

test('config layouts wrap outermost (in order), then folder layouts from the root down, then the page', () => {
  const html = page('/admin/users')
  expect(html).toMatch(/<body data-path="\/admin\/users"><div class="banner"><div class="site"><nav>site<\/nav><div class="admin"><aside><em>users menu<\/em><\/aside><main><h1>Users<\/h1><\/main><\/div><\/div><\/div><\/body>/)
})

test('a page outside a folder layout gets only the layouts that apply to it; exclude keeps a config layout off', () => {
  expect(page('/')).toMatch(/<body data-path="\/"><div class="site"><nav>site<\/nav><h1>Home<\/h1><\/div><\/body>/)
  const widget = page('/embed/widget')
  expect(widget).toContain('<div class="site"><nav>site</nav><p>widget</p></div>')
  expect(widget).not.toContain('data-path') // the shell is excluded for /embed/*
})

test('@layout none: no folder or config layout', () => {
  const html = page('/admin/sign-in')
  expect(html).toContain('<h1>Sign in</h1>')
  expect(html).not.toContain('class="site"')
  expect(html).not.toContain('class="admin"')
  expect(html).not.toContain('class="banner"')
})

test('+layout.tscl files are never routes', () => {
  const manifest = JSON.parse(readFileSync(resolve(root, 'dist/clarusjs-manifest.json'), 'utf8'))
  expect(Object.keys(manifest.routes).sort()).toEqual(['/', '/admin/notes', '/admin/sign-in', '/admin/users', '/embed/widget', '/teams/red'])
})

test('#472: a page source (a Markdown page) is wrapped in its folder and config layouts like a .tscl page', () => {
  expect(page('/admin/notes')).toMatch(/<body data-path="\/admin\/notes"><div class="banner"><div class="site"><nav>site<\/nav><div class="admin"><aside>admin menu<\/aside><main><p class="note">hello<\/p><\/main><\/div><\/div><\/div><\/body>/)
})

test('#472: the route manifest (clarusjs explain) lists each route\'s layouts, outermost first, and its guards, outer first', () => {
  const routes = JSON.parse(readFileSync(resolve(root, 'dist/clarusjs-manifest.json'), 'utf8')).routes
  expect(routes['/admin/users'].layouts).toEqual(['src/layouts/shell.tscl', 'src/layouts/banner.tscl', 'src/pages/+layout.tscl', 'src/pages/admin/+layout.tscl'])
  expect(routes['/admin/users'].guards).toEqual(['src/pages/+guard.ts', 'src/pages/admin/+guard.ts'])
  expect(routes['/embed/widget'].layouts).toEqual(['src/pages/+layout.tscl'])
  expect(routes['/embed/widget'].guards).toEqual(['src/pages/+guard.ts'])
  expect(routes['/admin/sign-in'].layouts).toBeUndefined() // @layout none
  expect(routes['/admin/sign-in'].guards).toEqual(['src/pages/+guard.ts', 'src/pages/admin/+guard.ts']) // guards still apply
})

test('#472: +layout.load.ts gives a folder layout its inputs, with the route\'s params; it is never a route itself', () => {
  expect(page('/teams/red')).toMatch(/<section class="team" data-team="red" data-members="3"><h1>Team<\/h1><\/section>/)
})

test('#472: a folder layout\'s imported stylesheet is linked on the pages it wraps', () => {
  const href = /<link rel="stylesheet" href="([^"]*team[^"]*\.css)">/.exec(page('/teams/red'))?.[1]
  expect(href).toBeDefined()
  expect(readFileSync(resolve(root, 'dist/client', href!.slice(1)), 'utf8')).toContain('teal')
  expect(page('/')).not.toContain(href!)
})
