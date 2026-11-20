// @vitest-environment happy-dom
// #10: @if / @else if / @else blocks.
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { ClarusError } from '../../src/compiler/errors.ts'
import { parse } from '../../src/compiler/parse.ts'
import { importCode } from '../helpers.ts'

const server = (source: string) => compile(source, { file: 'x.tscl', target: 'server', clientUrl: '/x' }).code
async function render(source: string, props = {}) {
  return (await importCode(server(source), 'if-s')).render(props) as string
}
function compileError(source: string): ClarusError {
  try { compile(source, { file: 'x.tscl', target: 'server', clientUrl: '/x' }) } catch (e) { return e as ClarusError }
  throw new Error('expected compile to throw')
}
async function mount(source: string, props = {}) {
  const s = await importCode(server(source), 'if-ms')
  const c = await importCode(compile(source, { file: 'x.tscl', target: 'client' }).code, 'if-mc')
  document.body.innerHTML = s.render(props)
  const island = document.querySelector('cl-island')!
  c.attach(island, props)
  return island
}
const click = (island: Element, selector: string) => (island.querySelector(selector) as HTMLElement).click()

// --- parsing ---

test('parses @if / @else if / @else into branches', () => {
  const f = parse('<p>@if (a) { <b>A</b> } @else if (b) { B } @else { C }</p>', 'x.tscl')
  const p = f.nodes[0] as any
  expect(p.children[0]).toMatchObject({
    type: 'if',
    branches: [
      { cond: 'a', children: [{ type: 'text' }, { type: 'element', tag: 'b' }, { type: 'text' }] },
      { cond: 'b', children: [{ type: 'text', value: ' B ' }] },
      { cond: null, children: [{ type: 'text', value: ' C ' }] },
    ],
  })
})

test('@if works at the top level and conditions may contain parentheses and strings', () => {
  const f = parse(`@input n: number\n@if ((n + 1) > 2 && ")" !== '(') {\n<p>big</p>\n}`, 'x.tscl')
  expect(f.nodes[0]).toMatchObject({ type: 'if', branches: [{ cond: `(n + 1) > 2 && ")" !== '('` }] })
})

test('a } outside any block is just text', () => {
  const f = parse('<p>a } b</p>', 'x.tscl')
  expect((f.nodes[0] as any).children[0]).toMatchObject({ type: 'text', value: 'a } b' })
})

test('block errors are located', () => {
  expect(compileError('<p>a</p>\n@if (x) {\n<b>never closed</b>').message).toMatch(/^x\.tscl:2:1 .*unclosed @if/)
  expect(compileError('@if x { y }').message).toMatch(/^x\.tscl:1:5 .*expected \(/)
  expect(compileError('@if (x) y').message).toMatch(/^x\.tscl:1:9 .*expected \{/)
  expect(compileError('@input a: boolean\n@if (a) { <b>x</b></i> }').message).toMatch(/unexpected closing tag <\/i>/)
})

// --- server rendering outside islands ---

test('renders the matching branch with no markers', async () => {
  const src = '@input n: number\n<p>@if (n > 1) {many} @else if (n === 1) {one} @else {none}</p>'
  expect(await render(src, { n: 5 })).toBe('<p>many</p>')
  expect(await render(src, { n: 1 })).toBe('<p>one</p>')
  expect(await render(src, { n: 0 })).toBe('<p>none</p>')
})

test('no matching branch and no @else renders nothing', async () => {
  expect(await render('@input on: boolean\n<p>a@if (on) {b}c</p>', { on: false })).toBe('<p>ac</p>')
})

test('blocks nest, and holes inside them are escaped', async () => {
  const src = '@input a: boolean\n@input b: boolean\n@input who: string\n@if (a) {<i>@if (b) {{{ who }}} @else {no}</i>}'
  expect(await render(src, { a: true, b: true, who: '<x>' })).toBe('<i>&lt;x&gt;</i>')
  expect(await render(src, { a: true, b: false, who: '' })).toBe('<i>no</i>')
})

// --- inside islands ---

const toggle = `<script>
  let open = state(false)
  let n = state(0)
</script>
<button class="t" (click)="open = !open">toggle</button>
@if (open) {<div class="panel"><b class="inc" (click)="n++">{{ n }}</b></div>} @else {<em>closed</em>}`

test('the server marks the rendered branch', async () => {
  const html = await render(toggle)
  expect(html).toContain('<!--[b0:1--><em>closed</em><!--]-->')
})

test('switching branches inserts the new branch and wires its holes and events', async () => {
  const island = await mount(toggle)
  expect(island.querySelector('em')!.textContent).toBe('closed')
  click(island, '.t')
  expect(island.querySelector('em')).toBeNull()
  click(island, '.inc')
  click(island, '.inc')
  expect(island.querySelector('.inc')!.textContent).toBe('2')
})

test('switching back and forth never double-fires events', async () => {
  const island = await mount(toggle)
  for (let i = 0; i < 3; i++) { click(island, '.t'); click(island, '.t') }
  click(island, '.t')
  click(island, '.inc')
  expect(island.querySelector('.inc')!.textContent).toBe('1')
})

test('the server-rendered branch is wired in place, not re-rendered', async () => {
  const island = await mount(toggle.replace('let open = state(false)', 'let open = state(true)'))
  const panel = island.querySelector('.panel')
  click(island, '.inc')
  expect(island.querySelector('.panel')).toBe(panel)
  expect(island.querySelector('.inc')!.textContent).toBe('1')
})

test('holes outside blocks keep working next to blocks', async () => {
  const island = await mount(`<script>let n = state(0)</script>
<p class="top">{{ n }}</p>@if (n > 1) {<i>big {{ n }}</i>}<b class="inc" (click)="n++">+</b>`)
  click(island, '.inc'); click(island, '.inc'); click(island, '.inc')
  expect(island.querySelector('.top')!.textContent).toBe('3')
  expect(island.querySelector('i')!.textContent).toBe('big 3')
})

test('nested blocks in islands switch independently', async () => {
  const island = await mount(`<script>
  let a = state(true)
  let b = state(false)
</script>
<button class="a" (click)="a = !a">a</button><button class="b" (click)="b = !b">b</button>
@if (a) {<div class="outer">@if (b) {<i>B</i>} @else {<u>not B</u>}</div>}`)
  expect(island.querySelector('u')).not.toBeNull()
  click(island, '.b')
  expect(island.querySelector('i')!.textContent).toBe('B')
  click(island, '.a')
  expect(island.querySelector('.outer')).toBeNull()
  click(island, '.a')
  expect(island.querySelector('i')!.textContent).toBe('B')
})

test('attributes inside a branch stay reactive', async () => {
  const island = await mount(`<script>let n = state(1)</script>
<b class="inc" (click)="n++">+</b>@if (n > 0) {<a [title]="'n=' + n">x</a>}`)
  click(island, '.inc')
  expect(island.querySelector('a')!.getAttribute('title')).toBe('n=2')
})
