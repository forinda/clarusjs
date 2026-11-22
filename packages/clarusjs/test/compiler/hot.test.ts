// #53: in dev, an island's client module accepts its own updates and hands its state to the new version.
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'

const source = `@input start: number = 0
<script>
  let count = state(start)
  let open = state(false)
  const double = derived(() => count * 2)
</script>
<button (click)="count++">{{ count }} {{ double }} {{ open }}</button>
`

test('with a hot module: attach exposes its state signals and the module swaps itself in when it changes', () => {
  const code = compile(source, { file: 'src/components/counter.tscl', target: 'client', hot: '/cl-hot.js' }).code
  expect(code).toContain(`import { swap as __cl_swap } from "/cl-hot.js"`)
  // Only state signals: inputs come from props, derived values follow from state.
  expect(code).toContain('__cl_root.__cl_hot = () => ({ count: count.get(), open: open.get() })')
  expect(code).toContain('if (import.meta.hot) { import.meta.hot.accept(); if (import.meta.hot.data.cl) __cl_swap(import.meta.url); import.meta.hot.data.cl = 1 }')
})

test('the snapshot is taken before attach returns its props update', () => {
  const withInput = compile(source, { file: 'src/components/counter.tscl', target: 'client', hot: '/cl-hot.js' }).code
  expect(withInput.indexOf('__cl_root.__cl_hot')).toBeLessThan(withInput.indexOf('return (__cl_p)'))
})

test('without it (builds): no hot code', () => {
  const code = compile(source, { file: 'src/components/counter.tscl', target: 'client' }).code
  expect(code).not.toContain('import.meta.hot')
  expect(code).not.toContain('__cl_hot')
})

test('a stateless component stays empty', () => {
  expect(compile('<p>hi</p>\n', { file: 'src/components/p.tscl', target: 'client', hot: '/cl-hot.js' }).code).toBe('export {}\n')
})
