// Build-time helpers for the Vite plugin: find components, and prerender every route to static HTML.
import { resolveAlias, type Alias } from './aliases.ts'
import { spawnSync } from 'node:child_process'
import { readdirSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { parse } from '../compiler/parse.ts'
import { autoImport, type ComponentNames } from '../compiler/components.ts'

/** Absolute paths of every component file under `srcDir` (`.tscl`, or any page source extension given). */
export function findClarusFiles(srcDir: string, extensions: string[] = ['.tscl']): string[] {
  let entries: string[]
  try {
    entries = readdirSync(srcDir, { recursive: true }) as string[]
  } catch {
    return []
  }
  return entries.filter((f) => extensions.some((ext) => f.endsWith(ext))).map((f) => resolve(srcDir, f)).sort()
}

/**
 * '/' → 'index.html', '/about/team' → 'about/team/index.html', '/users/a%20b' → 'users/a b/index.html'.
 * Segments are decoded because static hosts look files up by the decoded path. A decoded segment can't add a level:
 * entries() values never contain '/' (and a page file's own name has none).
 */
export function routeToFile(route: string): string {
  const path = route.replace(/^\/+|\/+$/g, '').split('/').map((seg) => {
    try { return decodeURIComponent(seg) } catch { return seg } // '100%' is a name, not an escape
  }).join('/')
  // A client page's data file is written as itself, next to the page's shell.
  if (path === '__data.json' || path.endsWith('/__data.json')) return path
  // A page's fragment, likewise.
  if (path === 'index.frag.html' || path.endsWith('/index.frag.html')) return path
  return path ? `${path}/index.html` : 'index.html'
}

/**
 * Call the built handler for every route (or only `only`) and write the HTML into `outDir`. Any failure fails the
 * build. Runs in a fresh Node process so a rebuilt server bundle is never served from a module cache. Returns the
 * routes rendered and those that read the route manifest (readManifest() from `manifestFile`).
 */
export async function prerender(serverEntry: string, outDir: string, manifestFile: string, only?: string[]): Promise<{ routes: string[]; readers: string[]; loaded: string[]; server: { route: string; loader: boolean; cookies?: boolean }[] }> {
  const script = `
    import { mkdirSync, writeFileSync } from 'node:fs'
    import { dirname, resolve, sep } from 'node:path'
    import { pathToFileURL } from 'node:url'
    const routeToFile = ${routeToFile.toString()}
    const [entry, outDir, only] = process.argv.slice(1)
    const { default: handler } = await import(pathToFileURL(entry).href)
    let routes
    try {
      routes = only ? JSON.parse(only) : await handler.paths()
    } catch (err) {
      process.stderr.write('prerender: ' + (err && err.message || err))
      process.exit(1)
    }
    const readers = []
    const loaded = []
    for (const route of routes) {
      globalThis.__clManifestRead = false
      globalThis.__clLoaderRan = false
      let response
      try {
        response = await handler.fetch(new Request('http://localhost' + route))
      } catch (err) {
        process.stderr.write('prerender ' + route + ': ' + (err && err.message || err))
        process.exit(1)
      }
      if (response.status !== 200) {
        process.stderr.write('prerender ' + route + ': status ' + response.status)
        process.exit(1)
      }
      const file = resolve(outDir, routeToFile(route))
      // Whatever a route decodes to, its page must land inside the output folder.
      if (!file.startsWith(resolve(outDir) + sep)) {
        process.stderr.write('prerender ' + route + ': outside the output folder')
        process.exit(1)
      }
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, await response.text())
      if (globalThis.__clManifestRead) readers.push(route)
      if (globalThis.__clLoaderRan) loaded.push(route)
    }
    const server = []
    for (const route of handler.serverRoutes ?? []) server.push({ route, loader: await handler.hasLoader(route), cookies: await handler.readsCookies?.(route) ?? false })
    process.stdout.write(JSON.stringify({ routes, readers, loaded, server }))
  `
  const args = ['--input-type=module', '-e', script, serverEntry, outDir, ...(only ? [JSON.stringify(only)] : [])]
  const env = { ...process.env, CLARUS_MANIFEST: manifestFile }
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', env })
  if (result.status !== 0) throw new Error(result.stderr.trim() || `prerender failed (exit ${result.status})`)
  return JSON.parse(result.stdout) as { routes: string[]; readers: string[]; loaded: string[]; server: { route: string; loader: boolean; cookies?: boolean }[] }
}

/** The package a file belongs to, from its last node_modules segment (pnpm: node_modules/.pnpm/x@1/node_modules/x/…). @internal */
export function packageOf(file: string): string | undefined {
  return /.*[\\/]node_modules[\\/]((?:@[^\\/]+[\\/])?[^\\/]+)[\\/]/.exec(file)?.[1]!.replace(/\\/g, '/')
}

/**
 * Component files reachable from `start` through @import lines (and tags `names` imports automatically): relative paths, root-relative ('/src/…') and package
 * specifiers ('@clarusjs/theme-docs/layout.tscl', resolved as Node would from the app). Real paths, so a workspace
 * package linked into node_modules is one file, not two.
 */
export function reachableComponents(root: string, start: string[], read: (file: string) => string, extensions: string[], aliases: Alias[] = [], names?: ComponentNames): string[] {
  const require = createRequire(resolve(root, 'package.json'))
  const seen = new Set<string>()
  const queue = start.map((f) => realpathSync(f))
  while (queue.length) {
    const file = queue.shift()!
    if (seen.has(file)) continue
    seen.add(file)
    let imports: { from: string }[]
    // With the automatic imports (#458, libraries too): a component used only by its tag is reachable as well.
    try {
      const text = read(file)
      const parsed = parse(text, file)
      if (names) autoImport(parsed, names, file, text)
      imports = parsed.imports
    } catch { continue } // compile errors are reported elsewhere
    for (const { from } of imports) {
      const spec = from.replace(/\?.*$/, '')
      if (!extensions.some((e) => spec.endsWith(e))) continue
      let target: string
      try {
        target = spec.startsWith('.') ? resolve(dirname(file), spec) : spec.startsWith('/') ? resolve(root, spec.slice(1)) : resolveAlias(spec, aliases) ?? require.resolve(spec)
        target = realpathSync(target)
      } catch { continue } // an unresolvable import is reported when the component compiles
      if (!seen.has(target)) queue.push(target)
    }
  }
  return [...seen]
}
