// What `clarusjs check` needs from the app's Vite config: the clarusjs plugin's page sources (Markdown, …) and
// resolve.alias, so check sees the same pages and imports as the build. Read with Vite's own config loader.
import { resolve } from 'node:path'
import type { CheckSource } from './check.ts'

type Plugin = { name?: string; api?: { sources?: CheckSource[] } }

/** Vite's plugins option: plugins, falsy entries, nested arrays and promises of any of these. */
async function flatten(plugins: unknown): Promise<Plugin[]> {
  const value = await plugins
  if (Array.isArray(value)) return (await Promise.all(value.map(flatten))).flat()
  return value && typeof value === 'object' ? [value as Plugin] : []
}

export async function loadProject(root: string): Promise<{ sources: CheckSource[]; viteAliases: unknown }> {
  let vite: typeof import('vite')
  try { vite = await import('vite') } catch { return { sources: [], viteAliases: undefined } } // vite is a peer dependency
  const loaded = await vite.loadConfigFromFile({ command: 'build', mode: 'production' }, undefined, resolve(root), 'silent')
  if (!loaded) return { sources: [], viteAliases: undefined }
  const plugin = (await flatten(loaded.config.plugins)).find((p) => p.name === 'clarusjs')
  return { sources: plugin?.api?.sources ?? [], viteAliases: loaded.config.resolve?.alias }
}
