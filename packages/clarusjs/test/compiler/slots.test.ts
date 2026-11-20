// Default slots: a stateless component renders the content it wraps at its <slot />.
import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { ClarusError } from '../../src/compiler/errors.ts'
import { importCode } from '../helpers.ts'

const server = (source: string, file: string) => compile(source, { file, target: 'server', clientUrl: '/c.js' }).code
const layout = server('@input title: string\n<main><slot /></main>', 'docs.tscl')
const card = server('<div class="card"><slot /></div>', 'card.tscl')
const counter = server(readFileSync(`${import.meta.dirname}/../fixtures/counter.tscl`, 'utf8'), 'counter.tscl')

async function renderPage(source: string, props = {}) {
  const page = server(source, 'page.tscl')
  const { render } = await importCode(page, 'slot-page', {
    './docs.tscl': layout, './card.tscl': card, './counter.tscl': counter,
  })
  return render(props)
}
function compileError(source: string): ClarusError {
  try { compile(source, { file: 'x.tscl', target: 'server', clientUrl: '/c.js' }) } catch (e) { return e as ClarusError }
  throw new Error('expected compile to throw')
}

test('wrapped content renders at <slot />, in the page scope, escaped exactly once', async () => {
  const html = await renderPage(`@import docs from './docs.tscl'\n@input who: string\n<docs [title]="'x'">Hi {{ who }}</docs>`, { who: '<b>' })
  expect(html).toBe('<main>Hi &lt;b&gt;</main>')
})

test('a component used without content renders an empty slot', async () => {
  expect(await renderPage(`@import docs from './docs.tscl'\n<docs [title]="'x'" />`)).toBe('<main></main>')
})

test('islands inside wrapped content keep working', async () => {
  const html = await renderPage(`@import docs from './docs.tscl'\n@import counter from './counter.tscl'\n<docs [title]="'x'"><counter [start]="1" /></docs>`)
  expect(html).toMatch(/^<main><cl-island c="counter" src="\/c\.js"/)
  expect(html.endsWith('</cl-island></main>')).toBe(true)
})

test('slots nest', async () => {
  const html = await renderPage(`@import docs from './docs.tscl'\n@import card from './card.tscl'\n<docs [title]="'x'"><card>inner</card></docs>`)
  expect(html).toBe('<main><div class="card">inner</div></main>')
})

test('giving content to a stateful component fails when rendering, naming it', async () => {
  await expect(renderPage(`@import counter from './counter.tscl'\n<counter [start]="1">x</counter>`)).rejects.toThrow(/<counter> does not accept children yet/)
})

test('<slot /> in a stateful component is a located build error', () => {
  expect(compileError('<script>let n = state(0)</script>\n<p><slot /></p>').message).toMatch(/^x\.tscl:2:4 .*only supported in components without <script>/)
})

// --- named slots (#12) ---

const panel = server(`@input title: string
<section><header><slot name="head">{{ title }}</slot></header><main><slot>Nothing here</slot></main><footer><slot name="foot" /></footer></section>`, 'panel.tscl')

async function renderWith(source: string, props = {}) {
  const { render } = await importCode(server(source, 'page.tscl'), 'named-page', { './panel.tscl': panel, './card.tscl': card })
  return render(props) as string
}

test('@slot fills named slots; other content goes to the default slot', async () => {
  const html = await renderWith(`@import panel from './panel.tscl'
<panel [title]="'T'">@slot('head') {<h2>Custom</h2>} body text @slot('foot') {<small>f</small>}</panel>`)
  expect(html).toBe('<section><header><h2>Custom</h2></header><main> body text </main><footer><small>f</small></footer></section>')
})

test('unfilled slots show their fallback, which reads the component\'s inputs', async () => {
  expect(await renderWith(`@import panel from './panel.tscl'\n<panel [title]="'T'" />`))
    .toBe('<section><header>T</header><main>Nothing here</main><footer></footer></section>')
})

test('whitespace alone does not fill the default slot', async () => {
  const html = await renderWith(`@import panel from './panel.tscl'\n<panel [title]="'T'">\n  @slot('foot') {x}\n</panel>`)
  expect(html).toContain('<main>Nothing here</main>')
})

test('fill content is rendered in the page scope and escaped once', async () => {
  const html = await renderWith(`@import panel from './panel.tscl'\n@input who: string\n<panel [title]="'T'">@slot('head') {{{ who }}}</panel>`, { who: '<b>' })
  expect(html).toContain('<header>&lt;b&gt;</header>')
})

test('a fill for a slot the component does not have fails when rendering, naming it', async () => {
  await expect(renderWith(`@import card from './card.tscl'\n<card>@slot('aside') {x}</card>`)).rejects.toThrow(/<card> has no slot "aside"/)
})

test('a slot name may repeat; both places get the content', async () => {
  const twice = server('<p><slot name="x" /></p><p><slot name="x" /></p>', 'twice.tscl')
  const page = server(`@import twice from './twice.tscl'\n<twice>@slot('x') {hi}</twice>`, 'page.tscl')
  const { render } = await importCode(page, 'twice', { './twice.tscl': twice })
  expect(render()).toBe('<p>hi</p><p>hi</p>')
})

test('slot and @slot errors are located', () => {
  expect(compileError('<slot class="x" />').message).toMatch(/^x\.tscl:1:7 .*<slot> only takes name=/)
  expect(compileError(`@import card from './card.tscl'\n<card>@slot('a') {1} @slot('a') {2}</card>`).message).toMatch(/^x\.tscl:2:22 .*filled twice/)
  expect(compileError(`<div>@slot('a') {1}</div>`).message).toMatch(/^x\.tscl:1:6 .*@slot only works directly inside a component tag/)
  expect(compileError(`@import card from './card.tscl'\n<card>@slot(name) {1}</card>`).message).toMatch(/^x\.tscl:2:7 .*@slot needs a quoted name/)
})

test('content given to a component without <slot /> fails when rendering instead of vanishing', async () => {
  const plain = server('<div class="plain">no slot here</div>', 'plain.tscl')
  const page = server(`@import plain from './plain.tscl'\n<plain>lost text</plain>`, 'page.tscl')
  const { render } = await importCode(page, 'slot-none', { './plain.tscl': plain })
  expect(() => render()).toThrow(/<plain> has no <slot \/> for the content passed to it/)
})
