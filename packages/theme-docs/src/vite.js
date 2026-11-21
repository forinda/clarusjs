// themeDocs(): the Vite plugin that reads src/pages for the sidebar, in Node, and serves the result as
// `virtual:theme-docs/pages`, so the sidebar data (not the files) reaches pages rendered in the browser too.
// Plain JavaScript: vite.config loads it from node_modules, where Node doesn't strip types. Types are the JSDoc here;
// vite.d.ts is generated from it (pnpm types; typecheck and prepack run it).
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gitDates } from 'clarusjs/vite'
import { CHUNK, termFile, tokens } from './search.js'

const ID = 'virtual:theme-docs/pages'

/**
 * @typedef {object} Options
 * @property {string} [pages] the pages folder, from the Vite root (default src/pages)
 * @property {boolean} [search] false: no search index (it's written to the client output's search/ after the build)
 */

/**
 * Reads the pages for the sidebar (served as `virtual:theme-docs/pages`) and writes the search index after the build.
 * @param {Options} [options]
 * @returns {import('vite').Plugin}
 */
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
    // After clarusjs has prerendered the site: the search index, from the built pages.
    buildApp: {
      order: 'post',
      /** @param {any} builder */
      async handler(builder) {
        if (options.search === false) return
        const out = resolve(builder.config.root, builder.environments.client.config.build.outDir)
        const base = builder.config.base.replace(/\/$/, '')
        /** @type {import('./search.js').Section[]} */
        const sections = []
        for (const file of readdirSync(out, { recursive: true, encoding: 'utf8' }).map((f) => f.replaceAll('\\', '/')).sort()) {
          if (!file.endsWith('.html') || file.endsWith('.frag.html') || /^404(\/index)?\.html$/.test(file)) continue
          const url = base + ('/' + file.replace(/\.html$/, '')).replace(/\/index$/, '') || '/'
          sections.push(...sectionsOf(readFileSync(join(out, file), 'utf8'), url || '/'))
        }
        rmSync(join(out, 'search'), { recursive: true, force: true })
        mkdirSync(join(out, 'search'), { recursive: true })
        for (const [name, json] of buildIndex(sections)) writeFileSync(join(out, 'search', name), json)
      },
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
 * Every page under `dir` with its source `file`, its last commit time (`updated`, from one `git log`) and its sidebar
 * entry: frontmatter `title` (else the first `# ` heading, or a .tscl page's `[title]="'…'"`, else the file name),
 * `group` (else the subfolder inside its section), `order`. `hidden` (not in the sidebar): `sidebar: false` and
 * dynamic routes (`[step]`). Files or folders starting with `_` aren't pages.
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
  const dates = gitDates(dir, '.')
  /** @type {import('./nav.ts').PageInfo[]} */
  const pages = []
  for (const file of files.map((f) => f.replaceAll('\\', '/')).sort()) {
    const m = /^(.+)\.(md|tscl)$/.exec(file)
    if (!m || m[1].split('/').some((part) => part.startsWith('_'))) continue
    const text = readFileSync(join(dir, file), 'utf8')
    const data = m[2] === 'md' ? frontmatter(text) : {}
    const parts = m[1].split('/')
    const href = ('/' + m[1]).replace(/\/index$/, '') || '/'
    /** @type {import('./nav.ts').PageInfo} */
    const page = { href, title: data.title ?? /^# (.+)$/m.exec(text)?.[1]?.trim() ?? /\[title\]="'([^']*)'"/.exec(text)?.[1] ?? words(parts.at(-1) ?? ''), file }
    const group = data.group ?? (parts.length > 2 ? words(parts[1]) : undefined)
    if (group) page.group = group
    if (data.order !== undefined && Number.isFinite(Number(data.order))) page.order = Number(data.order)
    const updated = dates.get(resolve(dir, file))
    if (updated !== undefined) page.updated = updated
    if (data.sidebar === 'false' || parts.some((part) => part.startsWith('['))) page.hidden = true
    pages.push(page)
  }
  return pages
}

const BLOCK = /^<\/?(p|div|li|ul|ol|h\d|br|tr|td|th|table|pre|blockquote|section|aside|details|summary|dl|dt|dd|figure|figcaption|hr)\b/i
const ENTITIES = /** @type {Record<string, string>} */ ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' })
/** @param {string} html */
const plain = (html) => html.replace(/<[^>]*>/g, (tag) => (BLOCK.test(tag) ? ' ' : ''))
  .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (all, e) => e[0] !== '#' ? ENTITIES[e.toLowerCase()] ?? all : String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))))
  .replace(/\s+/g, ' ').trim()

