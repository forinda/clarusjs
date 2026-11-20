// #39: <style> in .tscl files. Scoped with native @scope by default; <style global> is left as written.
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { parse } from '../../src/compiler/parse.ts'
import { importCode } from '../helpers.ts'

const card = '<section class="card"><p>Hi</p><slot /></section>\n<style>\n  :scope { border: 1px solid; }\n  p { color: teal; }\n</style>\n'

test('top-level <style> blocks are the component stylesheet; a <style> inside markup stays HTML', () => {
  const f = parse('<head><style>body{}</style></head>\n<style global>\n:root { --x: 1 }\n</style>\n<style>p{}</style>', 'x.tscl')
  expect(f.styles.map((s) => ({ css: s.css, global: s.global }))).toEqual([{ css: '\n:root { --x: 1 }\n', global: true }, { css: 'p{}', global: false }])
  expect(JSON.stringify(f.nodes)).toContain('"tag":"style"') // the one in <head> is still an element
})

test('scoped styles: the top-level elements are marked, and the CSS is wrapped in @scope', async () => {
  const out = compile(card, { file: 'src/components/card.tscl', target: 'server', scope: 'card-1a2b' })
  expect(out.css).toBe('@scope ([data-cl-c="card-1a2b"]) to ([data-cl-c]) {\n  :scope { border: 1px solid; }\n  p { color: teal; }\n}\n')
  const { render } = await importCode(out.code, 'styles-card')
  expect(render({}, { default: '<b>slot</b>' })).toBe('<section class="card" data-cl-c="card-1a2b"><p>Hi</p><b>slot</b></section>')
})

test('global styles are not wrapped and mark nothing; no style means no attribute and no CSS', async () => {
  const g = compile('<p>x</p>\n<style global>\nbody { margin: 0 }\n</style>', { file: 'g.tscl', target: 'server', scope: 'g-1' })
  expect(g.css).toBe('\nbody { margin: 0 }\n')
  expect((await importCode(g.code, 'styles-g')).render()).toBe('<p>x</p>')
  const none = compile('<p>x</p>', { file: 'n.tscl', target: 'server' })
  expect(none.css).toBe('')
  expect((await importCode(none.code, 'styles-n')).render()).toBe('<p>x</p>')
})

test('top-level elements inside @if and @for are marked too; components and text are not', async () => {
  const src = '@import badge from "./badge.tscl"\n@input on: boolean = true\n@if (on) { <p>a</p> } @else { <span>b</span> }\n@for (n of [1, 2]) { <i>{{ n }}</i> }\n<badge />text\n<style>p{}</style>'
  const out = compile(src, { file: 'x.tscl', target: 'server', scope: 's' })
  const { render } = await importCode(out.code, 'styles-blocks', { './badge.tscl': 'export const render = () => "<b>badge</b>"' })
  expect(render()).toBe(' <p data-cl-c="s">a</p>  <i data-cl-c="s">1</i>  <i data-cl-c="s">2</i> <b>badge</b>text\n')
})

test('the scope defaults to one derived from the file name', () => {
  const a = compile(card, { file: 'src/components/card.tscl', target: 'server' })
  expect(a.css).toMatch(/^@scope \(\[data-cl-c="card-[a-z0-9]+"\]\)/)
  expect(compile(card, { file: 'src/components/card.tscl', target: 'server' }).css).toBe(a.css)
})
