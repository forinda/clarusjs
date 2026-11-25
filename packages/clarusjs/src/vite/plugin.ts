// The clarusjs Vite plugin: a thin adapter around the compiler.
// Server environment gets render(), client environment gets attach(). Dev requests go through the fetch handler.
import type { IncomingMessage, ServerResponse } from 'node:http'
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, watch as watchFs, writeFileSync } from 'node:fs'
import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'node:zlib'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isRunnableDevEnvironment, normalizePath, type Plugin, type UserConfig } from 'vite'
import { compile, scopeId, ClarusError } from '../compiler/index.ts'
import { parse } from '../compiler/parse.ts'
import { autoImport, COMPONENT_DIRS, componentIndex, type ComponentNames } from '../compiler/components.ts'
import { componentNames, type LibraryOption } from './libraries.ts'
import type { LintConfig, LintRuleDef } from '../compiler/lint.ts'
import { findClarusFiles, packageOf as packageOfFile, prerender, reachableComponents, resolvePackage, routeToFile } from './build.ts'
export { packageOf } from './build.ts'
/** Newest commit time (unix seconds) of every file under a folder, from one `git log` (themes use it for "last updated"). */
export { gitDates } from './sitemap.ts'
import { writeManifest } from './manifest.ts'
import { writeNetlifyFunction } from './netlify.ts'
import { checkLinks } from './links.ts'
import { checkRedirects, redirectFor, writeRedirects } from './redirects.ts'
import { projectAliases, resolveAlias, type Alias } from './aliases.ts'
import { gitDates, sitemapFiles } from './sitemap.ts'
import { checkModes, modeFor, routeMatches, type ModeTable } from '../server/modes.ts'
import { isPageFile, rootLinks, routeFromFile } from '../server/handler.ts'
import { basePath } from '../server/head.ts'
import type { HeadTag, SiteOptions } from '../server/head.ts'
import { acceptsEncoding, sendResponse, toRequest } from './node.ts'
import { resolveIcon } from '../icons.ts'

/** <icon> names, found in the sets installed for the package `file` is in (clarusjs/icons). */
const iconsFor = (file: string) => (name: string) => resolveIcon(name, file)

// From src/ (workspace, tests) our siblings are .ts files; from the published dist/ they are .js.
const ext = import.meta.url.endsWith('.ts') ? '.ts' : '.js'
const here = (path: string) => fileURLToPath(new URL(path + ext, import.meta.url))
const ENTRY = 'virtual:clarusjs/server-entry'

/**
 * Dev URL of a component's client module: root-relative, or Vite's /@fs/ form for files outside the root. Always with
 * forward slashes (`/@fs/C:/libs/c.tscl` on Windows). `path`: the platform's (a parameter for tests). @internal
 */
export function clientUrlFor(root: string, file: string, path: Pick<typeof import('node:path'), 'relative' | 'isAbsolute' | 'sep'> = { relative, isAbsolute, sep }): string {
  const rel = path.relative(root, file)
  const slashes = (p: string) => p.split(path.sep).join('/')
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    const abs = slashes(file)
    return `/@fs${abs.startsWith('/') ? '' : '/'}${abs}?import`
  }
  return `/${slashes(rel)}?import`
}

/** A path as the file system names it (symlinks and Windows short names resolved), or as given if it doesn't exist. */
const real = (path: string) => { try { return realpathSync.native(path) } catch { return path } }

const LOADER_ENTRY = 'cl-loader'
const ROUTER_ENTRY = 'cl-router'
const NAV_ENTRY = 'cl-nav'
const STYLES_ENTRY = 'cl-styles'
// Every component's <style>, generated into one stylesheet (gitignored, like the rest of .clarusjs/).
const STYLES_FILE = '.clarusjs/styles.css'
/** Scope ids come from the path relative to the app root, so server, client and stylesheet always agree. */
const scopeFor = (root: string, file: string) => scopeId(relative(root, file).split(sep).join('/'))

/**
 * Each page's stylesheets (absolute paths), from its own `@import './x.css'` and its components', transitively.
 * Dependencies come first, so a layout's base CSS is linked before what the page adds.
 */
function pageGraph(root: string, files: Files, aliases: Alias[] = []): Map<string, { css: string[]; components: string[] }> {
  const deps = new Map<string, { css: string[]; components: string[] }>()
  const names = files.names(root)
  const read = (file: string) => {
    if (!deps.has(file)) {
      let parsed
      try {
        const text = files.read(file, root)
        parsed = parse(text, file)
        // Components used by their tag (automatic imports, libraries too) are the page's as well.
        if (names) autoImport(parsed, names, file, text)
      } catch { parsed = null } // errors surface on compile
      // Relative to the file, or root-relative ('/src/layouts/docs.tscl', as Vite resolves it).
      const near = (from: string) => {
        const path = from.replace(/\?.*$/, '')
        return path.startsWith('/') ? resolve(root, `.${path}`) : resolve(dirname(file), path)
      }
      // A path alias (~/, tsconfig paths, Vite's resolve.alias), else a package specifier (from this file, then the app).
      const packageFile = (spec: string) => { const found = resolvePackage(root, file, spec); return found && realpathSync(found) }
      const bare = (from: string) => resolveAlias(from.replace(/\?.*$/, ''), aliases) ?? packageFile(from.replace(/\?.*$/, ''))
      deps.set(file, {
        css: parsed?.cssImports.map((c) => (/^[./]/.test(c.from) ? near(c.from) : bare(c.from))).filter((f): f is string => !!f) ?? [],
        // Components in packages too ('@clarusjs/theme-docs/layout.tscl'): their stylesheets are the page's as well.
        components: parsed?.imports.map((imp) => (/^[./]/.test(imp.from) ? near(imp.from) : bare(imp.from))).filter((f): f is string => !!f) ?? [],
      })
    }
    return deps.get(file)!
  }
  const collect = (file: string, out: string[], seen: Set<string>) => {
    if (seen.has(file)) return
    seen.add(file)
    const { css, components } = read(file)
    for (const c of components) if (existsSync(c)) collect(c, out, seen)
    for (const sheet of css) if (!out.includes(sheet)) out.push(sheet)
  }
  const pages = new Map<string, { css: string[]; components: string[] }>()
  for (const file of files.pages(root)) {
    const css: string[] = []
    const seen = new Set<string>()
    collect(file, css, seen)
    seen.delete(file)
    pages.set(routeFromFile(`/${relative(root, file).split(sep).join('/')}`), { css, components: [...seen] })
  }
  return pages
}

/**
 * A page's layouts (#456), outermost first, as root paths: the config layouts whose patterns take its route, then each
 * +layout.tscl from src/pages down to its folder. None for a file that isn't a page.
 */
function layoutsFor(root: string, file: string, config: { layout: string; include?: string[]; exclude?: string[] }[]): string[] | undefined {
  const pages = resolve(root, 'src/pages')
  const rel = relative(pages, file)
  if (rel.startsWith('..') || isAbsolute(rel) || !isPageFile(file.split(sep).join('/'))) return undefined
  const route = routeFromFile(`/src/pages/${rel.split(sep).join('/')}`)
  const out = config
    .filter((l) => (l.include ?? ['/*']).some((p) => routeMatches(route, p)) && !(l.exclude ?? []).some((p) => routeMatches(route, p)))
    .map((l) => l.layout)
  // ponytail: in dev, adding or removing a +layout.tscl reaches pages already compiled only on restart; watch the
  // folders' + files and invalidate the pages under them if that bites.
  const folders = dirname(rel) === '.' ? [] : dirname(rel).split(sep)
  for (let i = 0; i <= folders.length; i++) {
    const layout = resolve(pages, ...folders.slice(0, i), '+layout.tscl')
    if (existsSync(layout)) out.push(`/${relative(root, layout).split(sep).join('/')}`)
  }
  return out
}

