// Static redirects (`redirects: { '/old': '/new' }`): a page at each old path that sends visitors on (any static
// host), lines in _redirects (Netlify, Cloudflare Pages: a real 301), and a 301 from the dev server.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { routeToFile } from './build.ts'

const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/** Old paths start with /; none may be a page (`pages`: the site's routes, [param] segments matching any one). */
export function checkRedirects(redirects: Record<string, string>, pages: string[] = []): void {
  const route = (r: string) => new RegExp(`^${r.split('/').map((seg) => (/^\[[^\]]+\]$/.test(seg) ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('/')}$`)
  for (const from of Object.keys(redirects)) {
    if (!from.startsWith('/')) throw new Error(`clarusjs: redirects['${from}']: paths start with /`)
    if (pages.some((p) => route(p).test(trim(from)))) throw new Error(`clarusjs: redirects['${from}']: ${from} is a page; remove the page or the redirect`)
  }
}

const trim = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path)
/** Where a redirect goes: site paths get the base. */
const target = (to: string, prefix: string) => (to.startsWith('/') ? prefix + to : to)

/** The redirect for a request path in dev (the base already removed), or undefined. */
export function redirectFor(redirects: Record<string, string>, pathname: string, prefix: string): string | undefined {
  const to = Object.entries(redirects).find(([from]) => trim(from) === trim(pathname))?.[1]
  return to === undefined ? undefined : target(to, prefix)
}

/** Writes each old path's page and the _redirects lines (after any the site's public/ already has). */
export function writeRedirects(out: string, redirects: Record<string, string>, prefix: string): void {
  const lines: string[] = []
  for (const [from, to] of Object.entries(redirects)) {
    const url = attr(target(to, prefix))
    const file = resolve(out, routeToFile(from))
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8"><title>Moved</title><meta http-equiv="refresh" content="0; url=${url}"><link rel="canonical" href="${url}"><meta name="robots" content="noindex"></head><body><p>This page moved to <a href="${url}">${url}</a>.</p></body></html>\n`)
    lines.push(`${prefix}${trim(from)} ${target(to, prefix)} 301\n`)
  }
  const file = resolve(out, '_redirects')
  if (lines.length) writeFileSync(file, (existsSync(file) ? readFileSync(file, 'utf8').replace(/\n?$/, '\n') : '') + lines.join(''))
}
