// Every page's <head>: <cl-head> contents moved in from the page, a title template, site-wide tags and a final
// transform. Page tags win over site tags with the same key (title, meta name/property, canonical link…).
import { escape, json } from '../runtime/html.ts'

/**
 * A head tag as data: ['meta', { name: 'theme-color', content: '#fff' }], ['script', { src }, ''].
 * @see https://clarusjs.com/reference/vite-plugin#head
 */
export type HeadTag = [tag: string, attrs: Record<string, string | true>, content?: string]

export type HeadOptions = {
  /** '%s · Site': wraps the document's <title>. A <title> inside <cl-head> is used as written. */
  titleTemplate?: string
  /** Tags on every page, unless the page has its own with the same key. */
  tags?: HeadTag[]
  /** Structured data on every page (schema.org WebSite, Organization…): one JSON-LD script per object. */
  jsonLd?: object | object[]
  /** The site's public address: canonical URLs and social cards (Open Graph, Twitter) on every page. */
  site?: SiteOptions
  /** Vite's base ('/' or '/docs/'): public files and pages live under it. */
  base?: string
  /** Last word on the head's HTML (from src/head.ts in an app). */
  transform?: (head: string, page: { route: string; path: string }) => string
}

export type SiteOptions = { url: string; name?: string; image?: string }

const VOID = new Set(['meta', 'link', 'base'])

export function renderTag([tag, attrs, content]: HeadTag): string {
  const a = Object.entries(attrs).map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${escape(v)}"`)).join('')
  return VOID.has(tag) && content === undefined ? `<${tag}${a}>` : `<${tag}${a}>${content ?? ''}</${tag}>`
}

