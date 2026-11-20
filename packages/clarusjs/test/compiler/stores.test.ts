// @vitest-environment happy-dom
// #16: shared client stores, and imports in <script>.
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { ClarusError } from '../../src/compiler/errors.ts'
import { attachAll } from '../../src/runtime/loader.ts'
import { state } from '../../src/runtime/signals.ts'
import { importCode } from '../helpers.ts'

function compileError(source: string): ClarusError {
  try { compile(source, { file: 'x.clarus', target: 'client' }) } catch (e) { return e as ClarusError }
  throw new Error('expected compile to throw')
}

test('imports in <script> are hoisted to the top of both modules', () => {
  const src = `<script>\n  import { fmt } from './fmt.ts'\n  let n = state(1)\n</script>\n<b (click)="n++">{{ fmt(n) }}</b>`
  const server = compile(src, { file: 'x.clarus', target: 'server', clientUrl: '/x' }).code
  const client = compile(src, { file: 'x.clarus', target: 'client' }).code
  for (const code of [server, client]) {
    expect(code).toMatch(/^import .*\nimport \{ fmt \} from '\.\/fmt\.ts'\n/)
    expect(code.split("import { fmt } from './fmt.ts'").length - 1).toBe(1)
  }
})

test('node: imports in an island script are a located build error', () => {
  expect(compileError(`<script>\n  import { readFileSync } from 'node:fs'\n</script>\n<p>x</p>`).message).toMatch(/^x\.clarus:2:3 .*node:fs.*browser/)
})

const storeSrc = (name: string) => `<script>
  import { todos } from '/store.js'
  let items = shared(todos)
</script>
<p class="${name}">{{ items.length }}</p><b class="add-${name}" (click)="items = [...items, '${name}']">+</b>`

async function mountTwo(store: unknown) {
  ;(globalThis as any).__testStore = store
  const deps = { '/store.js': 'export const todos = globalThis.__testStore' }
  const a = { s: await importCode(compile(storeSrc('a'), { file: 'a.clarus', target: 'server', clientUrl: '/a.js' }).code, 'st-as', deps),
    c: await importCode(compile(storeSrc('a'), { file: 'a.clarus', target: 'client' }).code, 'st-ac', deps) }
  const b = { s: await importCode(compile(storeSrc('b'), { file: 'b.clarus', target: 'server', clientUrl: '/b.js' }).code, 'st-bs', deps),
    c: await importCode(compile(storeSrc('b'), { file: 'b.clarus', target: 'client' }).code, 'st-bc', deps) }
  return { a, b }
}

test('two islands using one store stay in sync', async () => {
  const todos = state<string[]>([])
  const { a, b } = await mountTwo(todos)
  document.body.innerHTML = a.s.render() + b.s.render()
  const modules: Record<string, unknown> = { '/a.js': a.c, '/b.js': b.c }
  await attachAll(document, async (src) => modules[src] as any)
  ;(document.querySelector('.add-a') as HTMLElement).click()
  ;(document.querySelector('.add-b') as HTMLElement).click()
  expect(document.querySelector('.a')!.textContent).toBe('2')
  expect(document.querySelector('.b')!.textContent).toBe('2')
  expect(todos.get()).toEqual(['a', 'b'])
})

test('on the server a shared value renders from the store\'s initial value, never its current one', async () => {
  const todos = state<string[]>(['seed'])
  todos.set(['leaked from another request'])
  const { a } = await mountTwo(todos)
  const html = a.s.render() as string
  expect(html).toContain('<p class="a"><!--[0-->1<!--]--></p>')
  expect(html).not.toContain(' s="')
})

test('each server render gets its own copy of a store\'s initial value', async () => {
  const todos = state<string[]>(['seed'])
  ;(globalThis as any).__testStore = todos
  const src = `<script>
  import { todos } from '/store.js'
  let items = shared(todos)
  items.push('added during render')
</script>
<p>{{ items.length }}</p><b (click)="items = []">x</b>`
  const { render } = await importCode(compile(src, { file: 'm.clarus', target: 'server', clientUrl: '/m.js' }).code, 'st-mut', { '/store.js': 'export const todos = globalThis.__testStore' })
  expect(render()).toContain('<!--[0-->2<!--]-->')
  expect(render()).toContain('<!--[0-->2<!--]-->')
  expect(todos.initial).toEqual(['seed'])
})
