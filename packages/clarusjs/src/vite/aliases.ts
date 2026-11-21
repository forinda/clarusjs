// Path aliases, one list for every place that resolves an import (dev, build, prerender, the plugin's own component
// and stylesheet discovery, clarusjs check): built-in ~/ → src/, the project's tsconfig.json (or jsconfig.json)
// `paths`, and Vite's `resolve.alias` entries with a string `find`.
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** `find` ending in '/' is a prefix; otherwise it matches itself, and (unless `exact`) itself followed by '/…'. */
export type Alias = { find: string; replacement: string; exact?: boolean }

/** tsconfig/jsconfig text: JSON with comments and trailing commas. */
function readJsonc(text: string): unknown {
  // Strings are kept as they are; comments outside them go, then trailing commas.
  const bare = text.replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (_, str: string | undefined) => str ?? '')
  return JSON.parse(bare.replace(/,(\s*[}\]])/g, '$1'))
}

/** The project's aliases; `vite`: the Vite config's `resolve.alias` (an object or a list). */
export function projectAliases(root: string, vite: unknown = []): Alias[] {
  const aliases: Alias[] = [{ find: '~/', replacement: resolve(root, 'src') + '/' }]
  // ponytail: one config file and no `extends` chain; projects that keep paths in a base config can repeat them.
  const config = ['tsconfig.json', 'jsconfig.json'].map((name) => resolve(root, name)).find(existsSync)
  if (config) {
    let options: { baseUrl?: string; paths?: Record<string, string[]> } = {}
    try { options = (readJsonc(readFileSync(config, 'utf8')) as { compilerOptions?: typeof options }).compilerOptions ?? {} } catch {}
    const base = resolve(root, options.baseUrl ?? '.')
    for (const [key, targets] of Object.entries(options.paths ?? {})) {
      const target = targets?.[0]
      if (!target) continue
      if (key.endsWith('/*') && target.endsWith('/*')) aliases.push({ find: key.slice(0, -1), replacement: resolve(base, target.slice(0, -2)) + '/' })
      else if (!key.includes('*')) aliases.push({ find: key, replacement: resolve(base, target), exact: true })
    }
  }
  const list = Array.isArray(vite) ? vite : vite && typeof vite === 'object' ? Object.entries(vite).map(([find, replacement]) => ({ find, replacement })) : []
  for (const { find, replacement } of list as { find: unknown; replacement: unknown }[]) {
    if (typeof find === 'string' && typeof replacement === 'string') aliases.push({ find, replacement })
  }
  // Longest first, so '~/ui/' wins over '~/'.
  return aliases.sort((a, b) => b.find.length - a.find.length)
}

/** Where `spec` points when an alias matches it (an absolute path), else undefined. */
export function resolveAlias(spec: string, aliases: Alias[]): string | undefined {
  for (const { find, replacement, exact } of aliases) {
    if (find.endsWith('/') ? spec.startsWith(find) : spec === find) return spec === find ? replacement : replacement + spec.slice(find.length)
    if (!exact && !find.endsWith('/') && spec.startsWith(find + '/')) return replacement + spec.slice(find.length)
  }
  return undefined
}
