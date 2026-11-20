// Per-route rendering modes: when each route renders. 'static' at build (the default), 'server' per request.

export type Mode = 'static' | 'server'
export type ModeTable = Record<string, string>

const MODES = ['static', 'server']

/** Throws on an unknown mode or a malformed pattern, naming it. */
export function checkModes(table: ModeTable): void {
  for (const [pattern, mode] of Object.entries(table)) {
    if (!pattern.startsWith('/')) throw new Error(`clarusjs: route pattern "${pattern}" must start with /`)
    if (pattern.slice(0, -1).includes('*') || (pattern.endsWith('*') && !pattern.endsWith('/*'))) {
      throw new Error(`clarusjs: route pattern "${pattern}" may only use * as its last segment`)
    }
    // ponytail: 'client' (rendered in the browser) needs the client router; until then it is rejected by name.
    if (mode === 'client') throw new Error(`clarusjs: routes['${pattern}'] is "client", which isn't available yet; use 'static' or 'server'`)
    if (!MODES.includes(mode)) throw new Error(`clarusjs: routes['${pattern}'] is "${mode}"; use 'static' or 'server'`)
  }
}

/** The mode of a route (as its file names it, e.g. '/account/[id]'): the most specific matching pattern wins. */
export function modeFor(route: string, table: ModeTable): Mode {
  let best: { length: number; mode: Mode } | undefined
  for (const [pattern, mode] of Object.entries(table)) {
    const folder = pattern.endsWith('/*') ? pattern.slice(0, -2) : undefined
    const hit = folder !== undefined ? route === (folder || '/') || route.startsWith(`${folder}/`) : route === pattern
    // An exact pattern beats a folder of the same length.
    const length = folder !== undefined ? folder.length : pattern.length + 0.5
    if (hit && (!best || length > best.length)) best = { length, mode: mode as Mode }
  }
  return best?.mode ?? 'static'
}
