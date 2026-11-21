// Fragment navigation: moving between static and server pages swaps their region (data-cl-swap, or the body)
// instead of reloading. Browser only. Each page's fragment is <path>/index.frag.html; elements marked
// data-cl-persist="key" are kept across swaps, and the island loader attaches whatever islands arrive.
import './loader.ts'
import { takeOver } from './navigate.ts'

/** '/guide/lists/' → '/guide/lists/index.frag.html', keeping the query. */
export function fragmentUrl(url: URL): string {
  return `${url.pathname.replace(/\/+$/, '')}/index.frag.html${url.search}`
}

const region = (doc: Document) => doc.querySelector('[data-cl-swap]') ?? doc.body

/** Fetch the page's fragment and swap it in. Throws when there is none (the caller then loads the page normally). */
export async function swap(
  url: URL,
  get: (url: string) => Promise<Response> = fetch,
  // False once a newer navigation has started: then this one must not touch the document.
  isCurrent: () => boolean = () => true,
): Promise<void> {
  const src = fragmentUrl(url)
  const res = await get(src)
  if (!res.ok) throw new Error(`${res.status}: ${src}`)
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html')
  if (!isCurrent()) return
  const next = region(doc)
  const old = region(document)
  // A body can only replace a body, and a marked region a marked region: otherwise load the page normally.
  if ((next === doc.body) !== (old === document.body)) throw new Error('different swap regions')
  for (const title of next.querySelectorAll('title')) title.remove() // some parsers leave the leading <title> in the body
  // The page's stylesheets: add the ones not loaded yet to <head>, and wait for them, so nothing shows unstyled.
  const loading: Promise<unknown>[] = []
  for (const link of doc.querySelectorAll('link[rel="stylesheet"]')) {
    link.remove()
    if (document.head.querySelector(`link[rel="stylesheet"][href="${CSS.escape(link.getAttribute('href')!)}"]`)) continue
    const added = document.createElement('link')
    added.rel = 'stylesheet'
    added.href = link.getAttribute('href')!
    loading.push(new Promise((done) => { added.onload = added.onerror = done }))
    document.head.append(added)
  }
  await Promise.all(loading)
  if (!isCurrent()) return
  // Persisted elements move into the new page as they are, with their state and attached islands.
  for (const old of document.querySelectorAll('[data-cl-persist]')) {
    next.querySelector(`[data-cl-persist="${CSS.escape(old.getAttribute('data-cl-persist')!)}"]`)?.replaceWith(old)
  }
  document.title = doc.title
  old.replaceWith(next)
  // Attaches the new islands; the loader also releases those that left with the old region.
  ;(globalThis as { __clAttach?: (root: ParentNode, navigated: 1) => void }).__clAttach?.(next, 1) // 1: navigated (bytes)
}

// Every navigation the shared guard takes over.
takeOver(() => (url, isCurrent) => swap(url, fetch, isCurrent))
