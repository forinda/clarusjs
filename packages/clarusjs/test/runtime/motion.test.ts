// @vitest-environment happy-dom
// Motion phase 2: clarusjs/motion's transitionBlock, the browser side of @transition (Vue's enter/leave classes).
// Frames and animations are under the test's control: requestAnimationFrame queues, getAnimations returns what the
// test resolves.
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { blocks, marked } from '../../src/runtime/dom.ts'
import { importCode } from '../helpers.ts'

let frames: (() => void)[] = []
let running: Map<Element, { finished: Promise<void>; finish(): void }[]>
beforeEach(() => {
  frames = []
  running = new Map()
  vi.stubGlobal('requestAnimationFrame', (fn: () => void) => frames.push(fn))
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  ;(Element.prototype as unknown as { getAnimations: () => unknown[] }).getAnimations = function (this: Element) { return running.get(this) ?? [] }
})
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

/** Run the frames queued so far (and the ones they queue), `n` rounds. */
async function frame(n = 2) {
  for (let r = 0; r < n; r++) {
    const now = frames
    frames = []
    for (const f of now) f()
    await Promise.resolve()
  }
  await new Promise((done) => setTimeout(done, 0))
}
/** An animation on `el` the test finishes. */
function animate(el: Element) {
  let finish!: () => void
  const a = { finished: new Promise<void>((done) => (finish = done)), finish: () => finish() }
  running.set(el, [...(running.get(el) ?? []), a])
  return a
}
const settle = () => new Promise((done) => setTimeout(done, 0))
/** With fake timers: `ms` of time, then the promise hops that follow (a race, the classes off, the removal). */
async function after(ms: number) {
  await vi.advanceTimersByTimeAsync(ms)
  for (let i = 0; i < 10; i++) await Promise.resolve()
}
/** With fake timers: let the click's effect run, then two frames. */
async function fakeFrame() {
  await vi.advanceTimersByTimeAsync(0)
  frames.splice(0).forEach((f) => f())
  frames.splice(0).forEach((f) => f())
  await vi.advanceTimersByTimeAsync(0)
}

async function mount(source: string, props = {}) {
  const server = compile(source, { file: 'x.tscl', target: 'server', clientUrl: '/x' }).code
  const client = compile(source, { file: 'x.tscl', target: 'client' }).code
  const s = await importCode(server, 'motion-s')
  const c = await importCode(client, 'motion-c')
  document.body.innerHTML = s.render(props)
  const island = document.querySelector('cl-island')!
  c.attach(island, props)
  return island
}
const toggle = (island: Element) => (island.querySelector('button.toggle') as HTMLElement).click()
const component = (wrapper: string, initial = true) => `<script>
  let open = state(${initial})
  let clicks = state(0)
</script>
<div>
  <button type="button" class="toggle" (click)="open = !open">Toggle</button>
  ${wrapper}
</div>
`
const fade = (opts = '') => component(`@transition ('fade'${opts ? `, ${opts}` : ''}) { @if (open) { <p class="panel">A</p> } }`, false)

test('enter: -enter-from and -enter-active, then -enter-active and -enter-to after a frame, then none once it ends', async () => {
  const island = await mount(fade())
  toggle(island)
  const p = island.querySelector('p.panel')!
  expect([...p.classList]).toEqual(['panel', 'fade-enter-from', 'fade-enter-active'])
  const a = animate(p)
  await frame()
  expect([...p.classList]).toEqual(['panel', 'fade-enter-active', 'fade-enter-to'])
  a.finish()
  await settle()
  expect([...p.classList]).toEqual(['panel'])
})

test('leave: the node stays, made inert and stripped of the island\'s markers, with the leave classes; removed when it ends', async () => {
  const island = await mount(component("@transition ('fade') { @if (open) { <p class=\"panel\" (click)=\"clicks++\">{{ clicks }}</p> } }"))
  const p = island.querySelector('p.panel')!
  toggle(island)
  expect(p.isConnected).toBe(true)
  expect(p.hasAttribute('inert')).toBe(true)
  expect(p.getAttribute('aria-hidden')).toBe('true')
  expect([...p.attributes].map((x) => x.name).filter((n) => n.startsWith('data-cl-'))).toEqual([])
  const walker = document.createTreeWalker(p, NodeFilter.SHOW_COMMENT)
  expect(walker.nextNode()).toBe(null)
  expect([...p.classList]).toEqual(['panel', 'fade-leave-from', 'fade-leave-active'])
  const a = animate(p)
  await frame()
  expect([...p.classList]).toEqual(['panel', 'fade-leave-active', 'fade-leave-to'])
  a.finish()
  await settle()
  expect(p.isConnected).toBe(false)
})

