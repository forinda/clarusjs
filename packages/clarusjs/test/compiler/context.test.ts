// #465: context. A component provides named values with provide(key, value); components rendered inside it (in its
// template or in content passed to it, at any depth) read them with @context name: Type.
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { parse } from '../../src/compiler/parse.ts'
import { ClarusError } from '../../src/compiler/errors.ts'

const compileError = (source: string) => {
  try { compile(source, { file: 'x.tscl', target: 'server', clientUrl: '/c.js' }) } catch (e) { return (e as ClarusError).message }
  throw new Error('expected compile to throw')
}

test('@context parses like an @input: name, type, optional default', () => {
  expect(parse('@context tabs: { id: string }\n<p />', 'x.tscl').contexts).toMatchObject([{ name: 'tabs', type: '{ id: string }' }])
  expect(parse("@context tabs: { id: string } = { id: 'x' }\n<p />", 'x.tscl').contexts).toMatchObject([{ name: 'tabs', default: "{ id: 'x' }" }])
})

test('@context in an island, a non-literal provide key and a name clash are located build errors', () => {
  expect(compileError('<script>let n = state(0)</script>\n@context t: string\n<p />')).toMatch(/^x\.tscl:2:1 .*@context.*island/)
  expect(compileError('<script>\n  provide(name, 1)\n</script>\n<p />')).toMatch(/^x\.tscl:2:3 .*provide.*string/)
  expect(compileError('@input t: string\n@context t: string\n<p />')).toMatch(/^x\.tscl:2:10 .*already/)
})

// --- on the server (Task 2) ---
import { mkdirSync, writeFileSync } from 'node:fs'

const server = (source: string, file: string) => compile(source, { file, target: 'server', clientUrl: `/${file}.js` }).code
const tabs = "@input value: string\n<script>\n  provide('tabs', { value })\n</script>\n<div class=\"tabs\"><slot /></div>\n"
const panel = '@context tabs: { value: string }\n@input value: string\n<p [hidden]="value !== tabs.value">{{ value }}</p>\n'
const optional = "@context tabs: { value: string } = { value: 'none' }\n<i>{{ tabs.value }}</i>\n"
let n = 0
// Every module written to test/.tmp (so clarusjs/runtime resolves), each one's ./x.tscl imports pointing at the others.
async function render(page: string, extra: Record<string, string> = {}) {
  const modules: Record<string, string> = { './tabs.tscl': server(tabs, 'tabs.tscl'), './panel.tscl': server(panel, 'panel.tscl'), './optional.tscl': server(optional, 'optional.tscl'), ...extra, './page.tscl': server(page, 'page.tscl') }
  const dir = `${import.meta.dirname}/../.tmp/`
  const prefix = `ctx-${process.pid}-${n++}-`
  mkdirSync(dir, { recursive: true })
  for (const [path, code] of Object.entries(modules)) {
    writeFileSync(dir + prefix + path.slice(2) + '.mjs', code.replace(/from '\.\/([\w-]+\.tscl)'/g, (_, f) => `from './${prefix}${f}.mjs'`))
  }
  const { render } = await import(/* @vite-ignore */ `${dir}${prefix}page.tscl.mjs`)
  return (await render({})) as string
}
const imports = "@import tabs from './tabs.tscl'\n@import panel from './panel.tscl'\n@import optional from './optional.tscl'\n@import w from './w.tscl'\n@import slow from './slow.tscl'\n"
const w = server('@import tabs from \'./tabs.tscl\'\n<tabs value="b"><slot /></tabs>\n', 'w.tscl')
const slow = server('@import panel from \'./panel.tscl\'\n<script server>\n  await Promise.resolve()\n</script>\n<panel value="b" />\n', 'slow.tscl')
const hidden = (html: string) => [...html.matchAll(/<p[^>]*?( hidden)?[^>]*>(\w)<\/p>/g)].map((m) => `${m[2]}${m[1] ? ':hidden' : ''}`)

test('a component reads what the component around it provides', async () => {
  const html = await render(`${imports}<tabs value="b"><panel value="a" /><panel value="b" /></tabs>`, { './w.tscl': w, './slow.tscl': slow })
  expect(hidden(html)).toEqual(['a:hidden', 'b'])
})

