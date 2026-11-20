// Build-time helpers for the Vite plugin: find components, and prerender every route to static HTML.
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

type Handler = { fetch(request: Request): Promise<Response>; routes: string[] }

/** Absolute paths of every `.clarus` file under `srcDir` (empty if it doesn't exist). */
export function findClarusFiles(srcDir: string): string[] {
  let entries: string[]
  try {
    entries = readdirSync(srcDir, { recursive: true }) as string[]
  } catch {
    return []
  }
  return entries.filter((f) => f.endsWith('.clarus')).map((f) => resolve(srcDir, f)).sort()
}

/** '/' → 'index.html', '/about/team' → 'about/team/index.html' */
export function routeToFile(route: string): string {
  const path = route.replace(/^\/+|\/+$/g, '')
  return path ? `${path}/index.html` : 'index.html'
}

/** Call the built handler for every route and write the HTML into `outDir`. Any failure fails the build. */
export async function prerender(serverEntry: string, outDir: string): Promise<string[]> {
  const { default: handler } = (await import(pathToFileURL(serverEntry).href)) as { default: Handler }
  for (const route of handler.routes) {
    let response: Response
    try {
      response = await handler.fetch(new Request(`http://localhost${route}`))
    } catch (err) {
      throw new Error(`prerender ${route}: ${(err as Error).message}`, { cause: err })
    }
    if (response.status !== 200) throw new Error(`prerender ${route}: status ${response.status}`)
    const file = resolve(outDir, routeToFile(route))
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, await response.text())
  }
  return handler.routes
}