test('A, B, then A again while the first A is still leaving: the island finds the new A, not the leaving copy', async () => {
  const island = await mount(component("@transition ('fade') { @if (open) { <p class=\"a\" (click)=\"clicks++\">A {{ clicks }}</p> } @else { <p class=\"b\">B</p> } }"))
  const first = island.querySelector('p.a')!
  const index = first.getAttribute('data-cl-e')
  animate(first)
  toggle(island) // A leaves, B enters
  await settle()
  toggle(island) // B leaves, a new A enters while the first one is still there
  await settle()
  const copies = [...island.querySelectorAll('p.a')]
  expect(copies).toHaveLength(2)
  const fresh = copies.find((p) => p !== first)!
  expect(blocks(island)).toHaveLength(1)
  expect(marked(island, `[data-cl-e="${index}"]`)).toBe(fresh)
  // Wired once: a click on the new A counts once.
  ;(fresh as HTMLElement).click()
  await settle()
  expect(fresh.textContent).toBe('A 1')
})

test('nothing running: the leaving node goes right after its frame; an animation that never ends goes after 5 s', async () => {
  const island = await mount(component("@transition ('fade') { @if (open) { <p class=\"panel\">A</p> } }"))
  const p = island.querySelector('p.panel')!
  toggle(island)
  await frame()
  await settle()
  expect(p.isConnected).toBe(false)

  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  toggle(island) // back in
  await fakeFrame()
  const q = island.querySelector('p.panel')!
  animate(q) // an animation that never ends
  toggle(island) // out again
  await fakeFrame()
  await after(4999)
  expect(q.isConnected).toBe(true)
  await after(1)
  expect(q.isConnected).toBe(false)
})

test('hooks run in order; onEnter(el, done) waits for done', async () => {
  const calls: string[] = []
  let finish!: () => void
  ;(globalThis as Record<string, unknown>).__hooks = {
    onBeforeEnter: () => calls.push('beforeEnter'),
    onEnter: (_el: Element, done: () => void) => { calls.push('enter'); finish = done },
    onAfterEnter: () => calls.push('afterEnter'),
  }
  const island = await mount(component("@transition ('fade', globalThis.__hooks) { @if (open) { <p class=\"panel\">A</p> } }", false))
  toggle(island)
  const p = island.querySelector('p.panel')!
  expect(calls).toEqual(['beforeEnter'])
  await frame()
  expect(calls).toEqual(['beforeEnter', 'enter'])
  await settle()
  expect(p.classList.contains('fade-enter-active')).toBe(true) // waiting for done()
  finish()
  await settle()
  expect(calls).toEqual(['beforeEnter', 'enter', 'afterEnter'])
  expect(p.classList.contains('fade-enter-active')).toBe(false)
})

test('duration waits that long instead of the animations, and not at all under reduced motion; css: false adds no classes', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  const island = await mount(fade('{ duration: 300 }'))
  toggle(island)
  await vi.advanceTimersByTimeAsync(0)
  const p = island.querySelector('p.panel')!
  await fakeFrame()
  await after(299)
  expect(p.classList.contains('fade-enter-active')).toBe(true)
  await after(1)
  expect(p.classList.contains('fade-enter-active')).toBe(false)

  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  toggle(island)
  await fakeFrame()
  await after(0)
  expect(p.isConnected).toBe(false) // no 300 ms wait under reduced motion
  vi.useRealTimers()

  const bare = await mount(fade('{ css: false }'))
  toggle(bare)
  expect([...bare.querySelector('p.panel')!.classList]).toEqual(['panel'])
})

test("a stateful child at the branch's top: its element children animate (a <cl-island> is display: contents)", async () => {
  const island = await mount(component("@transition ('fade') { @if (open) { <cl-island c=\"child\"><section class=\"dialog\">D</section></cl-island> } }", false))
  toggle(island)
  const section = island.querySelector('section.dialog')!
  expect(section.classList.contains('fade-enter-from')).toBe(true)
  expect(island.querySelector('cl-island cl-island, cl-island[c="child"]')!.classList.length).toBe(0)
})

test("without a name the classes are cl-'s", async () => {
  const island = await mount(component('@transition { @if (open) { <p class="panel">A</p> } }', false))
  toggle(island)
  expect(island.querySelector('p.panel')!.classList.contains('cl-enter-from')).toBe(true)
})
