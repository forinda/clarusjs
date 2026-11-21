// themeDocs(): the Vite plugin that reads src/pages for the sidebar, in Node, and serves the result as
// `virtual:theme-docs/pages`, so the sidebar data (not the files) reaches pages rendered in the browser too.
// Plain JavaScript: vite.config loads it from node_modules, where Node doesn't strip types. Types: vite.d.ts.
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ID = 'virtual:theme-docs/pages'

/** @param {{ pages?: string }} [options] */
export function themeDocs(options = {}) {
  let dir = resolve(options.pages ?? 'src/pages')
  return {
    name: 'clarusjs:theme-docs',
    /** @param {{ root: string }} config */
    configResolved(config) {
      dir = resolve(config.root, options.pages ?? 'src/pages')
    },
    /** @param {string} id */
    resolveId(id) {
      return id === ID ? '\0' + ID : undefined
    },
    /** @param {string} id */
    load(id) {
      return id === '\0' + ID ? `export default ${JSON.stringify(readPages(dir))}\n` : undefined
    },
    // A page added, removed or edited in dev: the sidebar is read again.
    /** @param {any} server */
    configureServer(server) {
      server.watcher.on('all', (/** @type {string} */ _event, /** @type {string} */ file) => {
        if (!file.startsWith(dir) || !/\.(md|tscl)$/.test(file)) return
        for (const env of Object.values(server.environments)) {
          const mod = env.moduleGraph.getModuleById('\0' + ID)
          if (mod) env.reloadModule(mod)
        }
      })
    },
  }
}

/**
 * Every page under `dir` with its sidebar entry: frontmatter `title` (else the first `# ` heading, or a .tscl page's
 * `[title]="'…'"`, else the file name), `group` (else the subfolder inside its section), `order`. Left out:
 * `sidebar: false`, dynamic routes (`[step]`) and files or folders starting with `_`.
 * @param {string} dir
 * @returns {import('./nav.ts').PageInfo[]}
 */
export function readPages(dir) {
  /** @type {string[]} */
  let files
  try {
    files = readdirSync(dir, { recursive: true, encoding: 'utf8' })
  } catch {
    return []
  }
  /** @type {import('./nav.ts').PageInfo[]} */
  const pages = []
  for (const file of files.map((f) => f.replaceAll('\\', '/')).sort()) {
    const m = /^(.+)\.(md|tscl)$/.exec(file)
    if (!m || m[1].split('/').some((part) => /^[[_]/.test(part))) continue
    const text = readFileSync(join(dir, file), 'utf8')
    const data = m[2] === 'md' ? frontmatter(text) : {}
    if (data.sidebar === 'false') continue
    const parts = m[1].split('/')
    const href = ('/' + m[1]).replace(/\/index$/, '') || '/'
    /** @type {import('./nav.ts').PageInfo} */
    const page = { href, title: data.title ?? /^# (.+)$/m.exec(text)?.[1]?.trim() ?? /\[title\]="'([^']*)'"/.exec(text)?.[1] ?? words(parts.at(-1) ?? '') }
    const group = data.group ?? (parts.length > 2 ? words(parts[1]) : undefined)
    if (group) page.group = group
    if (data.order !== undefined && Number.isFinite(Number(data.order))) page.order = Number(data.order)
    pages.push(page)
  }
  return pages
}

// ponytail: flat `key: value` lines only (all the sidebar needs); the page itself is compiled with a real YAML parser.
/** @param {string} text @returns {Record<string, string>} */
function frontmatter(text) {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? ''
  /** @type {Record<string, string>} */
  const data = {}
  for (const line of block.split(/\r?\n/)) {
    const m = /^(\w+):\s*(.*?)\s*$/.exec(line)
    if (!m) continue
    const v = m[2]
    try {
      data[m[1]] = v.startsWith('"') ? JSON.parse(v) : v.replace(/^'(.*)'$/, '$1')
    } catch {
      data[m[1]] = v
    }
  }
  return data
}

/** @param {string} name */
const words = (name) => name.replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
