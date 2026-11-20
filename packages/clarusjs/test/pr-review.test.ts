// @vitest-environment happy-dom
// Regression tests for the CodeRabbit review on PR #1 (compiler + browser runtime).
import { describe, expect, test, vi } from 'vitest'
import { compile } from '../src/compiler/index.ts'
import { ClarusError } from '../src/compiler/errors.ts'
import { lower } from '../src/compiler/ir.ts'
import { parse } from '../src/compiler/parse.ts'
import { derived, effect, state } from '../src/runtime/signals.ts'
import { on } from '../src/runtime/dom.ts'
import { attachAll } from '../src/runtime/loader.ts'
import { importCode } from './helpers.ts'

async function mount(source: string, props = {}) {
  const server = await importCode(compile(source, { file: 'x.tscl', target: 'server', clientUrl: '/x' }).code, 'pr-s')
  const client = await importCode(compile(source, { file: 'x.tscl', target: 'client' }).code, 'pr-c')
  document.body.innerHTML = server.render(props)
  const island = document.querySelector('cl-island')!
  client.attach(island, props)
  return island
}
function compileError(source: string): ClarusError {
  try { compile(source, { file: 'x.tscl', target: 'client' }) } catch (e) { return e as ClarusError }
  throw new Error('expected compile to throw')
}

describe('major', () => {
  test('a handler ending in a line comment still compiles', async () => {
    const island = await mount('<script>let n = state(0)</script>\n<b (click)="n++ // increment">{{ n }}</b>')
    island.querySelector('b')!.click()
    expect(island.textContent).toBe('1')
  })

  test('reactive holes inside textarea, title or style are a build error', () => {
    for (const tag of ['textarea', 'title', 'style']) {
      const e = compileError(`<script>let n = state(0)</script>\n<${tag}>{{ n }}</${tag}>`)
      expect(e.message).toMatch(new RegExp(`^x\\.tscl:2:${tag.length + 3} .*<${tag}>`))
    }
  })

  test('non-reactive holes inside title are fine', () => {
    expect(() => compile('@input t: string\n<title>{{ t }}</title>', { file: 'x.tscl', target: 'server' })).not.toThrow()
  })

  test('}} inside strings and nested objects does not end a hole', () => {
    const f = parse('<p>{{ "}}" }}|{{ ({a:{b:1}}).a.b }}</p>', 'x.tscl')
    const p = f.nodes[0] as { children: { type: string; expr?: string }[] }
    expect(p.children.filter((c) => c.type === 'expr').map((c) => c.expr)).toEqual(['"}}"', '({a:{b:1}}).a.b'])
  })

  test('import/export in an event handler is a located build error', () => {
    expect(compileError("<script>let n = state(0)</script>\n<b (click)=\"import x from 'y'\">x</b>").message)
      .toMatch(/^x\.tscl:2:4 .*imports .*not supported/)
  })

  test('destructured script names make holes reactive', async () => {
    const island = await mount('<script>\n  let count = state(1)\n  const { read } = { read: () => count }\n</script>\n<b (click)="count++">{{ read() }}</b>')
    island.querySelector('b')!.click()
    expect(island.textContent).toBe('2')
  })

  test('a parameter or local that shadows a signal is left alone', async () => {
    const src = `<script>
  let count = state(0)
  let shown = state(0)
  function identity(count) { return count }
  function local() { const { count } = { count: 40 }; { let shown = 2; return count + shown } }
</script>
<b (click)="shown = identity(7) + local()">{{ shown }}</b>`
    const island = await mount(src)
    island.querySelector('b')!.click()
    expect(island.textContent).toBe('49')
  })

  test('components with names that differ only by - and _ get distinct aliases', async () => {
    const a = compile('<i>dash</i>', { file: 'foo-bar.tscl', target: 'server' }).code
    const b = compile('<i>under</i>', { file: 'foo_bar.tscl', target: 'server' }).code
    const page = compile(`@import foo-bar from './foo-bar.tscl'\n@import foo_bar from './foo_bar.tscl'\n<foo-bar /><foo_bar />`, { file: 'p.tscl', target: 'server' }).code
    const { render } = await importCode(page, 'pr-names', { './foo-bar.tscl': a, './foo_bar.tscl': b })
    expect(render()).toBe('<i>dash</i><i>under</i>')
  })
})

