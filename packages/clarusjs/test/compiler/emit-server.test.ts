import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { importCode } from '../helpers.ts'

const fixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8')
const URL_ = '/src/components/counter.tscl?import'
const server = (source: string, file: string) => compile(source, { file, target: 'server', clientUrl: URL_ })

test('counter server output is readable and exact', () => {
  expect(server(fixture('counter.tscl'), 'src/components/counter.tscl').code).toBe(
`import { escape as __cl_escape, island as __cl_island } from 'clarusjs/runtime/server'

export function render(__cl_props = {}, __cl_slots, __cl_opts) {
  if (__cl_slots !== undefined) throw new Error("[clarusjs] <counter> does not accept children yet")
  const { start = 0 } = __cl_props
  let count = (start)
  const double = (() => count * 2)()
  function add() { count++ }
  return __cl_island("counter", "/src/components/counter.tscl?import", { start }, "<button data-cl-e=\\"0\\">Clicked " + "<!--[0-->" + __cl_escape(count) + "<!--]-->" + " times (double: " + "<!--[1-->" + __cl_escape(double) + "<!--]-->" + ")</button>", { count }, __cl_opts?.attach, __cl_opts?.path)
}
`)
})

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
