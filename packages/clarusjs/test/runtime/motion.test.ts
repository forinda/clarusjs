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

// --- modes, appear, interruption, child islands ---

const ab = (opts: string) => component(`@transition ('fade', ${opts}) { @if (open) { <p class="a" (click)="clicks++">A {{ clicks }}</p> } @else { <p class="b">B</p> } }`)

test("out-in: the new branch comes once the old one is gone; changes during the leave insert only the newest", async () => {
  const island = await mount(ab("{ mode: 'out-in' }"))
  const a = island.querySelector('p.a')!
  const leaving = animate(a)
  toggle(island) // A leaves; B waits
  await frame()
  expect(island.querySelector('p.b')).toBe(null)
  toggle(island) // back to A, then to B again, during the leave
  toggle(island)
  leaving.finish()
  await settle()
  await frame()
  expect(a.isConnected).toBe(false)
  expect(island.querySelectorAll('p.b')).toHaveLength(1)
  expect(island.querySelectorAll('p.a')).toHaveLength(0)
})

test('in-out: the new branch enters first, while the old one waits, unwired and inert; then the old one leaves', async () => {
  const island = await mount(ab("{ mode: 'in-out' }"))
  const a = island.querySelector('p.a')!
  toggle(island)
  const b = island.querySelector('p.b')!
  const entering = animate(b)
  await frame()
  expect(a.isConnected).toBe(true)
  expect(a.hasAttribute('inert')).toBe(true)
  expect(a.classList.contains('fade-leave-from')).toBe(false) // not leaving yet
  ;(a as HTMLElement).click()
  expect(a.textContent).toBe('A 0') // unwired
  entering.finish()
  await settle()
  expect(a.classList.contains('fade-leave-from')).toBe(true)
  await frame()
  await settle()
  expect(a.isConnected).toBe(false)
})

test('appear: the branch the server rendered enters on attach; without it, it does not', async () => {
  const shown = await mount(component("@transition ('fade', { appear: true }) { @if (open) { <p class=\"panel\">A</p> } }"))
  expect(shown.querySelector('p.panel')!.classList.contains('fade-enter-from')).toBe(true)
  const plain = await mount(component("@transition ('fade') { @if (open) { <p class=\"panel\">A</p> } }"))
  expect([...plain.querySelector('p.panel')!.classList]).toEqual(['panel'])
})

test('a change while a branch is still entering cancels its enter (onEnterCancelled) and it leaves from where it is', async () => {
  const cancelled: Element[] = []
  ;(globalThis as Record<string, unknown>).__cancel = { onEnterCancelled: (el: Element) => cancelled.push(el) }
  const island = await mount(component("@transition ('fade', globalThis.__cancel) { @if (open) { <p class=\"panel\">A</p> } }", false))
  toggle(island)
  const p = island.querySelector('p.panel')!
  animate(p)
  await frame()
  expect(p.classList.contains('fade-enter-active')).toBe(true)
  toggle(island) // out, mid-enter
  expect(cancelled).toEqual([p])
  expect([...p.classList]).toEqual(['panel', 'fade-leave-from', 'fade-leave-active'])
})

test('a leaving child island that never attached is marked so the next insert does not attach it; the loader is asked to clean up after', async () => {
  const asked: ParentNode[] = []
  ;(globalThis as Record<string, unknown>).__clAttach = (root: ParentNode) => asked.push(root)
  try {
    const island = await mount(component("@transition ('fade') { @if (open) { <div class=\"box\"><cl-island c=\"later\" a=\"visible\"><p>Later</p></cl-island></div> } @else { <p class=\"b\">B</p> } }"))
    const child = island.querySelector('cl-island[c="later"]')!
    const box = island.querySelector('div.box')!
    expect(child.hasAttribute('data-cl-ready')).toBe(false)
    toggle(island)
    expect(child.hasAttribute('data-cl-ready')).toBe(true)
    const beforeRemoval = asked.length // B's insert asks too
    await frame()
    await settle()
    expect(box.isConnected).toBe(false)
    expect(asked.length).toBe(beforeRemoval + 1) // and once more after the leaving nodes go
  } finally {
    delete (globalThis as Record<string, unknown>).__clAttach
  }
})

// --- review fixes ---

