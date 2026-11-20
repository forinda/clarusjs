// Default slots: a stateless component renders the content it wraps at its <slot />.
import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { ClarusError } from '../../src/compiler/errors.ts'
import { importCode } from '../helpers.ts'

const server = (source: string, file: string) => compile(source, { file, target: 'server', clientUrl: '/c.js' }).code
const layout = server('@input title: string\n<main><slot /></main>', 'docs.clarus')
const card = server('<div class="card"><slot /></div>', 'card.clarus')
const counter = server(readFileSync(`${import.meta.dirname}/../fixtures/counter.clarus`, 'utf8'), 'counter.clarus')

async function renderPage(source: string, props = {}) {
  const page = server(source, 'page.clarus')
  const { render } = await importCode(page, 'slot-page', {
    './docs.clarus': layout, './card.clarus': card, './counter.clarus': counter,
  })
  return render(props)
}
function compileError(source: string): ClarusError {
  try { compile(source, { file: 'x.clarus', target: 'server', clientUrl: '/c.js' }) } catch (e) { return e as ClarusError }
  throw new Error('expected compile to throw')
}

test('wrapped content renders at <slot />, in the page scope, escaped exactly once', async () => {
  const html = await renderPage(`@import docs from './docs.clarus'\n@input who: string\n<docs [title]="'x'">Hi {{ who }}</docs>`, { who: '<b>' })
  expect(html).toBe('<main>Hi &lt;b&gt;</main>')
})

test('a component used without content renders an empty slot', async () => {
  expect(await renderPage(`@import docs from './docs.clarus'\n<docs [title]="'x'" />`)).toBe('<main></main>')
})

test('islands inside wrapped content keep working', async () => {
  const html = await renderPage(`@import docs from './docs.clarus'\n@import counter from './counter.clarus'\n<docs [title]="'x'"><counter [start]="1" /></docs>`)
  expect(html).toMatch(/^<main><cl-island c="counter" src="\/c\.js"/)
  expect(html.endsWith('</cl-island></main>')).toBe(true)
})

test('slots nest', async () => {
  const html = await renderPage(`@import docs from './docs.clarus'\n@import card from './card.clarus'\n<docs [title]="'x'"><card>inner</card></docs>`)
  expect(html).toBe('<main><div class="card">inner</div></main>')
})

test('giving content to a stateful component fails when rendering, naming it', async () => {
  await expect(renderPage(`@import counter from './counter.clarus'\n<counter [start]="1">x</counter>`)).rejects.toThrow(/<counter> does not accept children yet/)
})

test('<slot /> in a stateful component is a located build error', () => {
  expect(compileError('<script>let n = state(0)</script>\n<p><slot /></p>').message).toMatch(/^x\.clarus:2:4 .*only supported in components without <script>/)
})

test('only one <slot /> per component', () => {
  expect(compileError('<slot /><slot />').message).toMatch(/^x\.clarus:1:9 .*only one <slot \/>/)
})

test('named slots are not supported yet', () => {
  expect(compileError('<slot name="aside" />').message).toMatch(/^x\.clarus:1:1 .*named slots are not supported yet/)
})

test('<slot> takes no children', () => {
  expect(compileError('<slot>fallback</slot>').message).toMatch(/^x\.clarus:1:1 .*<slot \/> takes no children/)
})
