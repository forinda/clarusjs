// @vitest-environment happy-dom
// #430 part 2: @await (promise) { pending } @then (value) { … } @catch (error) { … }. Outside islands the server
// awaits it (the data is in the HTML); in an island the server renders the pending branch and the browser swaps in
// @then or @catch when the promise settles, the newest promise winning.
import { afterEach, expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { ClarusError } from '../../src/compiler/errors.ts'
import { parse } from '../../src/compiler/parse.ts'
import { importCode, unscoped } from '../helpers.ts'

const server = (source: string) => compile(source, { file: 'x.tscl', target: 'server', clientUrl: '/x', scope: 's' }).code
const flush = () => new Promise((r) => setTimeout(r, 0))
function compileError(source: string): string {
  try { compile(source, { file: 'x.tscl', target: 'server', clientUrl: '/x' }); return '' } catch (e) { return (e as ClarusError).message }
}
afterEach(() => { delete (globalThis as { __get?: unknown }).__get })

test('parses @await with its pending block, @then (name) and @catch (name)', () => {
  const f = parse('@await (load()) { <i>…</i> } @then (rows) { {{ rows.length }} } @catch (e) { <b>{{ e }}</b> }', 'x.tscl')
  expect(f.nodes[0]).toMatchObject({
    type: 'await', expr: 'load()',
    pending: [{ type: 'text' }, { type: 'element', tag: 'i' }, { type: 'text' }],
    then: { name: 'rows', children: [{ type: 'text' }, { type: 'expr', expr: 'rows.length' }, { type: 'text' }] },
    catch: { name: 'e', children: [{ type: 'text' }, { type: 'element', tag: 'b' }, { type: 'text' }] },
  })
  expect(parse('@await (p) { wait }', 'x.tscl').nodes[0]).toMatchObject({ type: 'await', then: null, catch: null })
})

test('errors at their place: @then or @catch on their own, a name that isn\'t one, two @then', () => {
  expect(compileError('<p></p>\n@then (x) { }\n')).toMatch(/x\.tscl:2:1 @then without @await/)
  expect(compileError('@await (p) { } @then (a.b) { }\n')).toMatch(/x\.tscl:1:23 @then takes a name/)
  expect(compileError('@await (p) { } @catch (e) { } @then (v) { }\n')).toMatch(/@then comes before @catch/)
})

test('outside islands the server awaits it: @then with the value, @catch with the error (escaped as usual)', async () => {
  const src = "@input fail: boolean = false\n@await (fail ? Promise.reject(new Error('<down>')) : Promise.resolve(['a', 'b'])) { <p>Loading</p> } @then (rows) { <ul>@for (r of rows; track r) {<li>{{ r }}</li>}</ul> } @catch (e) { <p>{{ e.message }}</p> }\n"
  const { render } = await importCode(server(src), 'aw-s')
  const ok = render({})
  expect(ok).toBeInstanceOf(Promise)
  expect(unscoped(await ok)).toBe(' <ul><li>a</li><li>b</li></ul> ')
  expect(unscoped(await render({ fail: true }))).toBe(' <p>&lt;down&gt;</p> ')
})

test('outside islands, without @catch, a rejection fails the render (like a failing load())', async () => {
  const { render } = await importCode(server("@await (Promise.reject(new Error('gone'))) { } @then (v) { {{ v }} }\n"), 'aw-r')
  await expect(render({})).rejects.toThrow('gone')
})

const island = `<script>
  let id = state(1)
  globalThis.__bump = () => { id++ }
</script>
<section>
@await (globalThis.__get(id)) { <p class="pending">Loading {{ id }}</p> } @then (v) { <p class="v">{{ v }} for {{ id }}</p><button (click)="id++">next</button> } @catch (e) { <p class="err">{{ e.message }}</p> }
</section>
`

test('in an island the server renders the pending branch inside block markers; nothing is awaited there', async () => {
  ;(globalThis as { __get?: unknown }).__get = () => new Promise(() => {})
  const html = (await importCode(server(island), 'aw-is')).render({}) as string
  expect(html).toContain('<!--[b0:0-->')
  expect(html.replace(/<!--.*?-->/g, '')).toContain('Loading 1') // hole markers aside
})

test('in an island the browser swaps in @then when it settles; events inside it work; a newer promise wins; @catch', async () => {
  const waiting = new Map<number, { resolve(v: unknown): void; reject(e: unknown): void }>()
  ;(globalThis as { __get?: unknown }).__get = (n: number) => new Promise((resolve, reject) => waiting.set(n, { resolve, reject }))
  const s = await importCode(server(island), 'aw-ms')
  const c = await importCode(compile(island, { file: 'x.tscl', target: 'client' }).code, 'aw-mc')
  document.body.innerHTML = s.render({})
  const root = document.querySelector('cl-island')!
  c.attach(root, {})
  expect(root.querySelector('.pending')!.textContent).toBe('Loading 1')
  waiting.get(1)!.resolve('one')
  await flush()
  expect(root.querySelector('.v')!.textContent).toBe('one for 1')
  ;(root.querySelector('button') as HTMLElement).click() // id = 2: a new promise, back to pending
  expect(root.querySelector('.pending')!.textContent).toBe('Loading 2')
  waiting.get(2)!.resolve('two')
  await flush()
  expect(root.querySelector('.v')!.textContent).toBe('two for 2')
  // 3 is asked, then 4 before 3 settles: 4's answer shows, and 3's (later) is ignored.
  const bump = (globalThis as { __bump?: () => void }).__bump!
  bump()
  bump()
  waiting.get(4)!.resolve('four')
  await flush()
  waiting.get(3)!.resolve('three')
  await flush()
  expect(root.querySelector('.v')!.textContent).toBe('four for 4')
  bump()
  waiting.get(5)!.reject(new Error('down'))
  await flush()
  expect(root.querySelector('.err')!.textContent).toBe('down')
})
