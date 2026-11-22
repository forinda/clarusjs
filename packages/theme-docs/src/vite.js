// themeDocs(): the Vite plugin that reads src/pages for the sidebar, in Node, and serves the result as
// `virtual:theme-docs/pages`, so the sidebar data (not the files) reaches pages rendered in the browser too.
// Plain JavaScript: vite.config loads it from node_modules, where Node doesn't strip types. Types are the JSDoc here;
// vite.d.ts is generated from it (pnpm types; typecheck and prepack run it).
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'clarusjs/compiler'
import { gitDates } from 'clarusjs/vite'
import { CHUNK, termFile, tokens } from './search.js'

const ID = 'virtual:theme-docs/pages'

/**
 * @typedef {object} Options
 * @property {string} [pages] the pages folder, from the Vite root (default src/pages)
 * @property {boolean} [search] false: no search index (it's written to the client output's search/ after the build)
 * @property {LlmsOptions} [llms] write llms.txt and llms-full.txt to the client output after the build (llmstxt.org)
 * @property {Partial<Record<PartName, string>>} [components] parts of the layout replaced by files of the site's own, from
 *   the Vite root: `{ header: '/src/theme/header.tscl' }`. Each gets the inputs and slots the theme's part gets.
 */

/** @typedef {'header' | 'sidebar' | 'contents' | 'pageFooter' | 'footer'} PartName */

/**
 * @typedef {object} LlmsOptions
 * @property {string} title the site's name, the file's heading
 * @property {string} [summary] one or two sentences about the site
 * @property {string} [site] the public address (https://example.com): links are absolute with it, root-relative without
 */

/** The layout's replaceable parts (#361) and their files in src/parts/. */
const PARTS = { header: 'header.tscl', sidebar: 'sidebar.tscl', contents: 'contents.tscl', pageFooter: 'page-footer.tscl', footer: 'footer.tscl' }
const PARTS_DIR = fileURLToPath(new URL('./parts/', import.meta.url))
const real = (/** @type {string} */ p) => { try { return realpathSync(p) } catch { return p } }

/**
 * A .tscl file's inputs (name, and whether it has a default) and slot names ('default' for the unnamed one).
 * @param {string} file
 */
function contractOf(file) {
  const parsed = parse(readFileSync(file, 'utf8'), file)
  /** @type {Set<string>} */
  const slots = new Set()
  /** @param {any[]} nodes */
  const walk = (nodes) => {
    for (const n of nodes) {
      if (n.type === 'element' && n.tag === 'slot') {
        const name = n.attrs.find((/** @type {any} */ a) => a.name === 'name' && a.kind === 'static')
        slots.add(name ? String(name.value) : 'default')
      }
      for (const key of ['children', 'empty']) if (Array.isArray(n[key])) walk(n[key])
      if (n.type === 'if') for (const b of n.branches) walk(b.children)
    }
  }
  walk(parsed.nodes)
  return { inputs: parsed.inputs.map((i) => ({ name: i.name, required: i.default === undefined })), slots }
}

/**
 * The site's replacements for the layout's parts, as absolute paths by part file, checked against the parts they
 * replace: every part named exists, every file exists, a replacement needs no input the layout doesn't pass, and has
 * every slot the layout fills.
 * @param {Partial<Record<string, string>>} components
 * @param {string} root
 * @returns {Map<string, string>}
 */
function overridesOf(components, root) {
  /** @type {Map<string, string>} */
  const out = new Map()
  for (const [key, path] of Object.entries(components)) {
    const part = /** @type {Record<string, string>} */ (PARTS)[key]
    if (!part) throw new Error(`themeDocs: components.${key} isn't a part of the theme; the parts are ${Object.keys(PARTS).join(', ')}`)
    if (!path) continue
    const file = resolve(root, path.startsWith('/') ? '.' + path : path)
    if (!existsSync(file)) throw new Error(`themeDocs: components.${key}: no file at ${path}`)
    // clarusjs finds components (for their styles and islands) under src/: a part elsewhere would render unstyled.
    if (!real(file).startsWith(real(resolve(root, 'src')) + sep)) throw new Error(`themeDocs: components.${key} (${path}) isn't under src/: move it there, where clarusjs finds components (their styles and islands)`)
    const theirs = contractOf(join(PARTS_DIR, part))
    const mine = contractOf(file)
    const passed = new Set(theirs.inputs.map((i) => i.name))
    for (const i of mine.inputs) {
      if (i.required && !passed.has(i.name)) throw new Error(`themeDocs: components.${key} (${path}) requires @input ${i.name}, which the layout never passes: give it a default, or remove it`)
    }
    for (const slot of theirs.slots) {
      if (!mine.slots.has(slot)) throw new Error(`themeDocs: components.${key} (${path}) has no ${slot === 'default' ? '<slot />' : `<slot name="${slot}">`}, which the layout fills`)
    }
    out.set(real(join(PARTS_DIR, part)), file)
  }
  return out
}

/**
 * Reads the pages for the sidebar (served as `virtual:theme-docs/pages`) and writes the search index after the build.
 * @param {Options} [options]
 * @returns {import('vite').Plugin}
 */
