// @vitest-environment happy-dom
// #442: component events. A child declares what it sends (@event change: string) and sends it from its script
// (emit('change', value, { reason, event })); a parent island handles it like an element event: <x (change)="…">, with
// $event the value and $info { reason, event, cancel() }. cancel() vetoes: emit() returns false.
import { afterEach, expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { ClarusError } from '../../src/compiler/errors.ts'
import { parse } from '../../src/compiler/parse.ts'
import { attachAll } from '../../src/runtime/loader.ts'
import { importCode } from '../helpers.ts'

afterEach(() => { document.body.innerHTML = '' })
const compileError = (source: string, target: 'client' | 'server' = 'client'): ClarusError => {
  try { compile(source, { file: 'x.tscl', target }) } catch (e) { return e as ClarusError }
  throw new Error('expected compile to throw')
}

test('parsing: @event declares an event and the type of its value', () => {
  const parsed = parse('@event change: string\n@event open: { open: boolean; at: number }\n@event close\n<p></p>\n', 'x.tscl')
  expect(parsed.events.map((e) => [e.name, e.type])).toEqual([['change', 'string'], ['open', '{ open: boolean; at: number }'], ['close', 'void']])
})

const stepper = `@input value: number = 0
@event change: number
@event limit: 'min' | 'max'
<script>
  let n = state(value)
  function step(by, event) {
    const next = n + by
    if (next < 0 || next > 3) return emit('limit', next < 0 ? 'min' : 'max', { reason: 'bounds', event })
    if (emit('change', next, { reason: by > 0 ? 'increment' : 'decrement', event })) n = next
  }
</script>
<div class="stepper"><button class="down" (click)="step(-1, $event)">-</button><span class="n">{{ n }}</span><button class="up" (click)="step(1, $event)">+</button></div>
`
const page = `@import stepper from './stepper.tscl'
<script>
  let log = state([])
  let locked = state(false)
</script>
<section>
  <stepper [value]="1" (change)="log = [...log, $event + ':' + $info.reason + ':' + $info.event.type]; if (locked) $info.cancel()" (limit)="log = [...log, 'limit ' + $event]" />
  <label><input class="lock" type="checkbox" (change)="locked = $event.target.checked"> lock</label>
  <p class="log">{{ log.join(', ') }}</p>
</section>
`

async function mount() {
  const childServer = compile(stepper, { file: 'stepper.tscl', target: 'server', clientUrl: '/stepper.js' }).code
  const deps = { './stepper.tscl': childServer, './stepper.tscl?render': childServer }
  const s = await importCode(compile(page, { file: 'page.tscl', target: 'server', clientUrl: '/page.js' }).code, 'ev-s', deps)
  const pc = await importCode(compile(page, { file: 'page.tscl', target: 'client' }).code, 'ev-pc', deps)
  const cc = await importCode(compile(stepper, { file: 'stepper.tscl', target: 'client' }).code, 'ev-cc')
  document.body.innerHTML = s.render({})
  await attachAll(document, async (src) => (src === '/page.js' ? pc : cc))
}
const click = (sel: string) => (document.querySelector(sel) as HTMLElement).click()
const log = () => document.querySelector('.log')!.textContent

test('the parent hears the child: $event is the value, $info the reason and the DOM event', async () => {
  await mount()
  click('.up')
  expect(log()).toBe('2:increment:click')
  expect(document.querySelector('.n')!.textContent).toBe('2')
  click('.down')
  expect(log()).toBe('2:increment:click, 1:decrement:click')
})

test('$info.cancel() vetoes the change: emit() returns false and the child keeps its value', async () => {
  await mount()
  click('.lock')
  click('.up')
  expect(log()).toBe('2:increment:click')
  expect(document.querySelector('.n')!.textContent).toBe('1') // vetoed
})

test('several events per component; a native event from inside the child is not a component event', async () => {
  await mount()
  click('.down')
  click('.down')
  expect(log()).toBe('0:decrement:click, limit min')
  // The lock checkbox's native change bubbles past nothing of the child's, and the child's inner clicks aren't heard.
  expect(log()).not.toContain('undefined')
})

test('errors at their place: @event without a script, an undeclared emit is fine at compile (check types it), a handler in a static parent', () => {
  expect(compileError('@event change: string\n<p></p>\n').message).toMatch(/^x\.tscl:1:1 .*@event needs a <script> that sends it with emit/)
  expect(compileError("@import s from './s.tscl'\n<s (change)=\"x = 1\" />\n").message).toMatch(/^x\.tscl:2:4 .*event bindings need a <script>/)
  expect(compileError('@event 1bad\n<script>\n</script>\n').message).toMatch(/^x\.tscl:1:1 .*@event/)
})