describe('minor', () => {
  test('comma expressions keep their value on server and client', async () => {
    const island = await mount('<script>let n = state(1)</script>\n<b (click)="n++">{{ n, n * 10 }}</b>')
    expect(island.textContent).toBe('10')
    island.querySelector('b')!.click()
    expect(island.textContent).toBe('20')
  })

  test('prefix and postfix updates yield the right values', async () => {
    const src = `<script>
  let n = state(5)
  let a = state(0)
  let b = state(0)
</script>
<b (click)="a = n++; b = ++n">{{ a }},{{ b }},{{ n }}</b>`
    const island = await mount(src)
    island.querySelector('b')!.click()
    expect(island.textContent).toBe('5,7,7')
  })

  test('an invalid @input default is a located build error', () => {
    expect(compileError('@input start: number = )\n<p>x</p>').message).toMatch(/^x\.tscl:1:1 /)
  })

  test('multiline template literals in <script> keep their content', async () => {
    const src = '<script>\n  let n = state(0)\n  const message = `first\nsecond`\n</script>\n<pre (click)="n++">{{ message }}</pre>'
    const island = await mount(src)
    expect(island.querySelector('pre')!.textContent).toBe('first\nsecond')
  })

  test('stopPropagation in an inner handler stops the outer one', async () => {
    const src = `<script>
  let outer = state(0)
  let inner = state(0)
</script>
<div (click)="outer++"><b (click)="$event.stopPropagation(); inner++">{{ inner }}</b>{{ outer }}</div>`
    const island = await mount(src)
    island.querySelector('b')!.click()
    expect(island.textContent).toBe('10')
  })

  test('focus and blur handlers fire through delegation', () => {
    document.body.innerHTML = '<cl-island><input data-cl-e="0"></cl-island>'
    const root = document.querySelector('cl-island')!
    const seen: string[] = []
    on(root, 0, 'focus', () => seen.push('focus'))
    on(root, 0, 'blur', () => seen.push('blur'))
    const input = root.querySelector('input')!
    input.dispatchEvent(new FocusEvent('focus'))
    input.dispatchEvent(new FocusEvent('blur'))
    expect(seen).toEqual(['focus', 'blur'])
  })

  test('a disposed effect does not run or resubscribe in the same set()', () => {
    const s = state(0)
    let bRuns = 0
    let stopB = () => {}
    effect(() => { if (s.get() === 1) stopB() })
    stopB = effect(() => { s.get(); bRuns++ })
    s.set(1)
    s.set(2)
    expect(bRuns).toBe(1)
  })

  test('derived still works with disposal tracking', () => {
    const s = state(2)
    const d = derived(() => s.get() + 1)
    s.set(4)
    expect(d.get()).toBe(5)
  })

  test('an island whose chunk failed to load is retried by the next attachAll', async () => {
    document.body.innerHTML = '<cl-island c="c" src="/c.js" p="{}"></cl-island>'
    const attach = vi.fn()
    let fail = true
    const load = vi.fn(async () => { if (fail) throw new Error('offline'); return { attach } })
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    await attachAll(document, load)
    expect(attach).not.toHaveBeenCalled()
    fail = false
    await attachAll(document, load)
    expect(attach).toHaveBeenCalledTimes(1)
    await attachAll(document, load)
    expect(attach).toHaveBeenCalledTimes(1)
    error.mockRestore()
  })

  test('an island whose attach() threw is not retried (no duplicate listeners)', async () => {
    document.body.innerHTML = '<cl-island c="c" src="/c.js" p="{}"></cl-island>'
    const attach = vi.fn(() => { throw new Error('boom') })
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    await attachAll(document, async () => ({ attach }))
    await attachAll(document, async () => ({ attach }))
    expect(attach).toHaveBeenCalledTimes(1)
    error.mockRestore()
  })
})
