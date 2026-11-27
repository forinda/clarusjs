// What `clarusjs check` needs from the app's Vite config: the clarusjs plugin's page sources (Markdown, …) and
// resolve.alias, so check sees the same pages and imports as the build. Read with Vite's own config loader.
import type { LibraryOption } from '../vite/libraries.ts'
import type { EnvOption } from '../vite/env.ts'
import { resolve } from 'node:path'
import type { CheckSource } from './check.ts'
import type { LintConfig, LintRuleDef } from '../compiler/lint.ts'

type Plugin = { name?: string; api?: { sources?: CheckSource[]; lint?: LintConfig; lintRules?: LintRuleDef[]; components?: { dirs?: string[]; auto?: boolean; libraries?: LibraryOption[] }; env?: EnvOption } }

/** Vite's plugins option: plugins, falsy entries, nested arrays and promises of any of these. */
async function flatten(plugins: unknown): Promise<Plugin[]> {
  const value = await plugins
  if (Array.isArray(value)) return (await Promise.all(value.map(flatten))).flat()
  return value && typeof value === 'object' ? [value as Plugin] : []
}

type Project = { sources: CheckSource[]; viteAliases: unknown; lint: LintConfig | undefined; lintRules: LintRuleDef[]; components?: { dirs?: string[]; auto?: boolean; libraries?: LibraryOption[] }; env?: EnvOption; envPrefix?: string | string[] }
const none: Project = { sources: [], viteAliases: undefined, lint: undefined, lintRules: [] }

export async function loadProject(root: string): Promise<Project> {
  let vite: typeof import('vite')
  try { vite = await import('vite') } catch { return none } // vite is a peer dependency
  const loaded = await vite.loadConfigFromFile({ command: 'build', mode: 'production' }, undefined, resolve(root), 'silent')
  if (!loaded) return none
  const plugin = (await flatten(loaded.config.plugins)).find((p) => p.name === 'clarusjs')
  return { sources: plugin?.api?.sources ?? [], viteAliases: loaded.config.resolve?.alias, lint: plugin?.api?.lint, lintRules: plugin?.api?.lintRules ?? [], components: plugin?.api?.components, env: plugin?.api?.env, envPrefix: loaded.config.envPrefix }
}
