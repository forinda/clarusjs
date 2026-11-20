// @vitest-environment happy-dom
// #77: data imports in templates.
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { ClarusError } from '../../src/compiler/errors.ts'
import { parse } from '../../src/compiler/parse.ts'
import { importCode } from '../helpers.ts'

const nav = `export const nav = [{ title: 'Intro', href: '/intro' }, { title: 'Islands', href: '/islands' }]\nexport const site = 'clarusjs'\nexport default { tagline: 'Clear' }\n`
function compileError(source: string): ClarusError {
  try { compile(source, { file: 'x.clarus', target: 'server', clientUrl: '/x' }) } catch (e) { return e as ClarusError }
  throw new Error('expected compile to throw')
}

test('parses brace imports and non-.clarus default imports as data', () => {
  const f = parse(`@import { nav, site as name } from './nav.ts'\n@import meta from './nav.ts'\n@import badge from './badge.clarus'\n<p>x</p>`, 'x.clarus')
  expect(f.dataImports.map((d) => ({ clause: d.clause, from: d.from }))).toEqual([
    { clause: '{ nav, site as name }', from: './nav.ts' },
    { clause: 'meta', from: './nav.ts' },
  ])
  expect(f.imports.map((i) => i.name)).toEqual(['badge'])
})

test('a component without a script renders imported data on the server', async () => {
  const src = `@import { nav, site } from './nav.js'\n@import meta from './nav.js'\n<nav>@for (item of nav) {<a [href]="item.href">{{ item.title }}</a>}</nav><p>{{ site }}: {{ meta.tagline }}</p>`
  const { render } = await importCode(compile(src, { file: 'x.clarus', target: 'server' }).code, 'data-s', { './nav.js': nav })
  expect(render()).toBe('<nav><a href="/intro">Intro</a><a href="/islands">Islands</a></nav><p>clarusjs: Clear</p>')
})

test('a component without a script may import node: modules (server-only); its client module stays empty', () => {
  const src = `@import { readFileSync } from 'node:fs'\n<p>{{ typeof readFileSync }}</p>`
  expect(compile(src, { file: 'x.clarus', target: 'server' }).code).toContain(`import { readFileSync } from 'node:fs'`)
  expect(compile(src, { file: 'x.clarus', target: 'client' }).code).toBe('export {}\n')
})

test('an island imports data in the browser too, and node: imports are an error there', async () => {
  const src = `@import { nav } from './nav.js'\n<script>let i = state(0)</script>\n<b (click)="i = (i + 1) % nav.length">{{ nav[i].title }}</b>`
  const client = compile(src, { file: 'x.clarus', target: 'client' }).code
  expect(client).toContain(`import { nav } from './nav.js'`)
  const s = await importCode(compile(src, { file: 'x.clarus', target: 'server', clientUrl: '/x' }).code, 'data-is', { './nav.js': nav })
  const c = await importCode(client, 'data-ic', { './nav.js': nav })
  document.body.innerHTML = s.render()
  const island = document.querySelector('cl-island')!
  c.attach(island, {}, { i: 0 })
  ;(island.querySelector('b') as HTMLElement).click()
  expect(island.textContent).toBe('Islands')
  expect(compileError(`@import { readFileSync } from 'node:fs'\n<script>let n = state(0)</script>\n<b (click)="n++">x</b>`).message)
    .toMatch(/^x\.clarus:1:1 .*node:fs.*browser/)
})
