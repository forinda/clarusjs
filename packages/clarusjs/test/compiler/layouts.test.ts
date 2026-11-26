// #456: folder and config layouts. The plugin gives the compiler a page's layouts (outermost first); the compiler
// wraps the page's template in them, so the page's own nodes keep their places (errors stay located).
import { expect, test } from 'vitest'
import { ClarusError, compile } from '../../src/compiler/index.ts'
import { parse } from '../../src/compiler/parse.ts'
import { importCode, unscoped } from '../helpers.ts'

const SITE = '<html><body><header>{{ path }}</header><slot /></body></html>\n@input path: string = \'\'\n'
const ADMIN = '<div class="admin"><aside><slot name="aside">menu</slot></aside><main><slot /></main></div>\n'
const opts = { file: 'src/pages/admin/users.tscl', target: 'server' as const, clientUrl: '/x.js', scope: 's', layouts: ['./site.tscl', './admin.tscl'] }
const load = async (page: string, extra = {}) => importCode(compile(page, { ...opts, ...extra }).code, 'layouts', {
  './site.tscl': compile(SITE, { file: 'site.tscl', target: 'server', scope: 's' }).code,
  './admin.tscl': compile(ADMIN, { file: 'admin.tscl', target: 'server', scope: 's' }).code,
})

test('a page is wrapped in its layouts, outermost first; they get the route\'s path and params', async () => {
  const { render } = await load('<h1>Users</h1>\n')
  const html = unscoped(await render({}, undefined, { route: { path: '/admin/users', params: {} } }))
  expect(html).toBe('<html><body><header>/admin/users</header><div class="admin"><aside>menu</aside><main><h1>Users</h1></main></div></body></html>')
})

test('a page\'s top-level @slot fill goes to its innermost layout', async () => {
  const { render } = await load("@slot('aside') {<nav>users menu</nav>}\n<h1>Users</h1>\n")
  expect(unscoped(await render({}, undefined, { route: { path: '/admin/users', params: {} } }))).toContain('<aside><nav>users menu</nav></aside>')
})

test('@layout none: the page renders without its folder and config layouts', async () => {
  expect(parse('@layout none\n<p>x</p>\n', 'x.tscl').layout).toBe('none')
  const { render } = await load('@layout none\n<h1>Sign in</h1>\n')
  expect(unscoped(await render({}))).toBe('<h1>Sign in</h1>')
})

test('errors at their place: an island page filling its layouts\' slots, one rendered in the browser, an unknown @layout value', () => {
  const at = (src: string, extra = {}) => { try { compile(src, { ...opts, ...extra }); return '' } catch (e) { return e instanceof ClarusError ? e.message : String(e) } }
  const island = '<script>\n  let n = state(0)\n</script>\n'
  expect(at(island + "@slot('aside') {<nav>menu</nav>}\n<p>{{ n }}</p>\n")).toMatch(/users\.tscl:4:1 .*island page.*can't fill its layouts' slots/)
  expect(at(island + '<p>{{ n }}</p>\n', { renderImports: true })).toMatch(/users\.tscl:1:1 .*island.*rendered in the browser.*@layout none/)
  expect(at('@layout nope\n<p></p>\n')).toMatch(/users\.tscl:1:1 .*@layout only takes none/)
})

// #472: an island page (a <script> of its own) gets its layouts around the island, not inside it: the layouts stay
// server HTML, and the island is the page's own markup, with its props from load().
test('an island page is wrapped in its layouts, outside the island; its props reach it', async () => {
  const page = '@input start: number = 0\n<script>\n  let n = state(start)\n</script>\n<button (click)="n++">{{ n }}</button>\n'
  const { render } = await load(page)
  const html = unscoped(await render({ start: 5 }, undefined, { route: { path: '/admin/users', params: {} } }))
  expect(html).toMatch(/^<html><body><header>\/admin\/users<\/header><div class="admin"><aside>menu<\/aside><main><cl-island c="users" src="\/x\.js" p="\{&quot;start&quot;:5\}"[^>]*><button[^>]*>.*5.*<\/button><\/cl-island><\/main><\/div><\/body><\/html>$/)
  // The browser's module is the page's own: no layout in it.
  const client = compile(page, { ...opts, target: 'client' }).code
  expect(client).not.toContain('admin')
  expect(client).toContain('export function attach')
})