export function themeDocs(options = {}) {
  let dir = resolve(options.pages ?? 'src/pages')
  /** @type {Map<string, string>} */
  let overrides = new Map()
  return {
    name: 'clarusjs:theme-docs',
    // Before Vite resolves the layout's relative import of a part itself.
    enforce: 'pre',
    /** @param {{ root: string }} config */
    configResolved(config) {
      dir = resolve(config.root, options.pages ?? 'src/pages')
      overrides = overridesOf(options.components ?? {}, config.root)
    },
    /**
     * @param {string} id
     * @param {string} [importer]
     */
    resolveId(id, importer) {
      if (id === ID) return '\0' + ID
      // The layout's import of a part the site replaced (./parts/x.tscl from the theme): the site's file.
      // The query (?render: the layout rendered in the browser) stays on the site's file.
      if (overrides.size && importer && id.startsWith('./parts/')) {
        const [path, query] = id.split('?', 2)
        const file = overrides.get(real(resolve(dirname(importer.replace(/\?.*$/, '')), /** @type {string} */ (path))))
        if (file) return query === undefined ? file : `${file}?${query}`
      }
      return undefined
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
        const out = resolve(builder.config.root, builder.environments.client.config.build.outDir)
        if (options.llms) {
          const base = builder.config.base.replace(/\/$/, '')
          // A template page's text: its built page, as the search index reads it.
          /** @param {string} href */
          const textOf = (href) => {
            const file = join(out, href === '/' ? 'index.html' : href.slice(1) + '/index.html')
            let html = ''
            try { html = readFileSync(file, 'utf8') } catch { return '' }
            return sectionsOf(html, base + href).map((x) => [x.h, x.t].filter(Boolean).join('\n\n')).join('\n\n')
          }
          writeFileSync(join(out, 'llms.txt'), llmsTxt(dir, options.llms))
          writeFileSync(join(out, 'llms-full.txt'), llmsFull(dir, options.llms, textOf))
        }
        if (options.search === false) return
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
 * An element (its tag, through its closing tag) whose class attribute has `name` as a whole token.
 * @param {string} tag
 * @param {string} name
 */
const withClass = (tag, name) => new RegExp(`<${tag}\\b[^>]*\\bclass="(?:[^"]*\\s)?${name}(?:\\s[^"]*)?"[^>]*>[\\s\\S]*?<\\/${tag}>`)

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
    // By whole class token: the layout's parts carry their scope class too (class="page-footer cl-c-…"), and a class
    // that only starts the same (crumb-note) isn't one of them.
    .replace(withClass('p', 'crumb'), '')
    .replace(withClass('details', 'toc-inline'), '')
    .replace(withClass('footer', 'page-footer'), '')
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

/**
 * The pages llms.txt lists, with their descriptions: those in the sidebar (not hidden, not dynamic, not 404/500), in
 * groups ordered by their lowest page `order` (pages without a group last, as "Other pages").
 * @param {string} dir
 */
function llmsPages(dir) {
  const pages = readPages(dir).filter((p) => !p.hidden && p.href !== '/404' && p.href !== '/500')
  /** @type {Map<string, (import('./nav.ts').PageInfo & { description?: string; text: string })[]>} */
  const groups = new Map()
  for (const p of pages) {
    const text = readFileSync(join(dir, /** @type {string} */ (p.file)), 'utf8')
    const description = /\.md$/.test(p.file ?? '') ? frontmatter(text).description : undefined
    const key = p.group ?? ''
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)?.push({ ...p, ...(description ? { description } : {}), text })
  }
  const rank = (/** @type {string} */ key) => (key === '' ? Infinity : Math.min(...(groups.get(key) ?? []).map((p) => p.order ?? Infinity)))
  return [...groups.keys()].sort((a, b) => rank(a) - rank(b)).map((key) => ({
    title: key || 'Other pages',
    pages: (groups.get(key) ?? []).sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.title.localeCompare(b.title)),
  }))
}

/** @param {LlmsOptions} o */
const llmsHead = (o) => `# ${o.title}\n${o.summary ? `\n> ${o.summary}\n` : ''}`
/** @param {LlmsOptions} o @param {string} href */
const llmsUrl = (o, href) => (o.site ? o.site.replace(/\/$/, '') : '') + href

/**
 * llms.txt (llmstxt.org): the site's title and summary, then each sidebar group's pages as links with their
 * descriptions.
 * @param {string} dir the pages folder
 * @param {LlmsOptions} options
 * @returns {string}
 */
export function llmsTxt(dir, options) {
  const sections = llmsPages(dir).map(({ title, pages }) =>
    `## ${title}\n\n${pages.map((p) => `- [${p.title}](${llmsUrl(options, p.href)})${p.description ? `: ${p.description}` : ''}`).join('\n')}\n`)
  return [llmsHead(options), ...sections].join('\n')
}

/**
 * llms-full.txt: the same pages' text, one after another. A Markdown page is its Markdown (no frontmatter, no leading
 * component import lines); a template page is what `textOf(href)` gives (its built page's text).
 * @param {string} dir the pages folder
 * @param {LlmsOptions} options
 * @param {(href: string) => string} textOf
 * @returns {string}
 */
export function llmsFull(dir, options, textOf) {
  const parts = [llmsHead(options)]
  for (const { pages } of llmsPages(dir)) {
    for (const p of pages) {
      const body = /\.md$/.test(p.file ?? '')
        ? p.text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').replace(/^(?:[ \t]*(?:@import\b[^\n]*)?\r?\n)+/, '').trim()
        : textOf(p.href).trim()
      parts.push(`---\n\nSource: ${llmsUrl(options, p.href)}\n\n${body}\n`)
    }
  }
  return parts.join('\n')
}
