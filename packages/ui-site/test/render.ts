// Renders a registry component on the server, as a test sees it: the HTML without what clarusjs adds for itself.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { compile } from 'clarusjs/compiler'
import { resolveIcon } from 'clarusjs/icons'

export const registryDir = resolve(import.meta.dirname, '../src/registry')
export const source = (file: string) => readFileSync(resolve(registryDir, file), 'utf8')

const clarus = (path: string) => pathToFileURL(resolve(import.meta.dirname, '../node_modules/clarusjs/src', path)).href
/** Scope classes, island wrappers, markers and whitespace between tags taken out. */
export const unscoped = (html: string) => html.replace(/ class="cl-c-[\w-]+"/g, '').replace(/ cl-c-[\w-]+(?=[" ])/g, '')
  .replace(/<\/?cl-island[^>]*>/g, '').replace(/<!--[^>]*-->/g, '').replace(/ data-cl-[\w-]+="[^"]*"/g, '')
  .replace(/>\s+/g, '>').replace(/\s+</g, '<')

/** opts carries what a parent tag passes besides props, e.g. { class: 'mine' }. */
export async function render(file: string, props: Record<string, unknown> = {}, slots?: Record<string, string>, opts?: Record<string, unknown>): Promise<string> {
  const path = resolve(registryDir, file)
  const { code } = compile(source(file), { file, target: 'server', clientUrl: '/x.js', collapseWhitespace: true, icon: (name) => resolveIcon(name, path) })
  // A component's own imports ('./chart-geometry.ts') resolve beside it: a data: URL has no folder of its own.
  const local = code.replace(/(from\s+)'\.\/([\w.-]+)'/g, (_, from, name) => `${from}'${pathToFileURL(resolve(registryDir, name)).href}'`)
  const mod = await import(`data:text/javascript,${encodeURIComponent(local.replaceAll("'clarusjs/runtime/server'", `'${clarus('runtime/server.ts')}'`))}`)
  return unscoped(await mod.render(props, slots, opts))
}
