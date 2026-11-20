// Build-time helpers for the Vite plugin: find components, and prerender every route to static HTML.
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'

/** Absolute paths of every `.tscl` file under `srcDir` (empty if it doesn't exist). */
export function findClarusFiles(srcDir: string): string[] {
  let entries: string[]
  try {
    entries = readdirSync(srcDir, { recursive: true }) as string[]
  } catch {
    return []
  }
  return entries.filter((f) => f.endsWith('.tscl')).map((f) => resolve(srcDir, f)).sort()
}

/** '/' → 'index.html', '/about/team' → 'about/team/index.html' */
export function routeToFile(route: string): string {
  const path = route.replace(/^\/+|\/+$/g, '')
  return path ? `${path}/index.html` : 'index.html'
}

/**
 * Call the built handler for every route (or only `only`) and write the HTML into `outDir`. Any failure fails the
 * build. Runs in a fresh Node process so a rebuilt server bundle is never served from a module cache. Returns the
 * routes rendered and those that read the route manifest (readManifest() from `manifestFile`).
 */
export async function prerender(serverEntry: string, outDir: string, manifestFile: string, only?: string[]): Promise<{ routes: string[]; readers: string[] }> {
  const script = `
    import { mkdirSync, writeFileSync } from 'node:fs'
    import { dirname, resolve } from 'node:path'
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
    for (const route of routes) {
      globalThis.__clManifestRead = false
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
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, await response.text())
      if (globalThis.__clManifestRead) readers.push(route)
    }
    process.stdout.write(JSON.stringify({ routes, readers }))
  `
  const args = ['--input-type=module', '-e', script, serverEntry, outDir, ...(only ? [JSON.stringify(only)] : [])]
  const env = { ...process.env, CLARUS_MANIFEST: manifestFile }
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', env })
  if (result.status !== 0) throw new Error(result.stderr.trim() || `prerender failed (exit ${result.status})`)
  return JSON.parse(result.stdout) as { routes: string[]; readers: string[] }
}
