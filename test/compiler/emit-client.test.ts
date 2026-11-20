// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { beforeEach, expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { importCode } from '../helpers.ts'

const fixture = (name: string) => readFileSync(`${import.meta.dirname}/../fixtures/${name}`, 'utf8')
const URL_ = '/src/components/counter.kvw?import'

async function load(name: string) {
  const source = fixture(`${name}.kvw`)
  const server = await importCode(compile(source, { file: `${name}.kvw`, target: 'server', clientUrl: URL_ }).code, `${name}-s`)
  const client = await importCode(compile(source, { file: `${name}.kvw`, target: 'client' }).code, `${name}-c`)
  return { render: server.render, attach: client.attach }
}
const islands = () => [...document.querySelectorAll('kv-island')]

beforeEach(() => { document.body.innerHTML = '' })

test('counter client output is readable and exact', () => {
  expect(compile(fixture('counter.kvw'), { file: 'counter.kvw', target: 'client' }).code).toBe(
`import { state, derived, holes as __kv_holes, text as __kv_text, on as __kv_on } from 'kview/runtime'

export function attach(__kv_root, __kv_props = {}) {
  const { start = 0 } = __kv_props
  const count = state(start)
  const double = derived(() => count.get() * 2)
  function add() { count.set(count.get() + 1) }

  const __kv_h = __kv_holes(__kv_root)
  __kv_text(__kv_h[0], () => count.get())
  __kv_text(__kv_h[1], () => double.get())
  __kv_on(__kv_root, 0, "click", ($event) => { add() })
}
`)
})

test('stateless component compiles to an empty client module', () => {
  expect(compile(fixture('greeting.kvw'), { file: 'greeting.kvw', target: 'client' })).toEqual({ code: 'export {}\n', stateful: false })
})

test('attach wires server HTML without re-rendering it', async () => {
  const { render, attach } = await load('counter')
  document.body.innerHTML = render({ start: 3 })
  const [island] = islands()
  const button = island!.querySelector('button')!
  const textNode = [...button.childNodes].find((n) => n.nodeType === 3 && n.textContent === '3')!
  attach(island, { start: 3 })
  button.click()
  expect(button.textContent).toBe('Clicked 4 times (double: 8)')
  expect(island!.querySelector('button')).toBe(button)
  expect(textNode.textContent).toBe('4')
  expect(textNode.parentNode).toBe(button)
})

test('a hole that starts empty still updates', async () => {
  const { render, attach } = await load('label')
  const html = render()
  expect(html).toContain('<!--[0--><!--]-->')
  document.body.innerHTML = html
  const [island] = islands()
  attach(island, {})
  island!.querySelector('span')!.click()
  expect(island!.querySelector('span')!.textContent).toBe('hi')
})

test('two islands of the same component are independent', async () => {
  const { render, attach } = await load('counter')
  document.body.innerHTML = render({ start: 1 }) + render({ start: 10 })
  const [a, b] = islands()
  attach(a, { start: 1 })
  attach(b, { start: 10 })
  a!.querySelector('button')!.click()
  a!.querySelector('button')!.click()
  expect(a!.textContent).toBe('Clicked 3 times (double: 6)')
  expect(b!.textContent).toBe('Clicked 10 times (double: 20)')
})