test('content placed by a wrapper inside a provider sees the provider', async () => {
  const html = await render(`${imports}<w><panel value="a" /><panel value="b" /></w>`, { './w.tscl': w, './slow.tscl': slow })
  expect(hidden(html)).toEqual(['a:hidden', 'b'])
})

test('the nearest provider wins inside; the outer one is back for later siblings', async () => {
  const html = await render(`${imports}<tabs value="a"><tabs value="b"><panel value="a" /></tabs><panel value="a" /></tabs>`, { './w.tscl': w, './slow.tscl': slow })
  expect(hidden(html)).toEqual(['a:hidden', 'a'])
})

test('context reaches an awaiting child (#430)', async () => {
  const html = await render(`${imports}<tabs value="b"><slow /></tabs>`, { './w.tscl': w, './slow.tscl': slow })
  expect(hidden(html)).toEqual(['b'])
})

test('a fill that receives slot data still gets the context', async () => {
  const list = server("@import panel from './panel.tscl'\n<ul><slot name=\"row\" [v]=\"'b'\" /></ul>\n", 'list.tscl')
  const html = await render(`${imports}@import list from './list.tscl'\n<tabs value="b"><list>@slot('row', { v }) { <panel [value]="v" /> }</list></tabs>`, { './w.tscl': w, './slow.tscl': slow, './list.tscl': list })
  expect(hidden(html)).toEqual(['b'])
})

test('outside any provider: the default, or a render error naming the component and the key', async () => {
  expect(await render(`${imports}<optional />`, { './w.tscl': w, './slow.tscl': slow })).toMatch(/>none<\/i>/)
  await expect(render(`${imports}<panel value="a" />`, { './w.tscl': w, './slow.tscl': slow })).rejects.toThrow('[clarusjs] <panel> reads context "tabs", which no component around it provides')
})

test('provide is reserved: a script that declares or imports its own is a located build error', () => {
  expect(compileError("<script>\n  function provide(k, v) {}\n  provide('k', 1)\n</script>\n<p />")).toMatch(/^x\.tscl:2:3 .*provide is reserved/)
  expect(compileError("<script>\n  import { provide } from 'di'\n</script>\n<p />")).toMatch(/^x\.tscl:2:3 .*provide is reserved/)
  expect(compileError("<script>\n  import { other as provide } from 'di'\n</script>\n<p />")).toMatch(/^x\.tscl:2:3 .*provide is reserved/)
  expect(compileError("<script>\n  import * as provide from 'di'\n</script>\n<p />")).toMatch(/^x\.tscl:2:3 .*provide is reserved/)
})

test('#465 review: an import that renames provide is fine; provide is called, never passed around', () => {
  expect(() => compile("<script>\n  import { provide as register } from 'di'\n  register('x')\n</script>\n<p />", { file: 'x.tscl', target: 'server', clientUrl: '/c.js' })).not.toThrow()
  expect(compileError("<script>\n  const register = provide\n  register('tabs', 1)\n</script>\n<p />")).toMatch(/^x\.tscl:2:20 .*provide is called with/)
  expect(compileError("<script>\n  const api = { provide }\n</script>\n<p />")).toMatch(/^x\.tscl:2:17 .*provide is called with/)
})

test('#465 review: @context named like a global (Object) still reads what is provided', async () => {
  const objectProvider = "<script>\n  provide('Object', { v: 'given' })\n</script>\n<div><slot /></div>\n"
  const reads = "@context Object: { v: string }\n<i>{{ Object.v }}</i>\n"
  expect(await render(`${imports}@import op from './op.tscl'\n@import reads from './reads.tscl'\n<op><reads /></op>`, { './w.tscl': w, './slow.tscl': slow, './op.tscl': server(objectProvider, 'op.tscl'), './reads.tscl': server(reads, 'reads.tscl') })).toMatch(/>given<\/i>/)
})

test('context lookups ignore names every object has (toString), and provide keys must be names @context can read', async () => {
  const reads = "@context toString: string = 'fallback'\n<i>{{ toString }}</i>\n"
  expect(await render(`${imports}@import reads from './reads.tscl'\n<tabs value="a"><reads /></tabs>`, { './w.tscl': w, './slow.tscl': slow, './reads.tscl': server(reads, 'reads.tscl') })).toMatch(/>fallback<\/i>/)
  expect(compileError("<script>\n  provide('my-key', 1)\n</script>\n<p />")).toMatch(/^x\.tscl:2:3 .*provide.*name/)
})
