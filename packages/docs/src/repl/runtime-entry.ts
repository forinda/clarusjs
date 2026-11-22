// Runs inside the preview frame (bundled into its document by bundle.ts). Receives compiled code from the playground
// page, imports it from blob URLs with the runtime imports pointed at the copies below, renders and attaches.
import * as runtime from 'clarusjs/runtime'
import * as server from 'clarusjs/runtime/server'
import { rewriteImports } from './rewrite.ts'

type Message = { id: number; server: string; client: string | null }

;(globalThis as { __cl_repl?: object }).__cl_repl = { 'clarusjs/runtime': runtime, 'clarusjs/runtime/server': server }

async function load(code: string): Promise<Record<string, any>> {
  const url = URL.createObjectURL(new Blob([rewriteImports(code)], { type: 'text/javascript' }))
  try {
    return await import(/* @vite-ignore */ url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

// The newest message seen: an older one still loading when a newer arrives is dropped (typing outpaces importing).
let latest = 0

addEventListener('message', async (event: MessageEvent<Message>) => {
  const { id, server: serverCode, client } = event.data ?? ({} as Message)
  if (typeof id !== 'number' || typeof serverCode !== 'string') return
  latest = Math.max(latest, id)
  const stale = () => id !== latest
  // A fresh #out each time: the previous preview's DOM, and the listeners on it, go with the old element.
  const out = document.createElement('div')
  out.id = 'out'
  try {
    const rendered = await (await load(serverCode)).render({})
    if (stale()) return
    out.innerHTML = rendered
    document.getElementById('out')!.replaceWith(out)
    if (client) {
      const island = out.querySelector('cl-island')
      if (island) {
        const props = runtime.parseIslandData(island.getAttribute('p') ?? '{}') as Record<string, unknown>
        const s = island.getAttribute('s')
        const mod = await load(client)
        if (stale()) return
        mod.attach(island, props, s === null ? undefined : runtime.parseIslandData(s))
      }
    }
    parent.postMessage({ id, ok: true }, '*')
  } catch (err) {
    if (stale()) return
    const message = err instanceof Error ? err.message : String(err)
    const p = document.createElement('p')
    p.className = 'cl-repl-error'
    p.textContent = message
    out.replaceChildren(p)
    document.getElementById('out')!.replaceWith(out)
    parent.postMessage({ id, error: message }, '*')
  }
})
