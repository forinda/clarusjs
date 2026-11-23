// @vitest-environment happy-dom
// #418: a page that wraps its content in a layout (<docs>…</docs>) styles that content with its own <style scoped>:
// slot content is the page's, so its top-level elements carry the page's scope class, default and named slots alike.
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { importCode } from '../helpers.ts'

const layout = '<main class="layout"><slot /><aside><slot name="side" /></aside></main>\n'
const page = "@import layout from './layout.tscl'\n<layout><p class=\"note\">Hi</p>@if (true) {<span>in a block</span>}<card />@slot('side') {<b>Side</b>}</layout>\n<style scoped>\n  .note { color: red; }\n</style>\n"
const server = (src: string, file: string, scope: string) => compile(src, { file, target: 'server', scope }).code

test('the top-level elements of the content passed to a layout get the page\'s scope class (not a child component\'s roots)', async () => {
  const card = '<div class="card">card</div>\n'
  const { render } = await importCode(server(page.replace("@import layout", "@import card from './card.tscl'\n@import layout"), 'page.tscl', 'page-1'), 'ssc', {
    './layout.tscl': server(layout, 'layout.tscl', 'layout-1'),
    './card.tscl': server(card, 'card.tscl', 'card-1'),
  }, true)
  const html = render({})
  expect(html).toContain('<p class="note cl-c-page-1">Hi</p>')
  expect(html).toContain('<span class="cl-c-page-1">in a block</span>')
  expect(html).toContain('<b class="cl-c-page-1">Side</b>')
  expect(html).toContain('<div class="card cl-c-card-1">card</div>') // the child component's root: its own class only
})

test('in a browser, the page\'s scoped rule applies to its content inside the layout', async () => {
  const { render } = await importCode(server(page, 'page.tscl', 'page-1'), 'ssc2', { './layout.tscl': server(layout, 'layout.tscl', 'layout-1') }, true)
  const css = compile(page, { file: 'page.tscl', target: 'server', scope: 'page-1' }).css
  document.head.innerHTML = `<style>${css}</style>`
  document.body.innerHTML = render({})
  expect(getComputedStyle(document.querySelector('.note')!).color).toMatch(/^(red|rgb\(255, 0, 0\))$/) // happy-dom keeps the keyword
})

test('without scoped styles, slot content gets no class (no class on every paragraph of every Markdown page)', async () => {
  const plain = "@import layout from './layout.tscl'\n<layout><p>Hi</p></layout>\n"
  const { render } = await importCode(server(plain, 'page.tscl', 'page-1'), 'ssc3', { './layout.tscl': server(layout, 'layout.tscl', 'layout-1') }, true)
  expect(render({})).toContain('<p>Hi</p>')
})

test('#418 with #403: a bound [class] in the content passed to a layout keeps its value and gets the scope class', async () => {
  const src = "@import layout from './layout.tscl'\n@input on: boolean = true\n<layout><p [class]=\"{ note: on }\">Hi</p></layout>\n<style scoped>\n  .note { color: red; }\n</style>\n"
  const { render } = await importCode(server(src, 'page.tscl', 'page-1'), 'ssc4', { './layout.tscl': server(layout, 'layout.tscl', 'layout-1') }, true)
  expect(render({})).toContain('<p class="note cl-c-page-1">Hi</p>')
})