/** A component's loader (#97): a .load.ts next to a .tscl outside src/pages (there it's the page's data), or none. */
function componentLoaderOf(root: string, file: string): string | undefined {
  if (!file.endsWith('.tscl') || real(file).startsWith(real(resolve(root, 'src/pages')) + sep)) return undefined
  const loader = file.replace(/\.tscl$/, '.load.ts')
  return existsSync(loader) ? loader : undefined
}

/** Write .clarusjs/styles.css from every component under src/; false when no component has a <style>. */
function writeStyles(root: string, files: Files): boolean {
  let css = ''
  // @reference and @import statements (the compiler puts them first) gather at the top of the file, once each, with
  // relative paths rewritten from the component's folder to .clarusjs/ ("tailwindcss" and URLs stay as written).
  const head = new Set<string>()
  const outDir = resolve(root, '.clarusjs')
  for (const file of files.components(root)) {
    try {
      let out = compile(files.read(file, root), { file, target: 'client', scope: scopeFor(root, file), icon: iconsFor(file), layouts: files.layouts(file, root), components: files.names(root) }).css
      out = out.replace(/^(?:[ \t]*@(?:reference|import)\b[^;{]*;[ \t]*\n?)+/, (statements) => {
        for (const statement of statements.split(';').map((x) => x.trim()).filter(Boolean)) {
          head.add(statement.replace(/(["'])(\.{1,2}\/[^"']*)\1/, (_, q: string, spec: string) => {
            const target = relative(outDir, resolve(file, '..', spec)).split(sep).join('/')
            return q + (target.startsWith('.') ? target : `./${target}`) + q
          }) + ';')
        }
        return ''
      })
      if (out) css += `/* ${relative(root, file).split(sep).join('/')} */\n${out}`
    } catch {} // compile errors are reported when the component itself is compiled
  }
  css = [...head].map((x) => `${x}\n`).join('') + css
  mkdirSync(outDir, { recursive: true })
  writeFileSync(resolve(root, STYLES_FILE), css)
  return css !== ''
}
// Client entry name of a client-mode page's browser render module.
const renderEntry = (name: string) => `render/${name}`
const CLIENT_OUT = 'dist/client'
// Placeholder for a nested island's chunk URL in the client build, replaced once the bundle's file names are known.
const CHUNK_TOKEN = '__CLARUS_CHUNK__'
const SERVER_OUT = 'dist/server'
// Outside the app (a workspace package): each leading ../ becomes _/, so chunk names stay inside dist/.
const entryName = (root: string, file: string) => relative(root, file).split(sep).join('/').replace(/\.[^./\\]+$/, '').replace(/^(\.\.\/)+/, (ups) => '_/'.repeat(ups.length / 3))

/**
 * The Vite plugin's options: when routes render, the deploy adapter, fragment navigation, link checks, head tags, the
 * site's address, sitemap and robots, redirects, and page sources.
 * @see https://clarusjs.com/reference/vite-plugin#clarusjs
 */
export type ClarusOptions = {
  /** When each route renders: { '/account/*': 'server' }. Routes default to 'static' (prerendered at build). */
  routes?: ModeTable
  /**
   * Layouts by route (#456), outermost first, around the folder layouts (`+layout.tscl`): `{ layout: '/src/layouts/site.tscl',
   * include: ['/*'], exclude: ['/embed/*'] }` (patterns as in `routes`; include defaults to every route). A page with
   * `@layout none` gets none.
   */
  layouts?: { layout: string; include?: string[]; exclude?: string[] }[]
  /**
   * Automatic component imports (#458): a kebab-case file under these folders is used by its name, without @import
   * (`src/components/forms/text-field.tscl` → `<forms-text-field>`, or `<text-field>` when no other has that name).
   * Defaults: `{ dirs: ['src/components', 'src/layouts'], auto: true }`. `libraries`: installed component libraries whose
   * components are used the same way (`libraries: ['@clarusjs/ui-primitives']` → `<ui-dialog>`), each described by its
   * package.json; your own components win over theirs.
   */
  components?: { dirs?: string[]; auto?: boolean; libraries?: LibraryOption[] }
  /** Where server routes deploy. 'netlify': a Netlify Function (Frameworks API) next to the static files. */
  adapter?: 'netlify'
  /** Fragment navigation: each static and server page also answers at <path>/index.frag.html. */
  fragments?: boolean
  /** Page sources for other file types, such as Markdown from @clarusjs/content: `sources: [markdown()]`. */
  sources?: Source[]
  /**
   * Build-time link checking, after every page is built. `pages`: links to pages or files that don't exist (default
   * 'error'). `anchors`: links to a #id the target page doesn't have (default 'warn'). `strict`: warnings fail too.
   */
  links?: { pages?: LinkLevel; anchors?: LinkLevel; strict?: boolean }
  /**
   * Template lint levels for `clarusjs check`: `{ 'img-alt': 'off', 'accessible-name': 'error' }`. Rules warn by default.
   * @see https://clarusjs.com/guide/lint
   */
  lint?: LintConfig
  /**
   * The project's own lint rules, run by `clarusjs check` beside the built-in ones.
   * @see https://clarusjs.com/guide/lint#writing-a-rule
   */
  lintRules?: LintRuleDef[]
  /**
   * Paths that moved: `{ '/old': '/new' }` (a site path or a full URL). The build writes a page at each old path that
   * sends visitors on, and `_redirects` lines (a real 301 on Netlify and Cloudflare Pages); dev answers 301.
   * @see https://clarusjs.com/guide/routing
   */
  redirects?: Record<string, string>
  /**
   * Every page's <head>: `titleTemplate` ('%s · Site') wraps the document title, `tags` are added unless the page has
   * its own with the same key. Anything else: export `transformHead(head, page)` from src/head.ts.
   */
  head?: { titleTemplate?: string; tags?: HeadTag[]; jsonLd?: object | object[] }
  /**
   * The site's public address. Every page gets a canonical URL and social cards (Open Graph, Twitter) from its title,
   * description and an image (the page's og:image, or `image`); absolute links to the site are link-checked.
   */
  site?: SiteOptions
  /**
   * With site.url, vite build writes sitemap.xml (static pages, dated from git). false: no sitemap. `exclude`: paths
   * left out ('/legal', '/tags/*' one segment, '/drafts/**' any depth). A page opts out itself with
   * <cl-head><meta name="sitemap" content="false"></cl-head> (removed from the built page) or noindex, and sets its
   * own date with <meta name="sitemap:lastmod" content="2026-11-01">. Each page's images (not alt="", not data:) are
   * listed with Google's image extension; `images: false` leaves them out. `include`: paths the build can't list (server
   * and client routes), or a function returning them (async, to read them from a database at build time).
   */
  sitemap?: boolean | { exclude?: string[]; images?: boolean; include?: string[] | (() => string[] | Promise<string[]>) }
  /** With site.url, vite build writes robots.txt (allow all, and the sitemap), unless public/robots.txt exists. */
  robots?: boolean
  /** Collapse whitespace in template text at build (default true). */
  collapseWhitespace?: boolean
  /** At build, write .br and .gz next to dist/client's text files, for servers that serve them as is. Default false. */
  compress?: boolean
}
export type { HeadTag }
/**
 * How a build reports a broken link: fail (`'error'`), print a warning, or skip the check.
 * @see https://clarusjs.com/reference/vite-plugin#links
 */
export type LinkLevel = 'error' | 'warn' | 'off'

/**
 * A page source: files with another extension (such as Markdown) turned into .tscl text, then compiled like any
 * page. `route` is the page's route when the file is under src/pages.
 * @see https://clarusjs.com/reference/vite-plugin#page-sources
 */
export type Source = { extension: string; toTscl(code: string, file: string, context: SourceContext): string }
/** @see https://clarusjs.com/reference/vite-plugin#page-sources
 * `root`: the app root. `addDependency(file)`: another file the output depends on (rebuilt when it changes in dev). */
export type SourceContext = { route: string; root: string; addDependency(file: string): void }

/** How the plugin finds and reads component files: .tscl, plus the extensions of its page sources. */
type Files = {
  find(dir: string): string[]
  /** The page files under src/pages: not the + files (layouts). */
  pages(root: string): string[]
  /** A page's folder and config layouts (#456), for compile(); undefined for other files. */
  layouts(file: string, root: string): string[] | undefined
  /** The automatic component names (#458), for compile(); undefined when off. */
  names(root: string): ComponentNames | undefined
  read(file: string, root: string): string
  /** Every component of the app: those under src/, and every .tscl their @imports reach, in packages too. */
  components(root: string): string[]
}


/** Client-mode pages: route (as the file names it) → absolute file. */
function clientPages(appRoot: string, modes: ModeTable, files: Files): Map<string, string> {
  const pages = new Map<string, string>()
  for (const file of files.pages(appRoot)) {
    const route = routeFromFile(`/${relative(appRoot, file).split(sep).join('/')}`)
    if (modeFor(route, modes) === 'client') pages.set(route, file)
  }
  return pages
}

/** An attribute of a built <meta> or <link> in any valid form: "x", 'x' or unquoted (transformHead output isn't normalized). */
function metaAttr(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag)?.slice(1).find((v) => v !== undefined)
}

/**
 * A sitemap lastmod's time (ms), or NaN: a calendar date (2026-02-30 isn't one, though Date.parse rolls it over to
 * March 2), optionally with a time and a zone, as sitemaps allow.
 */
function lastmodTime(value: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?$/.exec(value)
  if (!m) return NaN
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const day = new Date(Date.UTC(y, mo - 1, d))
  if (day.getUTCFullYear() !== y || day.getUTCMonth() !== mo - 1 || day.getUTCDate() !== d) return NaN
  return Date.parse(m[4] ? value : `${value}T00:00:00Z`)
}

/** Vite's plugins option, flattened: nested arrays followed, falsy entries and promises (not resolved yet) left out. */
function pluginsOf(list: unknown): Plugin[] {
  if (Array.isArray(list)) return list.flatMap(pluginsOf)
  return list && typeof list === 'object' && !(list instanceof Promise) ? [list as Plugin] : []
}

/**
 * The clarusjs Vite plugin: compiles `.tscl` files, serves pages in development, and on `vite build` builds the
 * browser code, the server and the prerendered pages.
 * @example
 * ```ts
 * // vite.config.ts
 * import { defineConfig } from 'vite'
 * import clarusjs from 'clarusjs/vite'
 *
 * export default defineConfig({
 *   plugins: [clarusjs({ routes: { '/account/*': 'server' }, fragments: true })],
 * })
 * ```
 * @see https://clarusjs.com/reference/vite-plugin#clarusjs
 */
export default function clarusjs(options: ClarusOptions = {}): Plugin {
  const modes = options.routes ?? {}
  checkModes(modes)
  const sources = options.sources ?? []
  if (options.site && !/^https?:\/\/[^/]/.test(options.site.url)) throw new Error(`clarusjs: site.url must be an absolute http(s) URL, got "${options.site.url}"`)
  for (const src of sources) {
    if (!/^\.[\w-]+$/.test(src.extension)) throw new Error(`clarusjs: a source extension must look like ".md", got "${src.extension}"`)
    if (src.extension === '.tscl') throw new Error('clarusjs: .tscl files are compiled directly; a source needs its own extension')
  }
  const extensions = ['.tscl', ...sources.map((src) => src.extension)]
  // Component files of every kind, read as .tscl text (a source's output, or the file itself).
  // Page sources only apply under src/pages: elsewhere (src/parts, …) their files are plain files, not components.
  // The project's path aliases (set in the config hook, once the root and Vite's own aliases are known).
  let aliases: Alias[] = []
  // Components other plugins name (api.clarusComponents(root)): a docs theme's replacement for one of its parts, which
  // no page imports by path. Found like those under src/, so their styles and islands are built. Set in config.
  let extra: (appRoot: string) => string[] = () => []
  const files: Files = {
    find: (dir) => findClarusFiles(dir, extensions).filter((f) => f.endsWith('.tscl') || f.includes(`${sep}src${sep}pages${sep}`)),
    pages: (root) => files.find(resolve(root, 'src/pages')).filter((f) => isPageFile(f.split(sep).join('/'))),
    layouts: (file, root) => layoutsFor(root, file, options.layouts ?? []),
    // ponytail: the folders are listed on every compile (cheap next to compiling); cache per build if it shows up.
    // The names are also written to .clarusjs/components.json, for the editor.
    names: (root) => componentNames(root, options.components),
    components: (appRoot) => reachableComponents(appRoot, [...files.find(resolve(appRoot, 'src')), ...extra(appRoot).filter((f) => existsSync(f))], (file) => files.read(file, appRoot), extensions, aliases, files.names(appRoot)),
    read: (file, appRoot) => {
      const code = readFileSync(file, 'utf8')
      const src = sources.find((x) => file.endsWith(x.extension))
      if (!src) return code
      const rel = relative(appRoot, file).split(sep).join('/')
      return src.toTscl(code, file, { route: rel.startsWith('src/pages/') ? routeFromFile(`/${rel}`) : '', root: appRoot, addDependency: () => {} })
    },
  }
  const fileRe = new RegExp(`\\.(${extensions.map((e) => e.slice(1)).join('|')})(\\?|$)`)
  const glob = (dir: string) => JSON.stringify(extensions.map((e) => `${dir}/**/*${e}`))
  if (options.adapter !== undefined && options.adapter !== 'netlify') {
    throw new Error(`clarusjs: adapter "${options.adapter}" is not supported; use 'netlify'`)
  }
  let root = process.cwd()
  let command: 'build' | 'serve' = 'serve'
  let base = '/'
  // `vite build` only: client entry name (see entryName) → public URL of its hashed chunk.
  // Read from the client manifest on disk, because Vite resolves config (and so creates a new plugin instance) per
  // environment: the server build cannot see state set during the client build.
  let built: Map<string, string> | undefined
  const builtUrls = (): Map<string, string> | undefined => {
    if (command !== 'build') return undefined
    if (built) return built
    const manifestFile = resolve(root, CLIENT_OUT, '.vite/manifest.json')
    if (!existsSync(manifestFile)) {
      throw new Error(`clarusjs: client manifest not found at ${manifestFile}; the server build must run after the client build`)
    }
    const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as Record<string, { file: string; name?: string; isEntry?: boolean }>
    built = new Map()
    // By entry name, and by source key: names are sanitized ([id] → _id_), keys keep the real path.
    for (const [key, chunk] of Object.entries(manifest)) {
      if (!chunk.isEntry) continue
      if (chunk.name) built.set(chunk.name, base + chunk.file)
      built.set(key, base + chunk.file)
      // And by the source's real path: Vite keys modules by their real path, which differs from the path the plugin
      // has when the project is reached through a symlink or a Windows short name (C:\\Users\\RUNNER~1).
      const [file, query] = key.split('?')
      built.set(real(resolve(root, file!)) + (query ? `?${query}` : ''), base + chunk.file)
    }
    return built
  }
  return {
    name: 'clarusjs',
    // For clarusjs check (src/cli/project.ts): the page sources it should type-check too.
    api: { sources, lint: options.lint, lintRules: options.lintRules, components: options.components },
    config(userConfig, env) {
      extra = (appRoot) => pluginsOf(userConfig.plugins).flatMap((p) => (p.api as { clarusComponents?: (root: string) => string[] } | undefined)?.clarusComponents?.(appRoot) ?? [])
      // The plugin's own component and stylesheet discovery resolves the same aliases Vite does.
      const projectRoot = resolve(userConfig.root ?? process.cwd())
      aliases = projectAliases(projectRoot, userConfig.resolve?.alias)
      // For Vite: ~/ and the tsconfig/jsconfig paths (its own resolve.alias it already has). Not Vite's
      // resolve.tsconfigPaths: that only applies to files the tsconfig includes, and .tscl files never are. Regexes:
      // a string find only matches itself, or itself followed by '/'.
      const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const own = projectAliases(projectRoot).map((a) => ({ find: new RegExp(`^${escape(a.find)}${a.exact ? '$' : a.find.endsWith('/') ? '' : '(?=/|$)'}`), replacement: a.replacement }))
      const config: UserConfig = {
        appType: 'custom',
        resolve: {
          alias: [
            { find: 'clarusjs/runtime/server', replacement: here('../runtime/server') },
            { find: 'clarusjs/runtime', replacement: here('../runtime/index') },
            ...own,
          ],
        },
      }
      if (env.isPreview) config.build = { outDir: CLIENT_OUT } // preview serves the static site
      // Packages that ship components are bundled for server rendering: Node can't load a .tscl file itself.
      const shipping = new Set<string>()
      if (!env.isPreview) {
        for (const file of files.components(resolve(userConfig.root ?? process.cwd()))) {
          const name = packageOfFile(file)
          if (name) shipping.add(name)
        }
        if (shipping.size) config.ssr = { noExternal: [...shipping] }
      }
      if (env.command !== 'build') return config
      if (userConfig.base !== undefined && !userConfig.base.startsWith('/') && !/^https?:\/\//.test(userConfig.base)) {
        // Pages live at different depths and islands are imported from the loader, so URLs must not be relative.
        throw new Error(`clarusjs: relative base "${userConfig.base}" is not supported; use an absolute base such as "/" or "/docs/"`)
      }
      // Client entries: the island loader plus every stateful component. Stateless components never reach the client.
      const appRoot = resolve(userConfig.root ?? process.cwd())
      const input: Record<string, string> = { [LOADER_ENTRY]: here('../runtime/loader') }
      const components = files.components(appRoot)
      for (const file of components) {
        if (compile(files.read(file, appRoot), { file, target: 'client', icon: iconsFor(file), layouts: files.layouts(file, appRoot), components: files.names(appRoot) }).stateful) input[entryName(appRoot, file)] = file
      }
      // Client routes: the router, and each page's render function for the browser.
      const client = clientPages(appRoot, modes, files)
      if (client.size) input[ROUTER_ENTRY] = here('../runtime/router')
      if (options.fragments) input[NAV_ENTRY] = here('../runtime/fragments')
      if (writeStyles(appRoot, files)) input[STYLES_ENTRY] = resolve(appRoot, STYLES_FILE)
      // Stylesheets imported by pages and components: each goes through Vite's CSS pipeline as its own entry.
      for (const sheet of new Set([...pageGraph(appRoot, files, aliases).values()].flatMap((p) => p.css))) {
        if (!existsSync(sheet)) throw new Error(`clarusjs: imported stylesheet not found: ${relative(appRoot, sheet)}`)
        input[`css/${relative(appRoot, sheet).split(sep).join('/').replace(/\.css$/, '').replace(/^(\.\.\/)+/, (ups) => '_/'.repeat(ups.length / 3))}`] = sheet
      }
      for (const file of client.values()) input[renderEntry(entryName(appRoot, file))] = `${file}?render`
      config.builder = {}
      config.environments = {
        // Island chunks are loaded with import() and must keep their `attach` export.
        client: { build: { outDir: CLIENT_OUT, manifest: true, rolldownOptions: { input, preserveEntrySignatures: 'exports-only' } } },
        // Always .mjs, so Node loads it as ESM whatever the app's package.json says.
        ssr: { build: { outDir: SERVER_OUT, rolldownOptions: { input: { index: ENTRY }, output: { entryFileNames: '[name].mjs' } } } },
      }
      return config
    },
    // Each build re-reads the client manifest: a builder can run buildApp() more than once.
    buildStart() { built = undefined },
    // Client build: nested islands rendered in the browser get their chunk's real URL.
    generateBundle(_options, bundle) {
      if (this.environment.config.consumer !== 'client' || command !== 'build') return
      const byName = new Map<string, string>()
      // By sanitized name and by the raw entry name from the source path ([id] stays [id]).
      for (const out of Object.values(bundle)) {
        if (out.type !== 'chunk' || !out.isEntry) continue
        byName.set(out.name, base + out.fileName)
        // Only island chunks: a client page's ?render chunk would otherwise take its island's place.
        if (out.facadeModuleId && !/[?&]render\b/.test(out.facadeModuleId)) byName.set(entryName(root, out.facadeModuleId.replace(/\?.*$/, '')), base + out.fileName)
      }
      for (const out of Object.values(bundle)) {
        if (out.type !== 'chunk' || !out.code.includes(CHUNK_TOKEN)) continue
        out.code = out.code.replace(/__CLARUS_CHUNK__\[(.+?)\]__/g, (_, name: string) => {
          const url = byName.get(name)
          if (!url) this.error(`clarusjs: no client chunk for ${name}.tscl (stateful components must be under src/)`)
          return url!
        })
      }
    },
    configResolved(config) {
      root = config.root
      command = config.command
      base = config.base
      // Component files the automatic imports can't name (#458), said once.
      if (options.components?.auto !== false) {
        const found = findClarusFiles(resolve(root, 'src'), ['.tscl']).map((f) => relative(root, f).split(sep).join('/'))
        for (const file of componentIndex(found, options.components?.dirs ?? COMPONENT_DIRS).skipped) {
          config.logger.warn(`clarusjs: ${file} isn't imported automatically: its name isn't kebab-case (rename it, or @import it)`)
        }
      }
      // The names, libraries' too, once now: a library that isn't installed fails here, and the editor gets
      // .clarusjs/components.json as soon as the dev server or a build starts.
      componentNames(root, options.components)
    },
    // Order matters: the server build needs the client's hashed URLs, and prerendering needs the server build.
    async buildApp(builder) {
      const { client, ssr } = builder.environments
      if (!client || !ssr) return
      // vite build --watch: Vite's own per-environment watchers would rebuild client and server separately, in any
      // order (the server build needs the client's new hashes) and never prerender. The whole sequence reruns instead.
      const watching = !!client.config.build.watch
      if (watching) client.config.build.watch = ssr.config.build.watch = null
      const once = async () => {
        // Before anything is built: an old path must not be a page.
        checkRedirects(options.redirects ?? {}, files.pages(builder.config.root).map((f) => routeFromFile(`/${relative(builder.config.root, f).split(sep).join('/')}`)))
        await builder.build(client)
        await builder.build(ssr)
        const entry = resolve(builder.config.root, SERVER_OUT, 'index.mjs')
        const out = resolve(builder.config.root, CLIENT_OUT)
        const dist = dirname(out)
        const manifestFile = resolve(dist, 'clarusjs-manifest.json')
        rmSync(manifestFile, { force: true }) // a page reading the manifest must never see the previous build's
        const { routes, readers, loaded, server } = await prerender(entry, out, manifestFile)
        writeManifest(dist, routes, builder.config.base, loaded, server)
        // Pages that read the manifest saw none on the first pass: render them again now that it exists.
        if (readers.length) {
          await prerender(entry, out, manifestFile, readers)
          writeManifest(dist, routes, builder.config.base, loaded, server)
        }
        // Links between pages and to anchors, checked against what was written.
        const pageRoutes = routes.filter((r) => !/\/(__data\.json|index\.frag\.html)$/.test(r))
        const clientRoutes = pageRoutes.filter((r) => routes.includes(r === '/' ? '/__data.json' : `${r}/__data.json`))
        // A page's own sitemap markers (opt-out, lastmod): read, then removed from every built page (error pages and
        // client routes too, before 404.html and 500.html are copied), whether a sitemap is written or not.
        const markers = new Map<string, { out: boolean; lastmod?: number }>()
        for (const page of pageRoutes) {
          const file = resolve(out, routeToFile(page))
          let html = readFileSync(file, 'utf8')
          const tags = [...html.matchAll(/<meta\b[^>]*>/gi)].map(([tag]) => tag)
          const optOut = tags.find((tag) => metaAttr(tag, 'name')?.toLowerCase() === 'sitemap' && metaAttr(tag, 'content') === 'false')
          const dated = tags.find((tag) => metaAttr(tag, 'name')?.toLowerCase() === 'sitemap:lastmod')
          let lastmod: number | undefined
          if (dated) {
            const value = metaAttr(dated, 'content') ?? ''
            const time = lastmodTime(value)
            if (Number.isNaN(time)) throw new Error(`clarusjs: ${page}: sitemap:lastmod '${value}' isn't a date (YYYY-MM-DD)`)
            lastmod = time / 1000
          }
          for (const marker of [optOut, dated]) if (marker) html = html.replace(marker, '')
          if (optOut || dated) writeFileSync(file, html)
          markers.set(page, { out: !!optOut, ...(lastmod === undefined ? {} : { lastmod }) })
        }
        // 404.html, which static hosts serve for unknown paths at any depth: the 404 page with its relative links
        // resolved from the site root (also at /404 itself, so the link check sees what visitors get).
        if (pageRoutes.includes('/404') && !clientRoutes.includes('/404')) {
          const html = rootLinks(readFileSync(resolve(out, routeToFile('/404')), 'utf8'), basePath(builder.config.base))
          writeFileSync(resolve(out, routeToFile('/404')), html)
          writeFileSync(resolve(out, '404.html'), html)
        }
        // 500.html, for hosts that serve it when something fails: the 500 page, with links from the site root.
        if (pageRoutes.includes('/500') && !clientRoutes.includes('/500')) {
          const html = rootLinks(readFileSync(resolve(out, routeToFile('/500')), 'utf8'), basePath(builder.config.base))
          writeFileSync(resolve(out, routeToFile('/500')), html)
          writeFileSync(resolve(out, '500.html'), html)
        }
        // Redirect pages exist (links to old paths stay valid); their anchors are the target's, so they go unchecked.
        if (options.redirects) {
          writeRedirects(out, options.redirects, basePath(builder.config.base).replace(/\/$/, ''), routes)
          const moved = Object.keys(options.redirects).map((from) => (from.length > 1 ? from.replace(/\/+$/, '') : from))
          pageRoutes.push(...moved)
          clientRoutes.push(...moved)
        }
        const issues = checkLinks({
          outDir: out,
          routes: pageRoutes,
          serverRoutes: server.map((x) => x.route),
          clientRoutes,
          base: builder.config.base,
          site: options.site?.url,
        })
        const levels = { pages: options.links?.pages ?? 'error', anchors: options.links?.anchors ?? 'warn' }
        // Each problem names the page's source file, and the line where the link is written literally.
        const sourceOf = new Map(files.pages(builder.config.root).map((f) => [routeFromFile(`/${relative(builder.config.root, f).split(sep).join('/')}`), f]))
        // Literal segments escaped; only whole [param] segments match any one segment (as the handler's routes do).
        const pattern = (route: string) => new RegExp(`^${route.split('/').map((seg) => (/^\[[^\]]+\]$/.test(seg) ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('/')}$`)
        const fileOf = (page: string) => sourceOf.get(page) ?? [...sourceOf].find(([route]) => pattern(route).test(page))?.[1]
        const locate = (page: string, href: string) => {
          const file = fileOf(page)
          if (!file) return page
          const rel = relative(builder.config.root, file).split(sep).join('/')
          const line = readFileSync(file, 'utf8').split('\n').findIndex((l) => l.includes(href))
          return line === -1 ? `${rel} (${page})` : `${rel}:${line + 1}`
        }
        const errors: string[] = []
        for (const issue of issues) {
          const level = levels[issue.kind]
          if (level === 'off') continue
          const text = `${locate(issue.page, issue.href)}: ${issue.message}`
          if (level === 'error' || options.links?.strict) errors.push(text)
          else builder.config.logger.warn(`clarusjs: ${text}`)
        }
        if (errors.length) throw new Error(`clarusjs: broken links:\n  ${errors.join('\n  ')}`)
        // sitemap.xml: static pages (not client shells, not noindex), dated by their source file's last commit.
        if (options.site && options.sitemap !== false) {
          const dates = gitDates(builder.config.root, 'src/pages')
          const epoch = process.env.SOURCE_DATE_EPOCH ? Number(process.env.SOURCE_DATE_EPOCH) : undefined
          const exclude = (typeof options.sitemap === 'object' ? options.sitemap.exclude ?? [] : [])
            .map((p) => new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*\*|\*/g, (s) => (s === '**' ? '.*' : '[^/]+'))}$`))
          // Pages that opted out (markers, read above) or are noindex aren't listed.
          const images = typeof options.sitemap !== 'object' || options.sitemap.images !== false
          const sitemapMeta = (page: string): { out: boolean; lastmod?: number; images: string[]; alternates: { hreflang: string; href: string }[] } => {
            const file = resolve(out, routeToFile(page))
            const html = readFileSync(file, 'utf8')
            const tags = [...html.matchAll(/<meta\b[^>]*>/gi)].map(([tag]) => tag)
            const attr = metaAttr
            const { out: optOut, lastmod } = markers.get(page) ?? { out: false }
            // The page's images, as written (sitemapXml resolves them): not decorative ones (alt=""), not data: URLs.
            const decode = (v: string) => v.replace(/&(amp|quot|#39|lt|gt);/g, (_, e: string) => ({ amp: '&', quot: '"', '#39': "'", lt: '<', gt: '>' })[e]!)
            const pics = images ? [...new Set([...html.matchAll(/<img\b[^>]*>/gi)].map(([tag]) => tag)
              .filter((tag) => attr(tag, 'alt') !== '')
              .map((tag) => decode(attr(tag, 'src') ?? ''))
              .filter((src) => src && !/^data:/i.test(src)))].slice(0, 1000) : [] // ponytail: the extension's 1,000 per page
            // Its translations: <link rel="alternate" hreflang="…" href="…"> in its head (kept there; they belong in both).
            const alternates = [...html.matchAll(/<link\b[^>]*>/gi)].map(([tag]) => tag)
              .filter((tag) => /(^|\s)alternate(\s|$)/i.test(attr(tag, 'rel') ?? '') && attr(tag, 'hreflang') && attr(tag, 'href'))
              .map((tag) => ({ hreflang: attr(tag, 'hreflang')!, href: decode(attr(tag, 'href')!) }))
            return { out: optOut || tags.some((tag) => attr(tag, 'name')?.toLowerCase() === 'robots' && /\bnoindex\b/i.test(attr(tag, 'content') ?? '')), ...(lastmod === undefined ? {} : { lastmod }), images: pics, alternates }
          }
          const pages = pageRoutes.filter((page) => page !== '/404' && page !== '/500' && !clientRoutes.includes(page))
            .map((path) => ({ path, meta: sitemapMeta(path) }))
          // Pages kept out (exclude, their own opt-out, noindex): include doesn't bring them back.
          const keptOut = new Set(pages.filter(({ path, meta }) => meta.out || exclude.some((re) => re.test(path))).map((p) => p.path))
          const listedPages = pages.filter(({ path }) => !keptOut.has(path))
          const entries = listedPages.map(({ path, meta }) => ({ path, lastmod: meta.lastmod ?? dates.get(fileOf(path) ?? '') ?? epoch, images: meta.images, alternates: meta.alternates }))
          // URLs the build can't list (server routes, client routes): from the config, an array or a function.
          const include = typeof options.sitemap === 'object' ? options.sitemap.include : undefined
          const extra = typeof include === 'function' ? await include() : include ?? []
          const listed = new Set(entries.map((p) => p.path))
          for (const path of extra) {
            if (typeof path !== 'string' || !path.startsWith('/')) throw new Error(`clarusjs: sitemap.include: '${String(path)}' isn't a path (start it with /)`)
            if (listed.has(path) || keptOut.has(path) || exclude.some((re) => re.test(path))) continue
            entries.push({ path, lastmod: undefined, images: [], alternates: [] })
            listed.add(path)
          }
          for (const { file, xml } of sitemapFiles(options.site.url, builder.config.base, entries)) writeFileSync(resolve(out, file), xml)
        }
        // robots.txt: allow everything, and point at the sitemap. A robots.txt in public/ (already copied) wins.
        if (options.site && options.robots !== false && !existsSync(resolve(out, 'robots.txt'))) {
          const sitemap = options.sitemap !== false ? `\nSitemap: ${new URL('sitemap.xml', new URL(builder.config.base, options.site.url.replace(/\/?$/, '/'))).href}\n` : ''
          writeFileSync(resolve(out, 'robots.txt'), `User-agent: *\nAllow: /\n${sitemap}`)
        }
        if (options.adapter === 'netlify') writeNetlifyFunction(builder.config.root, entry, server.map((s) => s.route), options.fragments === true)
        // Vite's manifest was for this build (island URLs, clarusjs-manifest.json); it isn't part of the site.
        rmSync(resolve(out, '.vite'), { recursive: true, force: true })
        if (options.compress) precompress(out)
      }
      await once()
      if (watching) watchApp(builder, once)
    },
    // order 'pre': before Vite resolves the relative import itself.
    resolveId: { order: 'pre', handler(id, importer) {
      // The navigation guard is shared in the source, but a page loads either the router or the fragment navigator,
      // never both: each gets its own copy, as a shared chunk would cost every page a request and ~200 bytes.
      if (/^\.\/navigate\.[jt]s$/.test(id) && importer && /[\\/]runtime[\\/](router|fragments)\.[jt]s$/.test(importer)) {
        return `${here('../runtime/navigate')}?cl-copy=${/router\.[jt]s$/.test(importer) ? 'router' : 'nav'}`
      }
      if (id === '/cl-loader.js') return here('../runtime/loader')
      if (id === '/cl-router.js') return here('../runtime/router')
      if (id === '/cl-nav.js') return here('../runtime/fragments')
      if (id === '/cl-hot.js') return here('../runtime/hot')
      if (id === ENTRY) return '\0' + ENTRY
    } },
    // order 'pre': a page source's file is read as text before Vite's asset loader can claim it (.txt,
    // assetsInclude), so the transform converts the original text, never a URL module.
    load: { order: 'pre', handler(id) {
      if (id !== '\0' + ENTRY) {
        if (/[?&](raw|url|inline)\b/.test(id) || id.startsWith('\0')) return null
        const file = id.replace(/\?.*$/, '')
        if (!sources.some((x) => file.endsWith(x.extension)) || !normalizePath(file).startsWith(normalizePath(resolve(root, 'src/pages')) + '/')) return null
        return readFileSync(file, 'utf8')
      }
      const urls = builtUrls()
      const loaderUrl = urls?.get(LOADER_ENTRY) ?? '/cl-loader.js'
      const routerUrl = urls?.get(ROUTER_ENTRY) ?? '/cl-router.js'
      const navUrl = urls?.get(NAV_ENTRY) ?? '/cl-nav.js'
      // Each page's imported stylesheets: built URLs (by source key), or the source served by Vite in dev.
      const css: Record<string, string[]> = {}
      const graph = pageGraph(root, files, aliases)
      // Each page's component loaders (#97): those of the components it uses, by Vite path.
      const componentLoaders: Record<string, string[]> = {}
      for (const [route, { components }] of graph) {
        const loaders = components.map((c) => componentLoaderOf(root, c)).filter((f): f is string => !!f && !relative(root, f).startsWith('..'))
        if (loaders.length) componentLoaders[route] = loaders.map((f) => `/${relative(root, f).split(sep).join('/')}`).sort()
      }
      for (const [route, { css: sheets }] of graph) {
        if (!sheets.length) continue
        css[route] = sheets.map((sheet) => {
          const key = relative(root, sheet).split(sep).join('/')
          const url = urls ? urls.get(key) ?? urls.get(real(sheet)) : clientUrlFor(root, sheet).replace(/\?.*$/, '')
          if (!url) throw new Error(`clarusjs: no built stylesheet for ${key}`)
          return url
        })
      }
      // Built: the hashed stylesheet, if any component has styles. Dev: the generated file, served by Vite.
      const stylesUrl = urls ? urls.get(STYLES_ENTRY) : writeStyles(root, files) ? `/${STYLES_FILE}` : undefined
      // Built: hashed chunk URLs. Dev: the source, served as JS by Vite.
      const client: Record<string, string> = {}
      for (const [route, file] of clientPages(root, modes, files)) {
        const key = `${relative(root, file).split(sep).join('/')}?render`
        const url = urls ? urls.get(key) ?? urls.get(`${real(file)}?render`) : `${clientUrlFor(root, file).replace(/\?.*$/, '')}?render&import`
        if (!url) throw new Error(`clarusjs: no client chunk for ${key}`)
        client[route] = url
      }
      return `import { createHandler } from ${JSON.stringify(here('../server/handler'))}\n` +
        `import { registerViews, render } from ${JSON.stringify(here('../server/views'))}\n` +
        // Every view under src/, for render(name, props) in server code. Also exported for apps that import the build.
        `registerViews(import.meta.glob(${JSON.stringify(['/src/**/*.tscl', ...extensions.slice(1).map((e) => `/src/pages/**/*${e}`)])}))\n` +
        `export { render }\n` +
        `export default createHandler(import.meta.glob(${glob('/src/pages')}), {\n` +
        `  loaderUrl: ${JSON.stringify(loaderUrl)},\n` +
        `  data: import.meta.glob('/src/pages/**/*.load.ts'),\n` +
        // Component loaders (#97): a .load.ts next to a component outside src/pages, run for the pages that use it.
        `  componentLoaders: ${JSON.stringify(componentLoaders)},\n` +
        `  componentData: import.meta.glob(['/src/**/*.load.ts', '!/src/pages/**']),\n` +
        // Endpoints: the other .ts files under src/pages, exporting GET, POST, … (see the server reference).
        `  guards: import.meta.glob('/src/pages/**/+guard.ts'),\n` +
        `  endpoints: import.meta.glob(['/src/pages/**/*.ts', '!/src/pages/**/*.load.ts', '!/src/pages/**/*.d.ts', '!/src/pages/**/+*']),\n` +
        `  modes: ${JSON.stringify(modes)},\n` +
        `  routerUrl: ${JSON.stringify(routerUrl)},\n` +
        `  client: ${JSON.stringify(client)},\n` +
        `  base: ${JSON.stringify(base)},\n` +
        `  fragments: ${options.fragments === true},\n` +
        // The dev server shows a failing page's error itself; builds and production answer with the 500 page.
        `  dev: ${command === 'serve'},\n` +
        `  navUrl: ${JSON.stringify(navUrl)},\n` +
        `  stylesUrl: ${JSON.stringify(stylesUrl)},\n` +
        `  css: ${JSON.stringify(css)},\n` +
        // src/head.ts is optional: its transformHead (a function, so not a plugin option) runs on every page's head.
        `  site: ${JSON.stringify(options.site)},\n` +
        `  head: { ...${JSON.stringify(options.head ?? {})}, transform: Object.values(import.meta.glob('/src/head.ts', { eager: true }))[0]?.transformHead },\n` +
        // src/server.ts is optional too: its handle() runs once per request, before any page loads (cookies, locals).
        `  hooks: Object.values(import.meta.glob('/src/server.ts', { eager: true }))[0],\n` +
        `})\n`
    } },
    transform: {
      filter: { id: fileRe },
      async handler(raw, id) {
        // Imported as text, a URL or inline (component.tscl?raw for a code sample): Vite's, never compiled.
        if (/[?&](raw|url|inline)\b/.test(id)) return null
        const file = id.replace(/\?.*$/, '')
        // A page source's file is compiled from the .tscl text it produces: only under src/pages, and never when it is
        // imported as text or a URL (CHANGELOG.md?raw stays a string).
        const src = sources.find((x) => file.endsWith(x.extension))
        if (src && (/[?&](raw|url|inline)\b/.test(id) || !normalizePath(file).startsWith(normalizePath(resolve(root, 'src/pages')) + '/'))) return null
        const rel = relative(root, file).split(sep).join('/')
        const code = src
          ? src.toTscl(raw, file, { route: rel.startsWith('src/pages/') ? routeFromFile(`/${rel}`) : '', root, addDependency: (dep) => this.addWatchFile(dep) })
          : raw
        // ?render: a component's server render function, used in the browser to render children of islands.
        const renderQuery = /[?&]render\b/.test(id)
        const target = this.environment.config.consumer === 'server' || renderQuery ? 'server' : 'client'
        // ponytail: ?import makes Vite's dev transform middleware serve .tscl as JS for the loader's dynamic import; build output uses hashed chunk URLs from the client manifest (stage 3)
        const consumer = this.environment.config.consumer
        // Server build: chunk URLs come from the client manifest. Client build (a ?render child): the chunk doesn't
        // exist yet, so write a placeholder that generateBundle swaps for the real file name. Dev: the source URL.
        const urls = consumer === 'server' ? builtUrls() : undefined
        // Built URLs by entry name, or by source key when the name was sanitized ([tag] → _tag_).
        const clientUrl = urls
          ? urls.get(entryName(root, file)) ?? urls.get(relative(root, file).split(sep).join('/')) ?? urls.get(real(file))
          : command === 'build' ? `${CHUNK_TOKEN}[${entryName(root, file)}]__` : clientUrlFor(root, file)
        if (urls && !clientUrl && compile(code, { file, target: 'client', icon: iconsFor(file), layouts: files.layouts(file, root), components: files.names(root) }).stateful) {
          this.error(`${file}: stateful component is not under src/, so it has no client chunk`)
        }
        // Imports that aren't relative or root paths must resolve (an alias, a package): otherwise a located error at
        // the @import, naming it, rather than Vite's error about the compiled module.
        let parsed
        try { parsed = parse(code, file) } catch { parsed = null } // compile reports it below
        for (const imp of parsed ? [...parsed.imports, ...parsed.dataImports, ...parsed.cssImports] : []) {
          if (/^[./]/.test(imp.from) || /^[a-z]+:/i.test(imp.from)) continue
          if (await this.resolve(imp.from.replace(/\?.*$/, ''), id)) continue
          const before = code.slice(0, imp.start)
          const line = before.split('\n').length
          this.error(`${rel}:${line}:${imp.start - before.lastIndexOf('\n')} cannot resolve '${imp.from}': no file, package or path alias (~/, tsconfig paths, resolve.alias) matches it`)
        }
        try {
          // A ?render module runs in the browser: its child components must be render modules too.
          const renderImports = renderQuery && this.environment.config.consumer !== 'server'
          // moduleType: a source extension may have its own built-in type in Rolldown (.txt is text); the output is JS.
          const collapseWhitespace = command === 'build' && options.collapseWhitespace !== false
          // A component with a loader (#97) reads what it loaded, by its path from the root.
          const loader = componentLoaderOf(root, file) ? relative(root, file).split(sep).join('/') : undefined
          // Dev: an island's module swaps itself in place when its file changes (#53).
          const hot = command === 'serve' && target === 'client' ? '/cl-hot.js' : undefined
          // A page's folder and config layouts (#456): its template is wrapped in them.
          const layouts = files.layouts(file, root)
          const out = compile(code, { file, target, clientUrl, renderImports, scope: scopeFor(root, file), collapseWhitespace, loader, hot, icon: iconsFor(file), layouts, components: files.names(root) })
          // Every component compiles for the server once: warnings from there, so each is said once.
          if (consumer === 'server' && !renderQuery) for (const w of out.warnings) this.warn(w.message)
          return { code: out.code, map: null, moduleType: 'js' }
        } catch (err) {
          if (err instanceof ClarusError) this.error(err.message)
          throw err
        }
      },
    },
    // The built site is static files: /guide/x is guide/x/index.html. appType 'custom' turns off Vite's own lookup.
    configurePreviewServer(server) {
      const outDir = resolve(server.config.root, server.config.build.outDir)
      const base = server.config.base // e.g. '/' or '/docs/'; Vite strips it after this middleware
      server.middlewares.use((req, res, next) => {
        let url: string
        try {
          url = decodeURIComponent((req.url ?? '/').split('?')[0]!)
        } catch {
          // A malformed %-escape: the client's error, said plainly (not a 500 with a stack from further down).
          res.statusCode = 400
          res.setHeader('content-type', 'text/plain; charset=utf-8')
          return res.end('Bad Request: malformed URL')
        }
        const inBase = url === base.slice(0, -1) ? '/' : url.startsWith(base) ? '/' + url.slice(base.length) : undefined
        if (inBase !== undefined) {
          // A built page wins; anything else (assets, /x.css) falls through to Vite's static files.
          const file = resolve(outDir, `.${inBase.replace(/\/?$/, '/')}index.html`)
          if (file.startsWith(outDir + sep) && existsSync(file)) req.url = base + file.slice(outDir.length + 1).replace(/\\/g, '/')
          precompressed(req, res, outDir, base)
        }
        next()
      })
      // Server routes go to the built handler, as they would in production; anything else that isn't a file is a 404.
      return () => {
        server.middlewares.use(async (req, res, next) => {
          try {
            const entry = resolve(server.config.root, SERVER_OUT, 'index.mjs')
            if (!existsSync(entry)) return next()
            const app = (await import(pathToFileURL(entry).href)) as { default: { fetch(r: Request): Promise<Response>; isServerPath(p: string): boolean } }
            if (!app.default.isServerPath((req.url ?? '/').split('?')[0]!)) return next()
            const response = await app.default.fetch(toRequest(req))
            if (response.status === 404) return next()
            await sendResponse(res, response)
          } catch (err) {
            next(err)
          }
        })
        // Nothing else answered: 404.html with status 404, as a static host serves it.
        server.middlewares.use((req, res, next) => {
          const page = resolve(outDir, '404.html')
          if ((req.method !== 'GET' && req.method !== 'HEAD') || !existsSync(page)) return next()
          res.statusCode = 404
          res.setHeader('content-type', 'text/html; charset=utf-8')
          res.end(req.method === 'HEAD' ? undefined : readFileSync(page))
        })
      }
    },
    // A change only the server's modules see (a page, a layout, a stateless component, a loader) is a full reload:
    // the browser has nothing to update. Changes the browser has loaded go through its own HMR (islands swap in place).
    hotUpdate({ file, modules, server }) {
      if (this.environment.name !== 'ssr' || !modules.length) return
      if (server.environments.client.moduleGraph.getModulesByFile(file)?.size) return
      server.environments.client.hot.send({ type: 'full-reload' })
    },
    configureServer(server) {
      // Component styles change with their .tscl files: regenerate the stylesheet (Vite then updates the page's CSS).
      const restyle = (file: string) => { if (fileRe.test(file)) writeStyles(server.config.root, files) }
      server.watcher.on('change', restyle)
      server.watcher.on('add', restyle)
      server.watcher.on('unlink', restyle)
      return () => {
        server.middlewares.use(async (req, res, next) => {
          try {
            const env = server.environments.ssr
            if (!isRunnableDevEnvironment(env)) return next()
            if (options.redirects) {
              const prefix = basePath(server.config.base).replace(/\/$/, '')
              const pathname = new URL(req.url ?? '/', 'http://x').pathname
              const to = redirectFor(options.redirects, pathname.startsWith(prefix + '/') ? pathname.slice(prefix.length) : pathname, prefix)
              if (to !== undefined) return void res.writeHead(301, { location: to }).end()
            }
            const app = await env.runner.import<{ default: { fetch(r: Request): Promise<Response> } }>(ENTRY)
            let response = await app.default.fetch(toRequest(req))
            const html = response.headers.get('content-type')?.startsWith('text/html')
            // The 404 page (HTML) is the answer; a plain 404 falls through to Vite.
            if (response.status === 404 && !html) return next()
            // Every page loads Vite's client in dev, islands or not: a page that ships no JavaScript would otherwise
            // never hear a change (a <style> edit, a layout edit) and keep showing the old one until a manual reload.
            if (html && req.method !== 'HEAD') {
              // Read a copy: a response that isn't changed (a fragment, a bodyless 304) is sent as it came.
              const text = await response.clone().text()
              // An existing client is a <script> loading it, not the URL written anywhere (a code sample).
              const has = /<script\b[^>]*\ssrc=["'][^"']*\/@vite\/client["']/i.test(text)
              if (!has && /<\/head>/i.test(text)) {
                const client = `<script type="module" src="${server.config.base}@vite/client"></script>`
                const headers = new Headers(response.headers)
                headers.delete('content-length')
                response = new Response(text.replace(/<\/head>/i, `${client}</head>`), { status: response.status, statusText: response.statusText, headers })
              }
            }
            await sendResponse(res, response)
          } catch (err) {
            next(err)
          }
        })
      }
    },
  }
}

