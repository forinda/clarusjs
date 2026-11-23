// #430: <script server> runs on the server at render only: its names reach the template, its imports never reach
// the browser, it can await (an async render), and it doesn't make the component an island. Parents compose with a
// join that stays synchronous unless a part is a promise.
import { expect, test } from 'vitest'
import { ClarusError, compile } from '../../src/compiler/index.ts'
import { importCode, unscoped } from '../helpers.ts'

const server = (src: string, file = 'c.tscl') => compile(src, { file, target: 'server', clientUrl: '/c.js', scope: 's' }).code
const client = (src: string, file = 'c.tscl') => compile(src, { file, target: 'client' }).code
const load = (src: string, deps: Record<string, string> = {}, file?: string) => importCode(server(src, file), 'srv', deps)
const error = (src: string) => { try { server(src); return '' } catch (e) { return e instanceof ClarusError ? e.message : String(e) } }

test('its names reach the template; the component stays static (no island, nothing for the browser)', async () => {
  const src = "<script server>\n  const title = 'Posts'\n  const posts = [{ id: 1, t: 'a' }, { id: 2, t: '<b>' }]\n</script>\n<h1>{{ title }}</h1>@for (p of posts; track p.id) {<p>{{ p.t }}</p>}\n"
  const { render } = await load(src)
  expect(render({})).toBe('<h1>Posts</h1><p>a</p><p>&lt;b&gt;</p>')
  expect(compile(src, { file: 'c.tscl', target: 'client' }).stateful).toBe(false)
  expect(client(src)).toBe('export {}\n')
})

test('top-level await: render is async and resolves to the HTML with the awaited data', async () => {
  const src = "<script server>\n  const posts = await Promise.resolve([{ id: 1, title: 'Hello' }])\n</script>\n@for (p of posts; track p.id) {<h2>{{ p.title }}</h2>}\n"
  expect(server(src)).toContain('export async function render(')
  const { render } = await load(src)
  const out = render({})
  expect(out).toBeInstanceOf(Promise)
  expect(unscoped(await out)).toBe('<h2>Hello</h2>')
})

test('its imports are hoisted to the server module (node: too); inputs are readable in it', async () => {
  const src = "@input id: number = 2\n<script server>\n  import { join } from 'node:path'\n  import { names } from './data.ts'\n  const name = names[id]\n  const path = join('a', 'b')\n</script>\n<p>{{ name }} {{ path }}</p>\n"
  const { render } = await load(src, { './data.ts': "export const names = ['zero', 'one', 'two']\n" })
  expect(render({})).toBe('<p>two a/b</p>')
  expect(render({ id: 1 })).toBe('<p>one a/b</p>')
})

test('errors at their place: an island with a server script, a second one, a nested one, an export', () => {
  expect(error("<script server>\n  const a = 1\n</script>\n<script>\n  let n = state(0)\n</script>\n<p>{{ a }}</p>\n")).toMatch(/c\.tscl:1:1 .*<script server>.*island.*props/)
  expect(error("<script server>\n</script>\n<script server>\n</script>\n<p></p>\n")).toMatch(/c\.tscl:3:1 only one <script server>/)
  expect(error("<div><script server>\n</script></div>\n")).toMatch(/<script server> must be at the top level/)
  expect(error("<script server>\n  export const a = 1\n</script>\n<p></p>\n")).toMatch(/c\.tscl:2:3 a <script server> cannot export/)
})

test('an island script still can\'t await at the top level, and the error names <script server> and resource()', () => {
  expect(error("<script>\n  const x = await fetch('/a')\n</script>\n<p></p>\n")).toMatch(/c\.tscl:2:13 .*<script server>.*resource\(\)/)
})

const child = "<script server>\n  const v = await Promise.resolve('async child')\n</script>\n<b>{{ v }}</b>\n"
const sync = "<i>sync child</i>\n"

test('a parent with only synchronous children renders synchronously, as before', async () => {
  const { render } = await load("@import kid from './kid.tscl'\n<div><kid /></div>\n", { './kid.tscl': server(sync, 'kid.tscl') })
  expect(render({})).toBe('<div><i>sync child</i></div>')
})

test('an awaiting child makes its parent\'s render a promise: directly, in a slot, and in @for rows', async () => {
  const layout = server('<main><slot /></main>\n', 'layout.tscl')
  const kid = server(child, 'kid.tscl')
  const { render } = await load("@import kid from './kid.tscl'\n@import layout from './layout.tscl'\n<layout><p>before</p><kid />@for (n of [1, 2]; track n) {<kid />}</layout>\n", { './kid.tscl': kid, './layout.tscl': layout })
  const out = render({})
  expect(out).toBeInstanceOf(Promise)
  expect(unscoped(await out)).toBe('<main><p>before</p><b>async child</b><b>async child</b><b>async child</b></main>')
})

test('an awaiting component inside an island is an error when the server renders it, naming both', async () => {
  const island = "@import kid from './kid.tscl'\n<script>\n  let n = state(0)\n</script>\n<div><kid /></div>\n"
  const { render } = await load(island, { './kid.tscl': server(child, 'kid.tscl') }, 'island.tscl')
  expect(() => render({})).toThrow(/<kid> awaits in its <script server>.*can't be inside the island <island>/)
})

test('a render module for the browser (a client route, or a child an island re-renders) refuses a <script server>', () => {
  const src = "<p>a</p>\n<script server>\n  const a = 1\n</script>\n"
  let message = ''
  try { compile(src, { file: 'c.tscl', target: 'server', renderImports: true }) } catch (e) { message = (e as Error).message }
  expect(message).toMatch(/c\.tscl:2:1 .*<script server>.*browser.*client route.*island/)
})