test('first run: state that differs from what the server rendered (HMR, a restored state) shows the right branch, wired', async () => {
  const source = component("@transition ('fade') { @if (open) { <p class=\"a\" (click)=\"clicks++\">A {{ clicks }}</p> } @else { <p class=\"b\">B</p> } }", false)
  const server = compile(source, { file: 'x.tscl', target: 'server', clientUrl: '/x' }).code
  const client = compile(source, { file: 'x.tscl', target: 'client' }).code
  const s = await importCode(server, 'motion-s')
  const c = await importCode(client, 'motion-c')
  document.body.innerHTML = s.render({}) // the server rendered the closed branch
  const island = document.querySelector('cl-island')!
  c.attach(island, {}, { open: true }) // the browser's state is open
  const a = island.querySelector('p.a')
  expect(a).not.toBe(null)
  ;(a as HTMLElement).click()
  await settle()
  expect(a!.textContent).toBe('A 1') // wired
  toggle(island) // and the next change is seen
  expect(island.querySelector('p.b')).not.toBe(null)
})

test("a running child island inside a leaving branch keeps its own markers (only the outer island's go)", async () => {
  const island = await mount(component("@transition ('fade') { @if (open) { <div class=\"box\"><cl-island c=\"inner\" data-cl-ready=\"\"><!--[b0:0--><p>inner</p><!--]--></cl-island></div> } }"))
  const inner = island.querySelector('cl-island[c="inner"]')!
  toggle(island)
  const walker = document.createTreeWalker(inner, NodeFilter.SHOW_COMMENT)
  const kept: string[] = []
  for (let n = walker.nextNode(); n; n = walker.nextNode()) kept.push((n as Comment).data)
  expect(kept).toEqual(['[b0:0', ']'])
})

// --- PR review (#641) ---

const comments = (root: Node) => {
  const out: string[] = []
  const w = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT)
  for (let n = w.nextNode(); n; n = w.nextNode()) out.push((n as Comment).data)
  return out
}

test("a child island at the branch's top keeps its own markers while it leaves", async () => {
  const island = await mount(component("@transition ('fade') { @if (open) { <cl-island c=\"inner\" data-cl-ready=\"\"><!--[b0:0--><p>inner</p><!--]--></cl-island> } }"))
  const inner = island.querySelector('cl-island[c="inner"]')!
  toggle(island)
  expect(comments(inner)).toEqual(['[b0:0', ']'])
})

test("content the outer island passed into a child's slot is the outer's: its markers go; the slot's own stay", async () => {
  const island = await mount(component("@transition ('fade') { @if (open) { <cl-island c=\"inner\" data-cl-ready=\"\"><div><!--[s--><span data-cl-e=\"9\"><!--[4-->x<!--]--></span><!--]s--></div></cl-island> } }"))
  const inner = island.querySelector('cl-island[c="inner"]')!
  const span = inner.querySelector('span')!
  toggle(island)
  expect(comments(inner)).toEqual(['[s', ']s'])
  expect(span.hasAttribute('data-cl-e')).toBe(false)
})

test('a leave hook that throws still removes the element, and out-in still inserts the next branch', async () => {
  ;(globalThis as Record<string, unknown>).__throwing = { mode: 'out-in', onLeave: () => { throw new Error('hook') } }
  const reported = vi.spyOn(console, 'error').mockImplementation(() => {})
  const island = await mount(component("@transition ('fade', globalThis.__throwing) { @if (open) { <p class=\"a\">A</p> } @else { <p class=\"b\">B</p> } }"))
  const a = island.querySelector('p.a')!
  toggle(island)
  await frame()
  await settle()
  await settle()
  expect(a.isConnected).toBe(false)
  expect(island.querySelector('p.b')).not.toBe(null)
  expect(reported).toHaveBeenCalledWith('[clarusjs] a @transition hook failed', expect.any(Error))
  reported.mockRestore()
})

// --- @for (motion phase 3) ---

const list = (opts = '') => `<script>
  let xs = state([1, 2, 3])
</script>
<div>
  <button type="button" class="add" (click)="xs = [...xs, Math.max(0, ...xs) + 1]">Add</button>
  <button type="button" class="drop" (click)="xs = xs.slice(1)">Drop</button>
  <button type="button" class="rev" (click)="xs = [...xs].reverse()">Reverse</button>
  <ul>
    @transition ('list'${opts ? `, ${opts}` : ''}) {
      @for (x of xs; track x) {
        <li [data-x]="x">{{ x }}</li>
      }
    }
  </ul>
</div>
`
const press = (island: Element, cls: string) => (island.querySelector(`button.${cls}`) as HTMLElement).click()
const rowsOf = (island: Element) => [...island.querySelectorAll('li')].map((li) => li.getAttribute('data-x') + (li.hasAttribute('inert') ? '(leaving)' : ''))
// Layout for FLIP: each row 20px tall, placed by its position among its siblings.
function stubLayout() {
  const proto = Element.prototype as unknown as { getBoundingClientRect: () => DOMRect }
  const real = proto.getBoundingClientRect
  proto.getBoundingClientRect = function (this: Element) {
    const i = this.parentElement ? [...this.parentElement.children].indexOf(this) : 0
    return { left: 0, top: i * 20, right: 100, bottom: i * 20 + 20, width: 100, height: 20, x: 0, y: i * 20, toJSON() {} } as DOMRect
  }
  return () => { proto.getBoundingClientRect = real }
}

