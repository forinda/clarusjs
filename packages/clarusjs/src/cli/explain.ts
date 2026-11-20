// `clarusjs explain [route]`: where each part of a built route runs, in plain words, from dist/clarusjs-manifest.json.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Attach, Manifest, RouteInfo } from '../vite/manifest.ts'

export type ExplainResult = { exitCode: 0 | 1; text: string; json: string }

const WHEN: Record<Attach, string> = {
  load: 'on page load',
  idle: 'when the browser is idle',
  visible: 'when scrolled into view',
  interaction: 'on first interaction',
}
const kb = (bytes: number) => (bytes ? `${(bytes / 1024).toFixed(1)} KB` : '0 KB')
const row = (label: string, lines: string[]) => lines.map((l, i) => `  ${(i ? '' : label).padEnd(12)}${l}`)

function describe(path: string, r: RouteInfo): string {
  const islands = r.islands.map((i) => `${i.component}${i.count > 1 ? ` ×${i.count}` : ''} (${kb(i.gzip)}, ${WHEN[i.attach]})`)
  return [
    path,
    ...row('Rendered', [`at build time, to dist/client/${r.html}`]),
    ...row('Data', [r.loader === 'build' ? 'load() ran once, at build time' : 'no loader']),
    ...row('Islands', islands.length ? islands : ['none']),
    ...row('JavaScript', [r.js.files.length ? `${kb(r.js.initialGzip)} on page load, ${kb(r.js.gzip)} in all (gzip, ${r.js.files.length} files)` : 'none']),
    ...row('CSS', [r.css.length ? r.css.join(', ') : 'none']),
  ].join('\n')
}

function table(routes: Record<string, RouteInfo>): string {
  const width = Math.max(5, ...Object.keys(routes).map((r) => r.length)) + 2
  const line = (cells: string[]) => cells[0]!.padEnd(width) + cells[1]!.padEnd(9) + cells[2]!.padEnd(12) + cells[3]
  return [
    line(['Route', 'Islands', 'JS on load', 'JS in all']),
    ...Object.entries(routes).map(([path, r]) => line([path, String(r.islands.reduce((n, i) => n + i.count, 0)), kb(r.js.initialGzip), kb(r.js.gzip)])),
  ].join('\n')
}

export function explain(options: { root: string; route?: string }): ExplainResult {
  let manifest: Manifest
  try {
    manifest = JSON.parse(readFileSync(resolve(options.root, 'dist/clarusjs-manifest.json'), 'utf8')) as Manifest
  } catch {
    return { exitCode: 1, text: 'No dist/clarusjs-manifest.json: run vite build first, then explain the built site.', json: '{}' }
  }
  if (options.route === undefined) return { exitCode: 0, text: table(manifest.routes), json: JSON.stringify(manifest.routes, null, 2) }
  const path = options.route.replace(/(.)\/+$/, '$1')
  const route = manifest.routes[path]
  if (!route) return { exitCode: 1, text: `No route ${path}. Routes: ${Object.keys(manifest.routes).join(', ')}`, json: '{}' }
  return { exitCode: 0, text: describe(path, route), json: JSON.stringify({ route: path, ...route }, null, 2) }
}
