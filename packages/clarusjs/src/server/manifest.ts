// Read the route manifest while pages are prerendered. Server only (Node): a page that calls readManifest() during
// `vite build` is rendered again once the manifest is written, so it can show what the built site ships.
import { readFileSync } from 'node:fs'
import type { Manifest } from '../vite/manifest.ts'

export type { Manifest, RouteInfo, IslandInfo } from '../vite/manifest.ts'

/** The built site's manifest, or null outside `vite build` (in dev) and on the first prerender pass. */
export function readManifest(): Manifest | null {
  ;(globalThis as { __clManifestRead?: boolean }).__clManifestRead = true
  const file = process.env.CLARUS_MANIFEST
  if (!file) return null
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Manifest
  } catch {
    return null
  }
}