/**
 * vite preview serves a file's precompressed copy (`x.js.br`, `x.js.gz`, written by `compress`) when the browser
 * accepts it, as nginx gzip_static and production hosts do, so what preview measures is what ships. It only points
 * the request at the copy: Vite's static server (sirv) then sends it with `Content-Encoding` and the original's type.
 */
function precompressed(req: IncomingMessage, res: ServerResponse, outDir: string, base: string): void {
  // A byte range is of the file as stored: the original.
  if ((req.method !== 'GET' && req.method !== 'HEAD') || req.headers.range) return
  const [path, query] = (req.url ?? '/').split('?') as [string, string | undefined]
  if (!path.startsWith(base)) return
  let file: string
  try {
    file = resolve(outDir, decodeURIComponent(path.slice(base.length)))
  } catch {
    return
  }
  if (!file.startsWith(outDir + sep) || !existsSync(file)) return
  const copies = (['br', 'gzip'] as const).filter((enc) => existsSync(file + (enc === 'br' ? '.br' : '.gz')))
  if (!copies.length) return
  // Which file answers depends on Accept-Encoding.
  res.setHeader('Vary', 'Accept-Encoding')
  const accept = String(req.headers['accept-encoding'] ?? '')
  const pick = copies.find((enc) => acceptsEncoding(accept, enc))
  if (pick) req.url = `${path}${pick === 'br' ? '.br' : '.gz'}${query === undefined ? '' : `?${query}`}`
}


