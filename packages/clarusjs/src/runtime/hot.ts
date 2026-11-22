// Island HMR (#53), dev only: a compiled island module that changed calls swap() with its new URL. The page is
// rendered again by the dev server, each of that component's islands gets its new HTML and the new module, and its
// state (and that of islands nested in it) carries over by name. Anything that doesn't line up is a full reload.
// Never part of a build: only dev client modules import it (the plugin's `hot` compile option).

import { parse, stringify } from './serialize.ts'

type Hot = Element & { __cl_hot?: () => Record<string, unknown> }

/** Swap the islands of the component at `url` (the new module's URL, `…?import&t=…`) in place. */
export async function swap(url: string): Promise<void> {
  const next = new URL(url, location.href)
  const pathOf = (el: Element) => new URL(el.getAttribute('src') ?? '', location.href).pathname
  // The outermost islands of this component: one nested in another is swapped with it.
  const mine = (root: ParentNode) => [...root.querySelectorAll('cl-island')].filter((el) => pathOf(el) === next.pathname && !el.parentElement?.closest(`cl-island[src="${CSS.escape(el.getAttribute('src')!)}"]`))
  const old = mine(document)
  if (!old.length) return
  try {
    const res = await fetch(location.href, { headers: { accept: 'text/html' } })
    if (!res.ok) throw new Error(`${res.status}`)
    const fresh = mine(new DOMParser().parseFromString(await res.text(), 'text/html'))
    if (fresh.length !== old.length) throw new Error('the islands moved')
    old.forEach((el, i) => {
      // The island's own attributes (props a parent island may have changed, attach mode), the new markup and module.
      const swapped = el.cloneNode(false) as Element
      swapped.removeAttribute('data-cl-ready')
      swapped.removeAttribute('data-cl-error')
      swapped.setAttribute('src', next.pathname + next.search)
      swapped.replaceChildren(...[...fresh[i]!.childNodes].map((n) => document.importNode(n, true)))
      swapped.setAttribute('s', fresh[i]!.getAttribute('s') ?? '{}')
      // State: what the server rendered with, then what the running version had, island by island in page order.
      const before = [el, ...el.querySelectorAll('cl-island')] as Hot[]
      const after = [swapped, ...swapped.querySelectorAll('cl-island')]
      if (before.length === after.length) {
        before.forEach((b, j) => {
          const state = pathOf(b) === pathOf(after[j]!) ? b.__cl_hot?.() : undefined
          if (state) after[j]!.setAttribute('s', stringify({ ...(parse(after[j]!.getAttribute('s') ?? '{}') as object), ...state }))
        })
      }
      el.replaceWith(swapped)
    })
    // The loader disposes the replaced islands (no longer in the page) and attaches the new ones.
    await (globalThis as { __clAttach?: (root: ParentNode) => Promise<void> }).__clAttach?.(document)
    if (document.querySelector('cl-island[data-cl-error]')) throw new Error('the new version failed to attach')
  } catch (err) {
    console.warn('[clarusjs] reloading: the changed island could not be swapped in place', err)
    location.reload()
  }
}
