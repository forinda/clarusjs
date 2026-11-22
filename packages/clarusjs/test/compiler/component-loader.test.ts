// #97: a component with a loader merges its loaded data under its props when it renders (render stays sync).
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { withLoaded } from '../../src/runtime/server.ts'
import { importCode } from '../helpers.ts'

const source = '@input title: string = "default"\n@input count: number = 0\n<p>{{ title }} {{ count }}</p>\n'

test('with a loader key: the loaded data fills the inputs, and props from the parent win', async () => {
  const { render } = await importCode(compile(source, { file: 'src/components/stat.tscl', target: 'server', loader: 'src/components/stat.tscl' }).code, 'loader-a')
  const data = new Map([['src/components/stat.tscl', { title: 'Visits', count: 42 }]])
  expect(withLoaded(data, () => render({}))).toBe('<p>Visits 42</p>')
  expect(withLoaded(data, () => render({ count: 7 }))).toBe('<p>Visits 7</p>')
  // Outside a render with data (or another component's data): the component's own defaults.
  expect(render({})).toBe('<p>default 0</p>')
  expect(withLoaded(new Map([['other.tscl', { title: 'x' }]]), () => render({}))).toBe('<p>default 0</p>')
})

test('without one: the output is what it always was (no lookup)', () => {
  const code = compile(source, { file: 'src/components/stat.tscl', target: 'server' }).code
  expect(code).not.toContain('__cl_loaded')
})

test('withLoaded restores the outer data, even when the render throws', () => {
  const outer = new Map([['k', { a: 1 }]])
  withLoaded(outer, () => {
    expect(() => withLoaded(new Map(), () => { throw new Error('boom') })).toThrow('boom')
    expect((globalThis as { __clLoaded?: Map<string, object> }).__clLoaded).toBe(outer)
  })
  expect((globalThis as { __clLoaded?: unknown }).__clLoaded).toBeUndefined()
})
