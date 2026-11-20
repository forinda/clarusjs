import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { importCode } from '../helpers.ts'

const fixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8')
const URL_ = '/src/components/counter.kvw?import'
const server = (source: string, file: string) => compile(source, { file, target: 'server', clientUrl: URL_ })

test('counter server output is readable and exact', () => {
  expect(server(fixture('counter.kvw'), 'src/components/counter.kvw').code).toBe(
`import { escape as __kv_escape, island as __kv_island } from 'clarusjs/runtime/server'

export function render(__kv_props = {}) {
  const { start = 0 } = __kv_props
  let count = (start)
  const double = (() => count * 2)()
  function add() { count++ }
  return __kv_island("counter", "/src/components/counter.kvw?import", { start }, "<button data-kv-e=\\"0\\">Clicked " + "<!--[0-->" + __kv_escape(count) + "<!--]-->" + " times (double: " + "<!--[1-->" + __kv_escape(double) + "<!--]-->" + ")</button>")
}
`)
})

test('counter renders an island with markers around reactive holes only', async () => {
  const { render } = await importCode(server(fixture('counter.kvw'), 'src/components/counter.kvw').code, 'counter')
  expect(render({ start: 3 })).toBe(
    '<kv-island c="counter" src="/src/components/counter.kvw?import" p="{&quot;start&quot;:3}"><button data-kv-e="0">Clicked <!--[0-->3<!--]--> times (double: <!--[1-->6<!--]-->)</button></kv-island>',
  )
})

test('stateless component escapes hostile input and has no island', async () => {
  const { render } = await importCode(server(fixture('greeting.kvw'), 'greeting.kvw').code, 'greeting')
  expect(render({ name: '<img src=x onerror=alert(1)>' })).toBe('<p>Hello, &lt;img src=x onerror=alert(1)&gt;!</p>')
})

test('static text with backticks, ${, backslashes and quotes is byte-identical', async () => {
  const text = '<pre>a `b` ${c} \\d "e" \'f\'</pre>'
  const { render } = await importCode(server(text, 'pre.kvw').code, 'pre')
  expect(render()).toBe(text)
})

test('page renders imported stateless components in place', async () => {
  const greeting = server(fixture('greeting.kvw'), 'greeting.kvw').code
  const page = server(`@import greeting from './greeting.kvw'\n<h1>Hi</h1>\n<greeting [name]="'world'" />`, 'index.kvw').code
  const { render } = await importCode(page, 'page', { './greeting.kvw': greeting })
  expect(render()).toBe('<h1>Hi</h1><p>Hello, world!</p>')
})

test('stateful server compile requires clientUrl', () => {
  expect(() => compile(fixture('counter.kvw'), { file: 'counter.kvw', target: 'server' })).toThrow(/clientUrl/)
})
