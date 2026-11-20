// #8: a `verbatim` element shows its content as text: no holes, tags or directives inside.
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { ClarusError } from '../../src/compiler/errors.ts'
import { parse } from '../../src/compiler/parse.ts'
import { importCode } from '../helpers.ts'

const render = async (source: string) => {
  const { render } = await importCode(compile(source, { file: 'x.clarus', target: 'server' }).code, 'verbatim')
  return render() as string
}
function compileError(source: string): ClarusError {
  try { compile(source, { file: 'x.clarus', target: 'server' }) } catch (e) { return e as ClarusError }
  throw new Error('expected compile to throw')
}

test('content is kept raw by the parser', () => {
  const f = parse('<pre verbatim>{{ x }} <b>@input</b></pre>', 'x.clarus')
  expect(f.nodes[0]).toMatchObject({ type: 'element', tag: 'pre', attrs: [], children: [{ type: 'raw', value: '{{ x }} <b>@input</b>' }] })
})

test('content renders as escaped text and the attribute is dropped', async () => {
  expect(await render('<pre><code verbatim>@input start: number = 0\n<button (click)="add()">{{ count }}</button></code></pre>'))
    .toBe('<pre><code>@input start: number = 0\n&lt;button (click)="add()"&gt;{{ count }}&lt;/button&gt;</code></pre>')
})

test('ampersands are escaped, quotes are kept', async () => {
  expect(await render(`<code verbatim>a && b ? "x" : 'y'</code>`)).toBe(`<code>a &amp;&amp; b ? "x" : 'y'</code>`)
})

test('template comments and script tags inside are text too', async () => {
  expect(await render('<pre verbatim>{{-- note --}}\n<script>let n = state(0)</script></pre>'))
    .toBe('<pre>{{-- note --}}\n&lt;script&gt;let n = state(0)&lt;/script&gt;</pre>')
})

test('verbatim works inside a stateful component without adding markers', async () => {
  const out = compile('<script>let n = state(0)</script>\n<b (click)="n++">{{ n }}</b><pre verbatim>{{ n }}</pre>', { file: 'x.clarus', target: 'server', clientUrl: '/x' }).code
  expect(out).toContain('</b><pre>{{ n }}</pre>")') // plain static text: no hole markers, no escape() call
})

test('verbatim with a value is a located build error', () => {
  expect(compileError('<pre verbatim="yes">x</pre>').message).toMatch(/^x\.clarus:1:6 .*verbatim takes no value/)
})

test('verbatim on a component is a located build error', () => {
  expect(compileError(`@import card from './card.clarus'\n<card verbatim>x</card>`).message).toMatch(/^x\.clarus:2:7 .*verbatim only works on HTML elements/)
})

test('an unclosed verbatim element is a located build error', () => {
  expect(compileError('<p>a</p>\n<pre verbatim>{{ x }}').message).toMatch(/^x\.clarus:2:1 .*unclosed <pre verbatim>/)
})
