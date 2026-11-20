// Island loader: finds <cl-island> elements, loads each one's chunk, calls attach(). Browser only, ~20 lines.

import { parse } from './serialize.ts'

type IslandModule = { attach(root: Element, props: Record<string, unknown>, state?: Record<string, unknown>): void }

// Islands whose chunk is being fetched. `data-cl-ready` is set only after attach() succeeds.
const loading = new WeakSet<Element>()

let lastLoad: (src: string) => Promise<IslandModule> = (src) => import(/* @vite-ignore */ src)

export async function attachAll(
  root: ParentNode = document,
  load: (src: string) => Promise<IslandModule> = lastLoad,
): Promise<void> {
  lastLoad = load
  const islands = [...root.querySelectorAll('cl-island:not([data-cl-ready]):not([data-cl-error])')].filter((el) => !loading.has(el))
  const pending = islands.map(async (el) => {
    loading.add(el)
    let mod: IslandModule
    let props: Record<string, unknown>
    let state: Record<string, unknown> | undefined
    try {
      mod = await load(el.getAttribute('src')!)
      props = parse(el.getAttribute('p') ?? '{}') as Record<string, unknown>
      const s = el.getAttribute('s')
      state = s === null ? undefined : (parse(s) as Record<string, unknown>)
    } catch (err) {
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
  })
  await Promise.all(pending)
}

// Islands inserted later (an @if branch, a @for row, a re-rendered child) are attached through this hook.
;(globalThis as { __clAttach?: (root: ParentNode) => void }).__clAttach = (root) => void attachAll(root)

if (typeof document !== 'undefined') attachAll()
