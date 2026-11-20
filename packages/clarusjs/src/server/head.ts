// Every page's <head>: <cl-head> contents moved in from the page, a title template, site-wide tags and a final
// transform. Page tags win over site tags with the same key (title, meta name/property, canonical link…).
import { escape, json } from '../runtime/html.ts'

/** A head tag as data: ['meta', { name: 'theme-color', content: '#fff' }], ['script', { src }, ''] */
export type HeadTag = [tag: string, attrs: Record<string, string | true>, content?: string]

export type HeadOptions = {
  /** '%s · Site': wraps the document's <title>. A <title> inside <cl-head> is used as written. */
  titleTemplate?: string
  /** Tags on every page, unless the page has its own with the same key. */
  tags?: HeadTag[]
  /** Structured data on every page (schema.org WebSite, Organization…): one JSON-LD script per object. */
  jsonLd?: object | object[]
  /** Last word on the head's HTML (from src/head.ts in an app). */
  transform?: (head: string, page: { route: string; path: string }) => string
}

const VOID = new Set(['meta', 'link', 'base'])

export function renderTag([tag, attrs, content]: HeadTag): string {
  const a = Object.entries(attrs).map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${escape(v)}"`)).join('')
  return VOID.has(tag) && content === undefined ? `<${tag}${a}>` : `<${tag}${a}>${content ?? ''}</${tag}>`
}

/** What makes two head tags the same tag: the page's wins. Tags without a key are never merged. */
function key(tag: string): string | undefined {
  const name = /^<([a-z]+)/i.exec(tag)?.[1]!.toLowerCase()
  const attr = (n: string) => new RegExp(`\\s${n}\\s*=\\s*"([^"]*)"`, 'i').exec(tag)?.[1]
  if (name === 'title' || name === 'base') return name
  if (name === 'meta') {
    if (/\scharset\b/i.test(tag)) return 'meta:charset'
    for (const n of ['name', 'property', 'http-equiv']) if (attr(n) !== undefined) return `meta:${n}:${attr(n)}`
  }
  if (name === 'link' && attr('rel') === 'canonical') return 'link:canonical'
  return undefined
}

// The head's top-level tags: elements with content (title, script, style, noscript) or void ones.
const TAGS = /<(title|script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>|<(?:meta|link|base)\b[^>]*>/gi
const tags = (html: string) => [...html.matchAll(TAGS)].map((m) => m[0])

/**
 * The full document `html` (it has a <head>) with its head completed. `mask` is html with comments blanked, so
 * tag-shaped text in comments is never moved.
 */
export function completeHead(html: string, mask: (html: string) => string, options: HeadOptions, page: { route: string; path: string }): string {
  // <cl-head> anywhere in the page: its contents join the head, and it leaves the body.
  const own: string[] = []
  let masked = mask(html)
  for (const m of [...masked.matchAll(/<cl-head>([\s\S]*?)<\/cl-head>/gi)].reverse()) {
    own.unshift(...tags(html.slice(m.index! + '<cl-head>'.length, m.index! + m[0].length - '</cl-head>'.length)))
    html = html.slice(0, m.index) + html.slice(m.index! + m[0].length)
  }
  masked = mask(html)
  const open = /<head\b[^>]*>/i.exec(masked)
  const close = masked.search(/<\/head\s*>/i)
  if (!open || close === -1) return html
  const start = open.index + open[0].length
  let head = html.slice(start, close)
  if (options.titleTemplate && !own.some((t) => key(t) === 'title')) {
    head = head.replace(/(<title\b[^>]*>)([\s\S]*?)(<\/title\s*>)/i, (_, a: string, text: string, b: string) => a + escape(options.titleTemplate!).replace('%s', () => text) + b)
  }
  // Page tags replace a head tag with the same key, or are added; site tags only fill keys nobody set.
  for (const tag of own) {
    const k = key(tag)
    const same = k ? tags(head).find((t) => key(t) === k) : undefined
    head = same ? head.replace(same, () => tag) : head + tag
  }
  const present = new Set(tags(head).map(key).filter(Boolean))
  for (const t of options.tags ?? []) {
    const tag = renderTag(t)
    const k = key(tag)
    if (!k || !present.has(k)) head += tag
  }
  for (const data of [options.jsonLd ?? []].flat()) head += `<script type="application/ld+json">${json(data)}</script>`
  if (options.transform) head = options.transform(head, page)
  return html.slice(0, start) + head + html.slice(close)
}
