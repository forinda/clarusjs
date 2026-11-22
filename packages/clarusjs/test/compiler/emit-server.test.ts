import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { importCode } from '../helpers.ts'

const fixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8')
const URL_ = '/src/components/counter.tscl?import'
const server = (source: string, file: string) => compile(source, { file, target: 'server', clientUrl: URL_ })

// The exact output is pinned by test/compiler/fixtures/counter (fixtures.test.ts).
test('counter renders an island with markers around reactive holes only', async () => {
  const { render } = await importCode(server(fixture('counter.tscl'), 'src/components/counter.tscl').code, 'counter')
  expect(render({ start: 3 })).toBe(
    '<cl-island c="counter" src="/src/components/counter.tscl?import" p="{&quot;start&quot;:3}" s="{&quot;count&quot;:3}"><button data-cl-e="0">Clicked <!--[0-->3<!--]--> times (double: <!--[1-->6<!--]-->)</button></cl-island>',
  )
})

test('stateless component escapes hostile input and has no island', async () => {
  const { render } = await importCode(server(fixture('greeting.tscl'), 'greeting.tscl').code, 'greeting')
  expect(render({ name: '<img src=x onerror=alert(1)>' })).toBe('<p>Hello, &lt;img src=x onerror=alert(1)&gt;!</p>')
})

test('static text with backticks, ${, backslashes and quotes is byte-identical', async () => {
  const text = '<pre>a `b` ${c} \\d "e" \'f\'</pre>'
  const { render } = await importCode(server(text, 'pre.tscl').code, 'pre')
  expect(render()).toBe(text)
})

test('page renders imported stateless components in place', async () => {
  const greeting = server(fixture('greeting.tscl'), 'greeting.tscl').code
  const page = server(`@import greeting from './greeting.tscl'\n<h1>Hi</h1>\n<greeting [name]="'world'" />`, 'index.tscl').code
  const { render } = await importCode(page, 'page', { './greeting.tscl': greeting })
  expect(render()).toBe('<h1>Hi</h1><p>Hello, world!</p>')
})

test('stateful server compile requires clientUrl', () => {
  expect(() => compile(fixture('counter.tscl'), { file: 'counter.tscl', target: 'server' })).toThrow(/clientUrl/)
})

test('renderImports: a browser render module imports its child components as render modules too', () => {
  const src = `@import badge from './badge.tscl'\n<p><badge /></p>`
  expect(compile(src, { file: 'x.tscl', target: 'server' }).code).toContain(`import { render as __cl_render_badge } from './badge.tscl'\n`)
  expect(compile(src, { file: 'x.tscl', target: 'server', renderImports: true }).code).toContain(`import { render as __cl_render_badge } from './badge.tscl?render'\n`)
})
