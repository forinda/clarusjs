// The route manifest: after `vite build`, what each page ships, read back from its prerendered HTML.
// dist/clarusjs-manifest.json is what `clarusjs explain` prints. Written outside dist/client, so it isn't served.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { routeToFile } from './build.ts'
import { matchRoute } from '../runtime/router.ts'

export type Attach = 'load' | 'idle' | 'visible' | 'interaction'
/**
 * An island on a page, in the manifest: its component, chunk, attach mode, how many, and its gzip size.
 * @see https://clarusjs.com/reference/server#readmanifest
 */
export type IslandInfo = { component: string; src: string; attach: Attach; count: number; gzip: number }
/**
 * A route in the manifest: its mode, islands, JavaScript and CSS.
 * @see https://clarusjs.com/reference/server#readmanifest
 */
export type RouteInfo = {
  /**
   * 'static': prerendered at build. 'server': rendered per request by dist/server/index.mjs (its key is the route as
   * its file names it). 'client': a prerendered shell; the router renders it in the browser from its __data.json.
   */
  mode: 'static' | 'server' | 'client'
  /** The prerendered file in dist/client (a client route's shell), or null for a server route. */
  html: string | null
  /** 'build': load() ran once, when the page was prerendered. 'request': it runs on every request. */
  loader: 'build' | 'request' | null
  /** A server route whose load() reads cookies (from its source). */
  cookies?: boolean
  islands: IslandInfo[]
  /** Files relative to dist/client; gzip sizes in bytes. initialGzip is what loads with the page (attach="load"). */
  js: { files: string[]; gzip: number; initialGzip: number }
  css: string[]
  /** Its config and folder layouts (#456), outermost first, from the root (`src/pages/+layout.tscl`); none: left out. */
  layouts?: string[]
  /** Its folders' +guard.ts (#457), outer first; none: left out. */
  guards?: string[]
}
/** A page's layouts and guards, by its route as its file names it (`/blog/[slug]`). */
export type RouteParts = { route: string; layouts: string[]; guards: string[] }
/**
 * The built site's route manifest (`dist/clarusjs-manifest.json`).
 * @see https://clarusjs.com/reference/server#readmanifest
 */
export type Manifest = { version: 1; routes: Record<string, RouteInfo> }
/** Vite's client manifest (dist/client/.vite/manifest.json). */
export type ChunkGraph = Record<string, { file: string; imports?: string[] }>

const attrsOf = (tag: string) => {
  const out: Record<string, string> = {}
  for (const m of tag.matchAll(/([\w-]+)="([^"]*)"/g)) out[m[1]!] = m[2]!.replace(/&amp;/g, '&')
  return out
}

/** What one prerendered page ships. `size` returns a built file's gzip size. */
export function describeRoute(route: string, html: string, opts: { base: string; chunks: ChunkGraph; size(file: string): number; loaded?: boolean; client?: boolean }): RouteInfo {
  const local = (url: string) => (url.startsWith(opts.base) ? url.slice(opts.base.length) : url.replace(/^\//, ''))
  const byFile = new Map(Object.values(opts.chunks).map((c) => [c.file, c]))
  const keyFile = new Map(Object.entries(opts.chunks).map(([k, c]) => [k, c.file]))
  // A chunk and everything it imports, in load order.
  const closure = (file: string, into: string[]) => {
    if (into.includes(file)) return
    into.push(file)
    for (const imp of byFile.get(file)?.imports ?? []) closure(keyFile.get(imp) ?? imp, into)
  }

  const islands: IslandInfo[] = []
  for (const m of html.matchAll(/<cl-island\b([^>]*)>/g)) {
    const a = attrsOf(m[1]!)
    const attach = (a.a ?? 'load') as Attach
    const src = local(a.src ?? '')
    const same = islands.find((i) => i.component === a.c && i.attach === attach)
    if (same) same.count++
    else islands.push({ component: a.c ?? '', src, attach, count: 1, gzip: opts.size(src) })
  }

  const all: string[] = []
  const initial: string[] = []
  for (const m of html.matchAll(/<script type="module" src="([^"]+)"><\/script>/g)) {
    closure(local(m[1]!), all)
    closure(local(m[1]!), initial)
  }
  // A client route also loads its page's render module, named in the shell's route table.
  const table = /<script type="application\/json" id="cl-routes"[^>]*>(.*?)<\/script>/.exec(html)?.[1]
  const render = opts.client && table ? matchRoute(JSON.parse(table), route)?.r : undefined
  if (render) {
    closure(local(render), all)
    closure(local(render), initial)
  }
  for (const island of islands) {
    closure(island.src, all)
    if (island.attach === 'load') closure(island.src, initial)
  }
  const sum = (files: string[]) => files.reduce((n, f) => n + opts.size(f), 0)
  const css = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)].map((m) => attrsOf(m[0]).href!).filter(Boolean)

  return { mode: opts.client ? 'client' : 'static', html: routeToFile(route), loader: opts.loaded ? 'build' : null, islands, js: { files: all, gzip: sum(all), initialGzip: sum(initial) }, css }
}

/** Describe every prerendered route and write `<distDir>/clarusjs-manifest.json`. */
export function writeManifest(distDir: string, routes: string[], base: string, loaded: string[] = [], server: { route: string; loader: boolean; cookies?: boolean }[] = [], parts: RouteParts[] = []): Manifest {
  const client = resolve(distDir, 'client')
  const chunks = JSON.parse(readFileSync(resolve(client, '.vite/manifest.json'), 'utf8')) as ChunkGraph
  const sizes = new Map<string, number>()
  const size = (file: string) => {
    if (!sizes.has(file)) sizes.set(file, gzipSync(readFileSync(resolve(client, file)), { level: 9 }).length)
    return sizes.get(file)!
  }
  const manifest: Manifest = { version: 1, routes: {} }
  const dataFile = (route: string) => (route === '/' ? '/__data.json' : `${route}/__data.json`)
  for (const route of routes) {
    if (route.endsWith('/__data.json') || route.endsWith('/index.frag.html')) continue // data and fragments, not pages
    const isClient = routes.includes(dataFile(route))
    // A client route's loader runs when its data file is written.
    const ran = loaded.includes(route) || (isClient && loaded.includes(dataFile(route)))
    manifest.routes[route] = describeRoute(route, readFileSync(resolve(client, routeToFile(route)), 'utf8'), { base, chunks, size, loaded: ran, client: isClient })
  }
  // Server routes have no HTML at build time: what they ship is decided per request.
  for (const { route, loader, cookies } of server) {
    manifest.routes[route] = { mode: 'server', html: null, loader: loader ? 'request' : null, ...(cookies ? { cookies: true } : {}), islands: [], js: { files: [], gzip: 0, initialGzip: 0 }, css: [] }
  }
  // Each route's layouts and guards (#472): its page's, found by pattern (a route without [params] first).
  const table = [...parts].sort((a, b) => Number(a.route.includes('[')) - Number(b.route.includes('['))).map((p) => ({ p: p.route, r: p.route }))
  for (const [route, info] of Object.entries(manifest.routes)) {
    const found = parts.find((p) => p.route === matchRoute(table, route)?.r)
    if (found?.layouts.length) info.layouts = found.layouts
    if (found?.guards.length) info.guards = found.guards
  }
  writeFileSync(resolve(distDir, 'clarusjs-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}