/**
 * A built page's search sections: its main content (main#content, without the theme's crumb, inline contents and
 * footer) split at each h1-h3 with an id. None for pages without one, noindex pages and pages with
 * data-search="false" in their content.
 * ponytail: regular expressions over our own prerendered HTML, not an HTML parser; enough for what the theme emits.
 * @param {string} html
 * @param {string} url
 * @returns {import('./search.js').Section[]}
 */
export function sectionsOf(html, url) {
  if (/<meta\b(?=[^>]*\bname=["']?robots\b)(?=[^>]*noindex)[^>]*>/i.test(html)) return []
  const main = /<main\b[^>]*\bid="content"[^>]*>([\s\S]*)<\/main>/i.exec(html)?.[1]
  if (main === undefined || /\bdata-search="false"/.test(main)) return []
  const body = main.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<p class="crumb">[\s\S]*?<\/p>/, '')
    .replace(/<details class="toc-inline">[\s\S]*?<\/details>/, '')
    .replace(/<footer class="page-footer">[\s\S]*?<\/footer>/, '')
    .replace(/<a class="header-anchor"[\s\S]*?<\/a>/g, '')
  const parts = body.split(/(<h[1-3]\b[^>]*\bid="[^"]*"[^>]*>[\s\S]*?<\/h[1-3]>)/i)
  const page = plain(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(body)?.[1] ?? /<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '')
  /** @type {import('./search.js').Section[]} */
  const sections = []
  if (plain(parts[0])) sections.push({ u: url, p: page, h: page, t: plain(parts[0]) })
  for (let i = 1; i < parts.length; i += 2) {
    const [, level, id] = /** @type {RegExpExecArray} */ (/<h([1-3])\b[^>]*\bid="([^"]*)"/i.exec(parts[i]))
    sections.push({ u: level === '1' ? url : `${url}#${id}`, p: page, h: plain(parts[i]), t: plain(parts[i + 1] ?? '') })
  }
  return sections
}

/**
 * The index files for some sections (name to JSON): words sharded by their first two letters, sections in chunks
 * of CHUNK, their text cut to 240 characters (the words are indexed in full).
 * @param {import('./search.js').Section[]} sections
 * @returns {Map<string, string>}
 */
export function buildIndex(sections) {
  /** @type {Map<string, Record<string, number[]>>} */
  const shards = new Map()
  for (const [id, section] of sections.entries()) {
    /** @type {Map<string, number>} */
    const weights = new Map()
    /** @type {Map<string, number>} */
    const uses = new Map()
    for (const word of tokens(section.t)) uses.set(word, (uses.get(word) ?? 0) + 1)
    // In the text a word counts at most 3 times: a long page repeating it doesn't outrank a heading.
    for (const [word, n] of uses) weights.set(word, Math.min(n, 3))
    for (const word of tokens(section.h)) weights.set(word, (weights.get(word) ?? 0) + 10)
    for (const [word, weight] of weights) {
      const shard = shards.get(termFile(word)) ?? shards.set(termFile(word), {}).get(termFile(word))
      ;(/** @type {Record<string, number[]>} */ (shard)[word] ??= []).push(id, weight)
    }
  }
  /** @type {Map<string, string>} */
  const files = new Map([...shards].map(([name, terms]) => [name, JSON.stringify(terms)]))
  for (let n = 0; n * CHUNK < sections.length; n++) {
    const chunk = sections.slice(n * CHUNK, (n + 1) * CHUNK).map((s) => ({ ...s, t: s.t.length > 240 ? s.t.slice(0, 239) + '…' : s.t }))
    files.set(`s-${n}.json`, JSON.stringify(chunk))
  }
  return files
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
    // A quoted value ends at its closing quote; otherwise a ` #` starts a comment.
    const double = /^"((?:[^"\\]|\\.)*)"/.exec(m[2])
    const single = /^'((?:[^']|'')*)'/.exec(m[2])
    if (double) {
      try { data[m[1]] = JSON.parse(double[0]) } catch { data[m[1]] = double[1] }
    } else if (single) data[m[1]] = single[1].replaceAll("''", "'")
    else data[m[1]] = m[2].replace(/\s+#.*$/, '')
  }
  return data
}

/** @param {string} name */
const words = (name) => name.replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
