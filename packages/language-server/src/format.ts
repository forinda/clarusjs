// Format Document: the project's own Prettier with @clarusjs/prettier-plugin and the project's Prettier config, so the
// editor formats as `prettier --write` does. Trusted workspaces only (it runs the project's code), and only from the
// folder's own node_modules, as for the compiler. Otherwise, no formatting.
import { createRequire } from 'node:module'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

let empty: string | undefined
/** A `{}` Prettier config file, written once per server. */
const emptyConfig = () => {
  if (!empty) writeFileSync((empty = join(mkdtempSync(join(tmpdir(), 'clarusjs-ls-')), 'prettierrc.json')), '{}')
  return empty
}

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
        // As `prettier --write` run in the folder: its ignore files, .editorconfig, and the config as it is now.
        const info = await prettier.getFileInfo(path, { ignorePath: [join(root, '.gitignore'), join(root, '.prettierignore')], resolveConfig: false })
        if (info?.ignored) return text
        await prettier.clearConfigCache()
        // Only a config inside the trusted folder: Prettier also looks in parent folders, and a config's plugins run.
        const file: string | null = await prettier.resolveConfigFile(path)
        // No config inside it: an empty one in its place, so .editorconfig still applies but no search reaches parents.
        const inside = file && file.startsWith(root + sep) ? file : undefined
        const config = (await prettier.resolveConfig(path, { config: inside ?? emptyConfig(), editorconfig: true })) ?? {}
        // Plugins named in the config, from the config's folder (Prettier would look in the server's working folder);
        // the clarusjs plugin is added from the project either way.
        const from = createRequire(inside ?? join(root, 'package.json'))
        const plugins = ((config.plugins ?? []) as unknown[]).flatMap((p) => {
          if (typeof p !== 'string') return [p]
          if (p.startsWith('.')) return [resolve(dirname(inside!), p)]
          if (p === '@clarusjs/prettier-plugin') return []
          try { return [from.resolve(p)] } catch { return [p] }
        })
        return await prettier.format(text, { ...config, filepath: path, parser: 'tscl', plugins: [...plugins, plugin] })
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
