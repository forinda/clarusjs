// Build-time link checking: once every page is built, links between pages and to #anchors are checked against
// what was actually written. Reads dist/client only; reporting and failing are up to the caller.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { routeToFile } from './build.ts'

export type LinkIssue = { kind: 'pages' | 'anchors' | 'outside'; page: string; href: string; message: string }

type Options = {
  outDir: string
  /** Every built route (static pages and client shells), as URLs without the base. */
  routes: string[]
  /** Server routes as their files name them ('/account/[id]'): rendered per request, so any match counts. */
  serverRoutes: string[]
  /** Client routes render in the browser: their pages exist, but their anchors can't be checked at build. */
  clientRoutes: string[]
  base: string
  /** site.url: absolute links to the site itself are checked like internal ones. */
  site?: string
}

// A stray % is kept as written, as routeToFile does, instead of failing the build with a URIError.
const decode = (s: string) => { try { return decodeURIComponent(s) } catch { return s } }
const isFile = (path: string) => { try { return statSync(path).isFile() } catch { return false } }
const trim = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path)

/** Edit distance, for "did you mean". */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const next = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = row[j]!
      row[j] = next
    }
  }
  return row[b.length]!
}

/** The closest candidate, if it is close enough to be a likely typo. */
function closest(target: string, candidates: Iterable<string>): string | undefined {
  let best: string | undefined
  let score = Infinity
  for (const c of candidates) {
    const d = distance(target, c)
    if (d < score) { best = c; score = d }
  }
  return best !== undefined && score <= Math.max(2, Math.floor(target.length / 3)) ? best : undefined
}

const ids = (html: string) => new Set([...html.matchAll(/\s(?:id|name)="([^"]+)"/g)].map((m) => m[1]!))
const hrefs = (html: string) => [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<a\b[^>]*?\shref="([^"]*)"/g)].map((m) => m[1]!.replace(/&amp;/g, '&'))

export function checkLinks(options: Options): LinkIssue[] {
  const { outDir } = options
  // A full-URL (CDN) base serves assets only: pages, and so their links, stay at the site root (as sitePrefix() has it).
  const base = /^https?:\/\//i.test(options.base) ? '/' : options.base
  const siteRoot = options.site ? new URL(base, options.site.replace(/\/?$/, '/')) : undefined
  const routes = new Set(options.routes.map(trim))
  const client = new Set(options.clientRoutes.map(trim))
  const serverPatterns = options.serverRoutes.map((r) => new RegExp(`^${r.split('/').map((seg) => (/^\[[^\]]+\]$/.test(seg) ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('/')}$`))
  const html = new Map<string, string>()
  const read = (route: string) => {
    if (!html.has(route)) {
      const file = resolve(outDir, routeToFile(route))
      html.set(route, existsSync(file) ? readFileSync(file, 'utf8') : '')
    }
    return html.get(route)!
  }
  const issues: LinkIssue[] = []
  for (const page of [...routes].filter((r) => !client.has(r))) {
    for (let href of hrefs(read(page))) {
      // Absolute links to the site itself (compared parsed: host case, the base with or without its slash).
      if (siteRoot && /^(https?:)?\/\//i.test(href)) {
        const u = new URL(href, siteRoot) // //host/… (a network path) takes the site's scheme
        if (u.origin === siteRoot.origin && (u.pathname.startsWith(siteRoot.pathname) || `${u.pathname}/` === siteRoot.pathname)) {
          href = base + u.pathname.slice(Math.min(u.pathname.length, siteRoot.pathname.length)) + u.search + u.hash
        } else if (u.origin === siteRoot.origin && base !== '/') {
          issues.push({ kind: 'outside', page, href, message: `${href} is outside the base ${base} (fine for another site on this origin)` })
          continue
        }
      }
      if (/^[a-z][\w+.-]*:|^\/\//i.test(href) || href === '') continue // external, mailto:, tel:, …
      const url = new URL(href, `http://site${base}${page === '/' ? '' : page.slice(1) + '/'}`)
      if (!url.pathname.startsWith(base) && `${url.pathname}/` !== base) {
        // a root-relative link outside the base: written around it (templates get the base by themselves)
        if (base !== '/' && href.startsWith('/')) issues.push({ kind: 'outside', page, href, message: `${href} is outside the base ${base} (fine for another site on this origin)` })
        continue
      }
      let path = trim(decode(url.pathname.slice(base.length - 1)) || '/')
      if (path.endsWith('/index.html')) path = trim(path.slice(0, -'index.html'.length))
      const anchor = decode(url.hash.slice(1))
      const isPage = routes.has(path)
      const exists = isPage || serverPatterns.some((re) => re.test(path)) || isFile(resolve(outDir, `.${path}`)) // a directory without a page is a 404
      if (!exists) {
        const guess = closest(path, routes)
        issues.push({ kind: 'pages', page, href, message: `no page at ${path}${guess ? ` (did you mean ${guess}?)` : ''}` })
        continue
      }
      if (!anchor || !isPage || client.has(path)) continue
      const targets = ids(read(path))
      if (targets.has(anchor)) continue
      const guess = closest(anchor, targets)
      issues.push({ kind: 'anchors', page, href, message: `no #${anchor} on ${path}${guess ? ` (did you mean #${guess}?)` : ''}` })
    }
  }
  return issues
}
