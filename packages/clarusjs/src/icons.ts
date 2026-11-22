// Icons from the Iconify sets a project installs (`pnpm add -D @iconify-json/lucide`), for `<icon name="set:name" />`.
// Node only: the build, `clarusjs check`, the editor and the MCP server pass `resolveIcon` to the compiler, which stays
// pure. Nothing here reaches a browser.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

/**
 * An icon as the compiler draws it: its SVG body and its box (`viewBox="left top width height"`).
 * @see https://clarusjs.com/guide/icons
 */
export type IconData = { body: string; width: number; height: number; left: number; top: number }

/**
 * What a lookup found: the icon, or what's missing (the set, or the icon in it, with the closest names).
 * @see https://clarusjs.com/guide/icons
 */
export type IconLookup = { data: IconData } | { missing: 'set'; set: string } | { missing: 'icon'; set: string; suggestions: string[] }

type IconJson = { body?: string; width?: number; height?: number; left?: number; top?: number; parent?: string; hFlip?: boolean; vFlip?: boolean; rotate?: number }
type SetJson = { prefix: string; info?: { name?: string; total?: number }; icons: Record<string, IconJson>; aliases?: Record<string, IconJson>; width?: number; height?: number; left?: number; top?: number }

const sets = new Map<string, SetJson>() // by icons.json path; misses aren't kept, so a set installed later is found

/** The folder of the nearest package.json above `file`: where its icon sets are installed. */
function packageDir(file: string): string {
  for (let dir = dirname(file); ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'package.json'))) return dir
    if (dirname(dir) === dir) return dirname(file)
  }
}

function loadSet(set: string, fromFile: string): SetJson | undefined {
  const dir = packageDir(fromFile)
  let path: string
  try {
    path = createRequire(join(dir, 'package.json')).resolve(`@iconify-json/${set}/icons.json`)
  } catch {
    return undefined
  }
  let data = sets.get(path)
  if (!data) sets.set(path, (data = JSON.parse(readFileSync(path, 'utf8')) as SetJson))
  return data
}

/** Edit distance, for "did you mean". */
function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j]! + 1, next[j - 1]! + 1, row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
    row = next
  }
  return row[b.length]!
}

/**
 * The icon `set:name` (Iconify naming), from the sets installed for the package `fromFile` is in. Throws for an alias
 * that flips or rotates its icon (not supported yet).
 * @example
 * resolveIcon('lucide:rocket', '/app/src/pages/index.tscl') // { data: { body: '<path …/>', width: 24, … } }
 * @see https://clarusjs.com/guide/icons
 */
export function resolveIcon(name: string, fromFile: string): IconLookup {
  const colon = name.indexOf(':')
  const set = colon === -1 ? name : name.slice(0, colon)
  const icon = colon === -1 ? '' : name.slice(colon + 1)
  const data = loadSet(set, fromFile)
  if (!data) return { missing: 'set', set }
  // Own keys only: a name like constructor or __proto__ isn't an icon.
  const all: Record<string, IconJson> = Object.assign(Object.create(null), data.aliases, data.icons)
  let found = Object.hasOwn(all, icon) ? all[icon] : undefined
  if (!found) {
    const suggestions = Object.keys(all)
      .map((n) => [n, distance(icon, n)] as const)
      .filter(([n, d]) => d <= Math.max(2, Math.floor(n.length / 3)))
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([n]) => n)
    return { missing: 'icon', set, suggestions }
  }
  // An alias takes its parent's body and fills in what it doesn't set itself (chains included).
  let merged: IconJson = { ...found }
  for (let depth = 0; found.parent && depth < 10; depth++) {
    const parent = Object.hasOwn(all, found.parent) ? all[found.parent] : undefined
    if (!parent) break
    merged = { ...parent, ...merged, parent: parent.parent }
    found = parent
  }
  // ponytail: flipped and rotated aliases are refused; support them with a <g transform> around the body if a set needs it.
  for (const key of ['hFlip', 'vFlip', 'rotate'] as const) {
    if (merged[key]) throw new Error(`the icon ${name} uses ${key}, which <icon> doesn't support yet`)
  }
  return {
    data: {
      body: merged.body ?? '',
      width: merged.width ?? data.width ?? 16,
      height: merged.height ?? data.height ?? 16,
      left: merged.left ?? data.left ?? 0,
      top: merged.top ?? data.top ?? 0,
    },
  }
}

/**
 * The icon sets installed for the package `fromFile` is in (its `@iconify-json/*` dependencies, and those in its
 * node_modules), for the editor's completion.
 * @example
 * iconSets('/app/src/pages/index.tscl') // [{ prefix: 'lucide', name: 'Lucide', total: 1600 }]
 * @see https://clarusjs.com/guide/icons
 */
export function iconSets(fromFile: string): { prefix: string; name: string; total: number }[] {
  const dir = packageDir(fromFile)
  const names = new Set<string>()
  try {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Record<string, Record<string, string> | undefined>
    for (const deps of [pkg.dependencies, pkg.devDependencies]) for (const d of Object.keys(deps ?? {})) if (d.startsWith('@iconify-json/')) names.add(d.slice(14))
  } catch {}
  try {
    for (const d of readdirSync(join(dir, 'node_modules/@iconify-json'))) names.add(d)
  } catch {}
  const out: { prefix: string; name: string; total: number }[] = []
  for (const prefix of [...names].sort()) {
    const data = loadSet(prefix, fromFile)
    if (data) out.push({ prefix, name: data.info?.name ?? prefix, total: data.info?.total ?? Object.keys(data.icons).length })
  }
  return out
}

/**
 * The names in an installed set (icons and aliases, sorted); none when it isn't installed.
 * @example
 * iconNames('lucide', '/app/src/pages/index.tscl') // ['a-arrow-down', …, 'rocket', …]
 * @see https://clarusjs.com/guide/icons
 */
export function iconNames(set: string, fromFile: string): string[] {
  const data = loadSet(set, fromFile)
  return data ? Object.keys({ ...data.icons, ...data.aliases }).sort() : []
}

/**
 * A standalone `<svg>` for an icon, with extra attributes (`'width="48"'`); the editor's hover preview uses it.
 * @example
 * iconSvg(data, 'width="48" height="48"') // '<svg xmlns="…" viewBox="0 0 24 24" width="48" height="48">…</svg>'
 * @see https://clarusjs.com/guide/icons
 */
export function iconSvg(data: IconData, attrs = ''): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${data.left} ${data.top} ${data.width} ${data.height}"${attrs ? ' ' + attrs : ''}>${data.body}</svg>`
}
