// Component libraries: auto-imports from installed packages. The app lists them (`components.libraries`), each describes
// itself in its package.json (`"clarusjs": { "components": "./src", "prefix": "ui" }`). The plugin and `clarusjs check`
// resolve the names and write them to .clarusjs/components.json, which the editor reads (it doesn't run the Vite config).
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, relative, resolve, sep } from 'node:path'
import { COMPONENT_DIRS, componentIndex, libraryNames, withLibraries, type ComponentNames, type Library } from '../compiler/components.ts'
import { findClarusFiles } from './build.ts'

/**
 * A library the app uses: its package name, or the name with the tag prefix the app wants instead of the library's.
 * @since 0.16.0
 * @see https://clarusjs.com/guide/components#components-from-libraries
 */
export type LibraryOption = string | { from: string; prefix?: string }

const posix = (path: string) => path.split(sep).join('/')

/** The installed package's folder, found as Node does: node_modules in the root and each folder above it. */
function packageDir(root: string, name: string): string | undefined {
  for (let dir = resolve(root); ; dir = dirname(dir)) {
    const candidate = resolve(dir, 'node_modules', name)
    if (existsSync(resolve(candidate, 'package.json'))) return candidate
    if (dirname(dir) === dir) return undefined
  }
}

/** Each listed library, resolved: its components folder's `.tscl` files and its prefix. */
export function resolveLibraries(root: string, list: LibraryOption[]): Library[] {
  return list.map((option) => {
    const name = typeof option === 'string' ? option : option.from
    const dir = packageDir(root, name)
    if (!dir) throw new Error(`[clarusjs] the component library "${name}" isn't installed: add it to your dependencies, or remove it from components.libraries`)
    const meta = (JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8')) as { clarusjs?: { components?: string; prefix?: string } }).clarusjs
    if (typeof meta?.components !== 'string') {
      throw new Error(`[clarusjs] "${name}" doesn't describe its components: its package.json needs "clarusjs": { "components": "./src", "prefix": "ui" }`)
    }
    const base = resolve(dir, meta.components)
    const files = findClarusFiles(base, ['.tscl']).map((f) => posix(relative(base, f))).sort()
    const prefix = typeof option === 'object' && option.prefix !== undefined ? option.prefix : (meta.prefix ?? '')
    if (prefix && !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(prefix)) throw new Error(`[clarusjs] the prefix "${prefix}" of "${name}" isn't kebab-case (lowercase letters, digits and hyphens): its tags couldn't be named`)
    // Each is imported as <package>/<file>: the package's exports must map that to the file found here. The build,
    // the dev server and check follow it with Node's resolver (its "require", "node" and "default" conditions), so
    // this checks it the same way: an "import"-only target isn't followed.
    const require = createRequire(resolve(root, 'package.json'))
    for (const file of files) {
      const spec = `${name}/${file}`
      let found: string | undefined
      try { found = realpathSync(require.resolve(spec)) } catch {}
      if (found !== realpathSync(resolve(base, file))) {
        throw new Error(`[clarusjs] "${spec}" doesn't resolve to ${posix(relative(root, resolve(base, file)))}: the library's package.json exports must map its components with a plain path or a "default" condition, not "import" alone, for example "exports": { "./*": "${meta.components.replace(/\/?$/, '/')}*" }`)
      }
    }
    return { name, prefix, files }
  })
}

/**
 * Every component name the app's templates may use without an @import: its own (`dirs`), then its libraries'. The
 * folders and the libraries' names, none shadowed, go to .clarusjs/components.json for the editor, which lays the
 * app's own (read live) over them; none when automatic imports are off. Undefined then.
 */
export function componentNames(root: string, options: { dirs?: string[]; auto?: boolean; libraries?: LibraryOption[] } = {}): ComponentNames | undefined {
  const dirs = options.auto === false ? [] : (options.dirs ?? COMPONENT_DIRS)
  const own = componentIndex(findClarusFiles(resolve(root, 'src'), ['.tscl']).map((f) => posix(relative(root, f))), dirs).names
  const libraries = options.auto === false ? {} : libraryNames(resolveLibraries(root, options.libraries ?? []))
  const file = resolve(root, '.clarusjs/components.json')
  const text = `${JSON.stringify({ dirs, names: libraries }, null, 2)}\n`
  if (!existsSync(file) || readFileSync(file, 'utf8') !== text) {
    mkdirSync(dirname(file), { recursive: true })
    // Whole or not at all: the editor may read it while this writes.
    const temp = `${file}.${process.pid}.tmp`
    writeFileSync(temp, text)
    renameSync(temp, file)
  }
  return options.auto === false ? undefined : withLibraries(own, libraries)
}

/**
 * The folders and libraries' names the plugin or `clarusjs check` last wrote for this app, if either has run. Written by a tool,
 * but it may be stale or hand-edited: an entry that isn't a path (or several) is dropped, the rest kept.
 */
export function readComponents(root: string): { dirs?: string[]; names: ComponentNames } | undefined {
  let written: { dirs?: unknown; names?: unknown }
  try { written = JSON.parse(readFileSync(resolve(root, '.clarusjs/components.json'), 'utf8')) as typeof written } catch { return undefined }
  if (!written?.names || typeof written.names !== 'object') return undefined
  const path = (v: unknown) => typeof v === 'string' || (Array.isArray(v) && v.length > 0 && v.every((p) => typeof p === 'string'))
  const names = Object.fromEntries(Object.entries(written.names).filter(([, v]) => path(v))) as ComponentNames
  const dirs = Array.isArray(written.dirs) && written.dirs.every((d) => typeof d === 'string') ? (written.dirs as string[]) : undefined
  return dirs ? { dirs, names } : { names }
}

/** The libraries' names the plugin or `clarusjs check` last wrote for this app, if either has run. */
export function readComponentNames(root: string): ComponentNames | undefined {
  return readComponents(root)?.names
}
