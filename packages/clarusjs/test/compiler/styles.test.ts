// #39, #279: <style> in .tscl files. <style scoped> is scoped with native @scope; a plain <style> and <style global>
// are global. Every component's top-level elements carry its scope class, so a parent's scope takes in a child
// component's top-level element and stops inside it.
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { parse } from '../../src/compiler/parse.ts'
import { importCode } from '../helpers.ts'

const card = '<section class="card"><p>Hi</p><slot /></section>\n<style scoped>\n  :scope { border: 1px solid; }\n  p { color: teal; }\n</style>\n'
const scope = (id: string) => `@scope (.cl-c-${id}) to ([class*="cl-c-"]:not(.cl-c-${id}) > *) {`

test('top-level <style> blocks are the component stylesheet: scoped, global or plain; a <style> inside markup stays HTML', () => {
  const f = parse('<head><style>body{}</style></head>\n<style global>\n:root { --x: 1 }\n</style>\n<style scoped>p{}</style>\n<style>a{}</style>', 'x.tscl')
  expect(f.styles.map((s) => ({ css: s.css, mode: s.mode }))).toEqual([
    { css: '\n:root { --x: 1 }\n', mode: 'global' },
    { css: 'p{}', mode: 'scoped' },
    { css: 'a{}', mode: 'plain' },
  ])
  expect(JSON.stringify(f.nodes)).toContain('"tag":"style"') // the one in <head> is still an element
})

test('scoped styles: the CSS is wrapped in @scope on the scope class, which the top-level elements carry', async () => {
  const out = compile(card, { file: 'src/components/card.tscl', target: 'server', scope: 'card-1a2b' })
  expect(out.css).toBe(`${scope('card-1a2b')}\n  :scope { border: 1px solid; }\n  p { color: teal; }\n}\n`)
  expect(out.warnings).toEqual([])
  const { render } = await importCode(out.code, 'styles-card', {}, true)
  expect(render({}, { default: '<b>slot</b>' })).toBe('<section class="card cl-c-card-1a2b"><p>Hi</p><b>slot</b></section>')
})

test('a plain <style> is global and warns (it used to be scoped); <style global> is global and quiet', () => {
  const plain = compile('<p>x</p>\n<style>\nbody { margin: 0 }\n</style>', { file: 'src/g.tscl', target: 'server', scope: 'g-1' })
  expect(plain.css).toBe('\nbody { margin: 0 }\n')
  expect(plain.warnings.map((w) => w.message)).toEqual(['src/g.tscl:2:1 a plain <style> is global: add `scoped` to scope it to this component (it used to be scoped by default), or `global` to keep it global without this warning'])
  const g = compile('<p>x</p>\n<style global>\nbody { margin: 0 }\n</style>', { file: 'g.tscl', target: 'server', scope: 'g-1' })
  expect(g.css).toBe('\nbody { margin: 0 }\n')
  expect(g.warnings).toEqual([])
})

test('every component\'s top-level elements carry its scope class, styled or not', async () => {
  const none = compile('<p>x</p>', { file: 'n.tscl', target: 'server', scope: 'n-1' })
  expect(none.css).toBe('')
  expect((await importCode(none.code, 'styles-n', {}, true)).render()).toBe('<p class="cl-c-n-1">x</p>')
})

test('the scope class is merged with the element\'s own class: static, with holes, or bound', async () => {
  const src = '@input b: string = "B"\n<p class="a">1</p><p class="a {{ b }}">2</p><p [class]="b">3</p>'
  const { render } = await importCode(compile(src, { file: 'm.tscl', target: 'server', scope: 'm-1' }).code, 'styles-merge', {}, true)
  expect(render()).toBe('<p class="a cl-c-m-1">1</p><p class="a B cl-c-m-1">2</p><p class="B cl-c-m-1">3</p>')
})

test('top-level elements inside @if and @for are marked too; components, text, <cl-head> and <script> are not', async () => {
  const src = '@import badge from "./badge.tscl"\n@input on: boolean = true\n@if (on) { <p>a</p> } @else { <span>b</span> }\n@for (n of [1, 2]) { <i>{{ n }}</i> }\n<badge />text\n<cl-head><title>t</title></cl-head>\n<style scoped>p{}</style>'
  const out = compile(src, { file: 'x.tscl', target: 'server', scope: 's' })
  const { render } = await importCode(out.code, 'styles-blocks', { './badge.tscl': 'export const render = () => "<b>badge</b>"' }, true)
  expect(render()).toBe(' <p class="cl-c-s">a</p>  <i class="cl-c-s">1</i>  <i class="cl-c-s">2</i> <b>badge</b>text\n<cl-head><title>t</title></cl-head>')
})

test('the scope defaults to one derived from the file name', () => {
  const a = compile(card, { file: 'src/components/card.tscl', target: 'server' })
  expect(a.css).toMatch(/^@scope \(\.cl-c-card-[a-z0-9]+\)/)
  expect(compile(card, { file: 'src/components/card.tscl', target: 'server' }).css).toBe(a.css)
})

test('#146: @reference and @import at the start of a scoped style stay outside @scope (they are not valid in it)', () => {
  const src = '<div>x</div>\n<style scoped>\n  @reference "../styles/app.css";\n  @import "./extra.css";\n  :scope { @apply p-4; }\n</style>'
  const { css } = compile(src, { file: '/a/src/components/x.tscl', target: 'client', scope: 'x-1' })
  expect(css).toBe(`@reference "../styles/app.css";\n@import "./extra.css";\n${scope('x-1')}\n  :scope { @apply p-4; }\n}\n`)
})

test('head elements (title, meta, link, base) and the document element aren\'t marked: they\'re never styled by a scope', async () => {
  const src = '<html><head><title>t</title></head><body></body></html>\n<title>x</title>\n<meta name="a" content="b">\n<link rel="icon" href="/i.png">\n<base href="/">\n'
  const { render } = await importCode(compile(src, { file: 'h.tscl', target: 'server', scope: 'h-1' }).code, 'styles-head', {}, true)
  expect(render()).toBe('<html><head><title>t</title></head><body></body></html><title>x</title><meta name="a" content="b"><link rel="icon" href="/i.png"><base href="/">')
})