test('@for: an added row enters with the list classes; a removed one leaves, inert, then goes', async () => {
  const island = await mount(list())
  press(island, 'add')
  const added = island.querySelector('li[data-x="4"]')!
  expect([...added.classList]).toEqual(['list-enter-from', 'list-enter-active'])
  await frame()
  await settle()
  expect([...added.classList]).toEqual([])
  const first = island.querySelector('li[data-x="1"]')!
  const leaving = animate(first)
  press(island, 'drop')
  expect(rowsOf(island)).toEqual(['1(leaving)', '2', '3', '4'])
  expect(first.classList.contains('list-leave-active')).toBe(true)
  leaving.finish()
  await frame()
  await settle()
  expect(rowsOf(island)).toEqual(['2', '3', '4'])
  // The list still works after: no duplicated rows, no stale markers.
  press(island, 'add')
  expect(rowsOf(island)).toEqual(['2', '3', '4', '5'])
})

test('@for: rows that move slide into place (-move while their animations run)', async () => {
  const restore = stubLayout()
  try {
    const island = await mount(list())
    press(island, 'rev')
    const moved = [...island.querySelectorAll('li')]
    expect(rowsOf(island)).toEqual(['3', '2', '1'])
    // 3 and 1 moved (2 stayed in the middle): they get the move class, their inverse transform already cleared.
    expect(moved.filter((li) => li.classList.contains('list-move')).map((li) => li.getAttribute('data-x'))).toEqual(['3', '1'])
    expect(moved.map((li) => (li as HTMLElement).style.transform)).toEqual(['', '', ''])
    await frame()
    await settle()
    expect(moved.some((li) => li.classList.contains('list-move'))).toBe(false)
  } finally {
    restore()
  }
})

test('@for: no sliding under reduced motion; appear makes the server rows enter on attach', async () => {
  const restore = stubLayout()
  try {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const island = await mount(list())
    press(island, 'rev')
    expect([...island.querySelectorAll('li.list-move')]).toHaveLength(0)
  } finally {
    restore()
  }
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  const shown = await mount(list('{ appear: true }'))
  expect([...shown.querySelectorAll('li')].every((li) => li.classList.contains('list-enter-from'))).toBe(true)
  const plain = await mount(list())
  expect([...plain.querySelectorAll('li')].some((li) => li.classList.length > 0)).toBe(false)
})

test('in-out: at the change, the old branch loses its text and stops entering, though it leaves only later', async () => {
  const island = await mount(component("@transition ('fade', { mode: 'in-out' }) { @if (open) { <p class=\"a\">A</p> } @else { <p class=\"b\">B</p> } }"))
  toggle(island) // B enters, A waits
  const b = island.querySelector('p.b')!
  animate(b)
  expect(b.classList.contains('fade-enter-active')).toBe(true)
  toggle(island) // back to A while B is still entering: B is the old branch now
  expect(b.classList.contains('fade-enter-active')).toBe(false) // its enter cancelled at once, not when its leave starts
})

test('a finished transition leaves no timer behind, and the loader is asked once per change', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  const asked: ParentNode[] = []
  ;(globalThis as Record<string, unknown>).__clAttach = (root: ParentNode) => asked.push(root)
  try {
    const island = await mount(component("@transition ('fade') { @if (open) { <p class=\"a\">A</p><p class=\"a2\">A2</p> } @else { <p class=\"b\">B</p> } }"))
    const before = asked.length
    toggle(island)
    await fakeFrame()
    await after(0)
    expect(island.querySelector('p.a')).toBe(null)
    expect(vi.getTimerCount()).toBe(0)
    expect(asked.length - before).toBe(2) // B's insert, then one clean-up for both leaving elements
  } finally {
    delete (globalThis as Record<string, unknown>).__clAttach
  }
})
