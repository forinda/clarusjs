// Island loader: finds <cl-island> elements, loads each one's chunk when its attach mode says so, calls attach(),
// and replays what the visitor did before that. Browser only.

import { parse } from './serialize.ts'

type IslandModule = { attach(root: Element, props: Record<string, unknown>, state?: Record<string, unknown>): void }
type Load = (src: string) => Promise<IslandModule>

// Islands scheduled or loading. `data-cl-ready` is set only after attach() succeeds.
const loading = new WeakSet<Element>()

let lastLoad: Load = (src) => import(/* @vite-ignore */ src)

// Events recorded until an island attaches, then replayed. Clicks and submits are held back (no navigation, no
// form post) so the island can handle them once it is ready.
const REPLAY = ['click', 'submit', 'input', 'change', 'keydown'] as const
const HOLD = new Set(['click', 'submit'])
// What counts as using an island, for attach="interaction".
const INTERACTION = ['pointerdown', 'keydown', 'focusin', 'input', 'click', 'submit']

type Recorded = { type: string; target: Element; key?: string }

/** Record events aimed at this island (not at an island nested in it) until stop() is called. */
function record(el: Element): { events: Recorded[]; stop(): void } {
  const events: Recorded[] = []
  const listener = (e: Event) => {
    const target = e.target as Element | null
    if (!target || target.closest?.('cl-island') !== el) return
    if (HOLD.has(e.type)) e.preventDefault()
    events.push({ type: e.type, target, key: (e as KeyboardEvent).key })
  }
  for (const type of REPLAY) el.addEventListener(type, listener, true)
  return { events, stop: () => { for (const type of REPLAY) el.removeEventListener(type, listener, true) } }
}

/** Do again what the visitor did before the island attached, now that its handlers are listening. */
function replay(events: Recorded[]): void {
  for (const { type, target, key } of events) {
    if (!target.isConnected) continue
    if (type === 'click') (target as HTMLElement).click?.()
    else if (type === 'submit') {
      const form = target as HTMLFormElement
      if (typeof form.requestSubmit === 'function') form.requestSubmit()
      else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    } else if (type === 'keydown') target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    else target.dispatchEvent(new Event(type, { bubbles: true }))
  }
}

/** Run `go` when the island's attach mode (`a` attribute) says: now, when idle, when visible, or on first use. */
function schedule(el: Element, go: () => void): void {
  const mode = el.getAttribute('a') ?? 'load'
  if (mode === 'idle') {
    const idle = (globalThis as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback
    if (idle) idle(go)
    else setTimeout(go, 200)
  } else if (mode === 'visible' && typeof IntersectionObserver === 'function') {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { io.disconnect(); go() }
    })
    io.observe(el)
  } else if (mode === 'interaction') {
    const start = () => { for (const type of INTERACTION) el.removeEventListener(type, start, true); go() }
    for (const type of INTERACTION) el.addEventListener(type, start, true)
  } else {
    go()
  }
}

async function attachOne(el: Element, load: Load, recorded: ReturnType<typeof record>): Promise<void> {
  let mod: IslandModule
  let props: Record<string, unknown>
  let state: Record<string, unknown> | undefined
  try {
    mod = await load(el.getAttribute('src')!)
    props = parse(el.getAttribute('p') ?? '{}') as Record<string, unknown>
    const s = el.getAttribute('s')
    state = s === null ? undefined : (parse(s) as Record<string, unknown>)
  } catch (err) {
    recorded.stop()
    loading.delete(el) // network or parse failure: the next attachAll() retries
    console.error(`[clarusjs] island "${el.getAttribute('c')}" failed to load`, err)
    return
  }
  try {
    mod.attach(el, props, state)
    el.setAttribute('data-cl-ready', '')
  } catch (err) {
    el.setAttribute('data-cl-error', '') // attach may have wired some listeners already: never retry
    console.error(`[clarusjs] island "${el.getAttribute('c')}" failed to attach`, err)
  } finally {
    loading.delete(el)
  }
  recorded.stop()
  if (el.hasAttribute('data-cl-ready')) replay(recorded.events)
}

/**
 * Attach every island under `root` that isn't attached yet. Resolves once the islands that attach right away
 * (the default, attach="load") are done; idle, visible and interaction islands attach later on their own.
 */
export async function attachAll(root: ParentNode = document, load: Load = lastLoad): Promise<void> {
  lastLoad = load
  const islands = [...root.querySelectorAll('cl-island:not([data-cl-ready]):not([data-cl-error])')].filter((el) => !loading.has(el))
  const now: Promise<void>[] = []
  for (const el of islands) {
    loading.add(el)
    const recorded = record(el)
    if ((el.getAttribute('a') ?? 'load') === 'load') now.push(attachOne(el, load, recorded))
    else schedule(el, () => void attachOne(el, load, recorded))
  }
  await Promise.all(now)
}

// Islands inserted later (an @if branch, a @for row, a re-rendered child) are attached through this hook.
;(globalThis as { __clAttach?: (root: ParentNode) => void }).__clAttach = (root) => void attachAll(root)

if (typeof document !== 'undefined') attachAll()