/**
 * Precompressed copies for self-hosted servers that serve them directly (nginx gzip_static/brotli_static, Caddy
 * precompressed): `x.html.br` and `x.html.gz` next to each text file, kept only when smaller than the original.
 */
function precompress(dir: string): void {
  for (const name of readdirSync(dir, { recursive: true }) as string[]) {
    if (!/\.(html|js|css|svg|json|xml)$/.test(name)) continue
    const file = resolve(dir, name)
    const data = readFileSync(file)
    const br = brotliCompressSync(data, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11, [zlibConstants.BROTLI_PARAM_SIZE_HINT]: data.length } })
    const gz = gzipSync(data, { level: 9 })
    if (br.length < data.length) writeFileSync(file + '.br', br)
    if (gz.length < data.length) writeFileSync(file + '.gz', gz)
  }
}

/**
 * vite build --watch: run `once` (the whole build) again after each change under src/ or public/, debounced and one
 * at a time. A failed rebuild is logged and the next change tries again. The watcher is on the builder (closable).
 */
function watchApp(builder: { config: { root: string; logger: { info(m: string): void; error(m: string): void } } }, once: () => Promise<void>): void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = Promise.resolve()
  const rebuild = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      running = running.then(once).then(
        () => builder.config.logger.info('clarusjs: rebuilt'),
        (err) => builder.config.logger.error(`clarusjs: rebuild failed: ${(err as Error)?.message ?? err}`),
      )
    }, 100)
  }
  const watchers = ['src', 'public'].filter((d) => existsSync(resolve(builder.config.root, d))).map((d) => watchFs(resolve(builder.config.root, d), { recursive: true }, rebuild))
  ;(builder as { clarusjsWatcher?: { close(): Promise<void> } }).clarusjsWatcher = {
    async close() {
      clearTimeout(timer)
      for (const w of watchers) w.close()
      await running
    },
  }
}
