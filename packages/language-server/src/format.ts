// Format Document: the project's own Prettier with @clarusjs/prettier-plugin and the project's Prettier config, so the
// editor formats as `prettier --write` does. Trusted workspaces only (it runs the project's code), and only from the
// folder's own node_modules, as for the compiler. Otherwise, no formatting.
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Formats a .tscl file's text (`path` picks the Prettier config). */
export type Formatter = (text: string, path: string) => Promise<string>

export async function loadFormatter(root: string, trusted: boolean, log: (message: string) => void): Promise<Formatter | undefined> {
  if (!trusted) return undefined
  const find = (name: string) => {
    if (!existsSync(join(root, 'node_modules', name, 'package.json'))) return undefined
    try { return createRequire(join(root, 'package.json')).resolve(name) } catch { return undefined }
  }
  const prettierEntry = find('prettier')
  const plugin = find('@clarusjs/prettier-plugin')
  if (!prettierEntry || !plugin) {
    log(`clarusjs: no formatting (install prettier and @clarusjs/prettier-plugin in the project; missing: ${[!prettierEntry && 'prettier', !plugin && '@clarusjs/prettier-plugin'].filter(Boolean).join(', ')})`)
    return undefined
  }
  try {
    const mod = await import(pathToFileURL(prettierEntry).href)
    const prettier = typeof mod.format === 'function' ? mod : mod.default // the CommonJS entry: under default
    log(`clarusjs: formatting with the project's Prettier (${prettierEntry})`)
    return async (text, path) => {
      try {
        const config = (await prettier.resolveConfig(path)) ?? {}
        return await prettier.format(text, { ...config, filepath: path, parser: 'tscl', plugins: [...(config.plugins ?? []), plugin] })
      } catch (err) {
        log(`clarusjs: couldn't format ${path}: ${(err as Error).message}`) // shown in the editor's output, not as an edit
        throw err
      }
    }
  } catch (err) {
    log(`clarusjs: no formatting (the project's prettier couldn't be loaded: ${(err as Error).message})`)
    return undefined
  }
}
