// The route manifest: after `vite build`, what each page ships, read back from its prerendered HTML.
// dist/clarusjs-manifest.json is what `clarusjs explain` prints. Written outside dist/client, so it isn't served.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { routeToFile } from './build.ts'

export type Attach = 'load' | 'idle' | 'visible' | 'interaction'
export type IslandInfo = { component: string; src: string; attach: Attach; count: number; gzip: number }
export type RouteInfo = {
  mode: 'static'
  html: string
  loader: null
  islands: IslandInfo[]
  /** Files relative to dist/client; gzip sizes in bytes. initialGzip is what loads with the page (attach="load"). */
  js: { files: string[]; gzip: number; initialGzip: number }
  css: string[]
}
export type Manifest = { version: 1; routes: Record<string, RouteInfo> }
/** Vite's client manifest (dist/client/.vite/manifest.json). */
export type ChunkGraph = Record<string, { file: string; imports?: string[] }>

const attrsOf = (tag: string) => {
  const out: Record<string, string> = {}
  for (const m of tag.matchAll(/([\w-]+)="([^"]*)"/g)) out[m[1]!] = m[2]!.replace(/&amp;/g, '&')
  return out
}

/** What one prerendered page ships. `size` returns a built file's gzip size. */
export function describeRoute(route: string, html: string, opts: { base: string; chunks: ChunkGraph; size(file: string): number }): RouteInfo {
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
  for (const island of islands) {
    closure(island.src, all)
    if (island.attach === 'load') closure(island.src, initial)
  }
  const sum = (files: string[]) => files.reduce((n, f) => n + opts.size(f), 0)
  const css = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)].map((m) => attrsOf(m[0]).href!).filter(Boolean)

  // ponytail: every route is prerendered with no data loader; mode and loader become real with routing (#28).
  return { mode: 'static', html: routeToFile(route), loader: null, islands, js: { files: all, gzip: sum(all), initialGzip: sum(initial) }, css }
}

/** Describe every prerendered route and write `<distDir>/clarusjs-manifest.json`. */
export function writeManifest(distDir: string, routes: string[], base: string): Manifest {
  const client = resolve(distDir, 'client')
  const chunks = JSON.parse(readFileSync(resolve(client, '.vite/manifest.json'), 'utf8')) as ChunkGraph
  const sizes = new Map<string, number>()
  const size = (file: string) => {
    if (!sizes.has(file)) sizes.set(file, gzipSync(readFileSync(resolve(client, file)), { level: 9 }).length)
    return sizes.get(file)!
  }
  const manifest: Manifest = { version: 1, routes: {} }
  for (const route of routes) {
    manifest.routes[route] = describeRoute(route, readFileSync(resolve(client, routeToFile(route)), 'utf8'), { base, chunks, size })
  }
  writeFileSync(resolve(distDir, 'clarusjs-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}
