// Runs inside a preview frame (bundled into its document by bundle.ts). The page makes a fresh frame for each run, so
// timers and listeners a run starts end with it. The page posts the run's code, already prepared (prepare.ts: runtime
// imports pointed at the copies below, loops guarded); this imports it from blob URLs, renders and attaches.
import * as runtime from 'clarusjs/runtime'
import * as server from 'clarusjs/runtime/server'
import * as forms from 'clarusjs/forms'
import * as fetching from 'clarusjs/fetch'

type Message = { id: number; server: string; client: string | null; css?: string }

;(globalThis as { __cl_repl?: object }).__cl_repl = { 'clarusjs/runtime': runtime, 'clarusjs/runtime/server': server, 'clarusjs/forms': forms, 'clarusjs/fetch': fetching }

let current = 0 // the run's id, for errors thrown later (an event handler, a timer)

// A form in a preview has nowhere to go: its default action (navigating this frame away, and the preview with it) is
// stopped here, on the window, after the component's own handlers have run.
addEventListener('submit', (event) => event.preventDefault())

const report = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  const p = document.createElement('p')
  p.className = 'cl-repl-error'
  p.textContent = message
  document.getElementById('out')!.append(p)
  parent.postMessage({ id: current, error: message }, '*')
}

async function load(code: string): Promise<Record<string, any>> {
  const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
  try {
    return await import(/* @vite-ignore */ url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Errors thrown later (an event handler, a timer) reach window 'error' only as "Script error." here (the code runs
// from blob URLs in an opaque origin), so listeners and timers are wrapped to catch and report the real error.
const guard = <F>(fn: F): F => (typeof fn === 'function' ? (function (this: unknown, ...args: unknown[]) {
  try { return fn.apply(this, args) } catch (err) { report(err) }
} as F) : fn)
const wrapped = new WeakMap<object, EventListenerOrEventListenerObject>()
const wrap = (fn: EventListenerOrEventListenerObject | null) => {
  if (!fn) return fn
  let w = wrapped.get(fn)
  if (!w) wrapped.set(fn, (w = typeof fn === 'function' ? guard(fn) : { handleEvent: guard(fn.handleEvent.bind(fn)) }))
  return w
}
const add = EventTarget.prototype.addEventListener
const remove = EventTarget.prototype.removeEventListener
EventTarget.prototype.addEventListener = function (type: string, fn: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) { add.call(this, type, wrap(fn), options) }
EventTarget.prototype.removeEventListener = function (type: string, fn: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) { remove.call(this, type, (fn && wrapped.get(fn)) ?? fn, options) }
const later = <T extends (fn: TimerHandler, ms?: number, ...args: unknown[]) => number>(native: T) => ((fn: TimerHandler, ms?: number, ...args: unknown[]) => native(guard(fn), ms, ...args)) as T
globalThis.setTimeout = later(setTimeout.bind(globalThis)) as typeof setTimeout
globalThis.setInterval = later(setInterval.bind(globalThis)) as typeof setInterval
addEventListener('error', (event) => report(event.error ?? event.message))
addEventListener('unhandledrejection', (event) => report(event.reason))

addEventListener('message', async (event: MessageEvent<Message>) => {
  // Only the page that made this frame: never a sibling frame or a window that got hold of this one.
  if (event.source !== parent) return
  const { id, server: serverCode, client, css } = event.data ?? ({} as Message)
  if (typeof id !== 'number' || typeof serverCode !== 'string' || current) return // one run per frame
  current = id
  const out = document.getElementById('out')!
  // The component's <style> (scoped by the compiler, as in a build), as a text node: never parsed as HTML.
  if (typeof css === 'string' && css) document.head.append(Object.assign(document.createElement('style'), { textContent: css }))
  try {
    const html = await (await load(serverCode)).render({})
    out.innerHTML = html
    if (client) {
      const island = out.querySelector('cl-island')
      if (island) {
        const props = runtime.parseIslandData(island.getAttribute('p') ?? '{}') as Record<string, unknown>
        const s = island.getAttribute('s')
        ;(await load(client)).attach(island, props, s === null ? undefined : runtime.parseIslandData(s))
      }
    }
    parent.postMessage({ id, ok: true, html }, '*') // the server's HTML, for the playground's HTML tab
  } catch (err) {
    out.replaceChildren()
    report(err)
  }
})