/** What makes two head tags the same tag: the page's wins. Tags without a key are never merged. */
function key(tag: string): string | undefined {
  const name = /^<([a-z]+)/i.exec(tag)?.[1]!.toLowerCase()
  const attr = (n: string) => {
    const m = new RegExp(`\\s${n}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag)
    return m ? m[1] ?? m[2] ?? m[3] : undefined
  }
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

/** Tags are found in the comment-masked text (same offsets) and copied from the original: comments stay comments. */
type Span = { at: number; text: string }
function spansOf(html: string, mask: (html: string) => string): Span[] {
  return [...mask(html).matchAll(TAGS)].map((m) => ({ at: m.index!, text: html.slice(m.index!, m.index! + m[0].length) }))
}

/** `tag` in place of the head's tag with the same key, or added at the end. */
function setTag(head: string, tag: string, mask: (html: string) => string): string {
  const k = key(tag)
  const same = k ? spansOf(head, mask).find((t) => key(t.text) === k) : undefined
  return same ? head.slice(0, same.at) + tag + head.slice(same.at + same.text.length) : head + tag
}

/**
 * The full document `html` with its head completed, in order: <cl-head> tags from the page (they win), the title
 * template, site tags for keys the page left unset, canonical and social defaults for keys still unset, JSON-LD,
 * then the transform. `mask` blanks comments (keeping offsets), so tag-shaped text in comments is never used.
 */
export function completeHead(html: string, mask: (html: string) => string, options: HeadOptions, page: { route: string; path: string }): string {
  // <cl-head> anywhere in the page: its contents join the head, and it leaves the body.
  const own: string[] = []
  for (const m of [...mask(html).matchAll(/<cl-head>([\s\S]*?)<\/cl-head>/gi)].reverse()) {
    const inner = m.index! + '<cl-head>'.length
    own.unshift(...spansOf(html.slice(inner, m.index! + m[0].length - '</cl-head>'.length), mask).map((t) => t.text))
    html = html.slice(0, m.index) + html.slice(m.index! + m[0].length)
  }
  // A document without a <head> gets one, right after <html>, so nothing is lost.
  if (mask(html).search(/<head\b[^>]*>/i) === -1) {
    const tag = /<html\b[^>]*>/i.exec(mask(html))
    if (!tag) return html
    html = html.slice(0, tag.index + tag[0].length) + '<head></head>' + html.slice(tag.index + tag[0].length)
  }
  const masked = mask(html)
  const open = /<head\b[^>]*>/i.exec(masked)!
  const close = masked.search(/<\/head\s*>/i)
  if (close === -1) return html
  const start = open.index + open[0].length
  let head = html.slice(start, close)
  const find = (k: string) => spansOf(head, mask).find((t) => key(t.text) === k)
  const rawTitle = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(own.find((t) => key(t) === 'title') ?? find('title')?.text ?? '')?.[1] ?? ''
  const title = find('title')
  if (options.titleTemplate && title && !own.some((t) => key(t) === 'title')) {
    const wrapped = title.text.replace(/(<title\b[^>]*>)([\s\S]*?)(<\/title\s*>)/i, (_, a: string, text: string, b: string) => a + escape(options.titleTemplate!).replace('%s', () => text) + b)
    head = head.slice(0, title.at) + wrapped + head.slice(title.at + title.text.length)
  }
  for (const tag of own) head = setTag(head, tag, mask)
  // What the page itself set, before site tags fill in: its og:image and og:url are resolved against the page.
  const pageSet = { image: content(find('meta:property:og:image')?.text), url: content(find('meta:property:og:url')?.text) }
  const fill = (tag: string) => { if (!find(key(tag) ?? '')) head += tag }
  for (const t of options.tags ?? []) {
    const tag = renderTag(t)
    if (key(tag)) fill(tag)
    else head += tag
  }
  head = social(head, rawTitle, options, page, pageSet, mask)
  for (const data of [options.jsonLd ?? []].flat()) head += `<script type="application/ld+json">${json(data)}</script>`
  if (options.transform) head = options.transform(head, page)
  return html.slice(0, start) + head + html.slice(close)
}

const decode = (html: string) => html.replace(/&(#x?[\da-f]+|amp|lt|gt|quot|apos|#39);/gi, (m, e: string) => {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
  if (e[0] !== '#') return named[e.toLowerCase()] ?? m
  return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
})

/** A tag's content attribute, decoded ('' when there is no tag or attribute). */
function content(tag: string | undefined): string {
  const m = /\scontent\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag ?? '')
  return decode(m ? m[1] ?? m[2] ?? m[3] ?? '' : '')
}

/**
 * Canonical URL and social card tags from site.url, filling only keys still unset. The page's own og:image and
 * og:url are made absolute (root-relative: under the base; relative: against the page). Without site.url, a relative
 * og:image or og:url can't be made absolute, so it is an error instead of a card that silently breaks.
 */
function social(head: string, title: string, options: HeadOptions, page: { path: string }, pageSet: { image: string; url: string }, mask: (html: string) => string): string {
  const find = (k: string) => spansOf(head, mask).find((t) => key(t.text) === k)
  const relative = (u: string) => u !== '' && !/^[a-z][\w+.-]*:|^\/\//i.test(u)
  if (!options.site) {
    for (const k of ['meta:property:og:image', 'meta:property:og:url']) {
      const value = content(find(k)?.text)
      if (relative(value)) throw new Error(`${page.path}: ${k.slice(14)} "${value}" is relative: set site.url in the clarusjs plugin so it can be made absolute`)
    }
    return head
  }
  const root = new URL(basePath(options.base), options.site.url.replace(/\/?$/, '/'))
  // './' keeps the request path a path under the root: '/https:/evil.com' must not become another site.
  const url = new URL(`./${page.path.slice(1)}`, root).href
  const absolute = (u: string) => (u.startsWith('/') && !u.startsWith('//') ? new URL(u.slice(1), root).href : new URL(u, url.endsWith('/') ? url : `${url}/`).href)
  for (const [property, value] of [['og:image', pageSet.image], ['og:url', pageSet.url]] as const) {
    if (relative(value)) head = setTag(head, `<meta property="${property}" content="${escape(absolute(value))}">`, mask)
  }
  const set = (k: string) => !!find(k)
  const add = (tag: string) => { if (!set(key(tag)!)) head += tag }
  const image = content(find('meta:property:og:image')?.text) || options.site.image || ''
  const description = content(find('meta:name:description')?.text)
  add(`<link rel="canonical" href="${escape(url)}">`)
  add(`<meta property="og:title" content="${escape(decode(title))}">`)
  if (description) add(`<meta property="og:description" content="${escape(description)}">`)
  add(`<meta property="og:url" content="${escape(url)}">`)
  add('<meta property="og:type" content="website">')
  if (options.site.name) add(`<meta property="og:site_name" content="${escape(options.site.name)}">`)
  if (image) add(`<meta property="og:image" content="${escape(relative(image) ? absolute(image) : image)}">`)
  add(`<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`)
  return head
}

/** Vite's base as a path: an absolute base (https://cdn.example.com/docs/) counts by its pathname. */
export function basePath(base = '/'): string {
  return /^https?:\/\//i.test(base) ? new URL(base).pathname : base
}
