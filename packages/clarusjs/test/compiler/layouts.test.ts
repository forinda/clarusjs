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

test('errors at their place: an island page with layouts (not yet), an unknown @layout value', () => {
  const at = (src: string) => { try { compile(src, opts); return '' } catch (e) { return e instanceof ClarusError ? e.message : String(e) } }
  expect(at('<script>\n  let n = state(0)\n</script>\n<p>{{ n }}</p>\n')).toMatch(/users\.tscl:1:1 .*layouts.*island.*@layout none/)
  expect(at('@layout nope\n<p></p>\n')).toMatch(/users\.tscl:1:1 .*@layout only takes none/)
})
