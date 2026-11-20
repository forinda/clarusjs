// The clarusjs Vite plugin: a thin adapter around the compiler.
// Server environment gets render(), client environment gets attach(). Dev requests go through the fetch handler.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isRunnableDevEnvironment, normalizePath, type Plugin, type UserConfig } from 'vite'
import { compile, scopeId, ClarusError } from '../compiler/index.ts'
import { parse } from '../compiler/parse.ts'
import { findClarusFiles, prerender } from './build.ts'
import { writeManifest } from './manifest.ts'
import { writeNetlifyFunction } from './netlify.ts'
import { checkLinks } from './links.ts'
import { checkModes, modeFor, type ModeTable } from '../server/modes.ts'
import { routeFromFile } from '../server/handler.ts'
import type { HeadTag, SiteOptions } from '../server/head.ts'
import { sendResponse, toRequest } from './node.ts'

// From src/ (workspace, tests) our siblings are .ts files; from the published dist/ they are .js.
const ext = import.meta.url.endsWith('.ts') ? '.ts' : '.js'
const here = (path: string) => fileURLToPath(new URL(path + ext, import.meta.url))
const ENTRY = 'virtual:clarusjs/server-entry'

/** Dev URL of a component's client module: root-relative, or Vite's /@fs/ form for files outside the root. */
export function clientUrlFor(root: string, file: string): string {
  const rel = relative(root, file)
  return rel.startsWith('..') || isAbsolute(rel) ? `/@fs${file}?import` : `/${rel}?import`
}

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
function pageStylesheets(root: string, files: Files): Map<string, string[]> {
  const deps = new Map<string, { css: string[]; components: string[] }>()
  const read = (file: string) => {
    if (!deps.has(file)) {
      let parsed
      try { parsed = parse(files.read(file, root), file) } catch { parsed = null } // errors surface on compile
      // Relative to the file, or root-relative ('/src/layouts/docs.tscl', as Vite resolves it).
      const near = (from: string) => {
        const path = from.replace(/\?.*$/, '')
        return path.startsWith('/') ? resolve(root, `.${path}`) : resolve(dirname(file), path)
      }
      deps.set(file, {
        css: parsed?.cssImports.map((c) => near(c.from)) ?? [],
        components: parsed?.imports.filter((imp) => /^[./]/.test(imp.from)).map((imp) => near(imp.from)) ?? [],
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
  const pages = new Map<string, string[]>()
  for (const file of files.find(resolve(root, 'src/pages'))) {
    const out: string[] = []
    collect(file, out, new Set())
    pages.set(routeFromFile(`/${relative(root, file).split(sep).join('/')}`), out)
  }
  return pages
}

/** Write .clarusjs/styles.css from every component under src/; false when no component has a <style>. */
function writeStyles(root: string, files: Files): boolean {
  let css = ''
  for (const file of files.find(resolve(root, 'src'))) {
    try {
      const out = compile(files.read(file, root), { file, target: 'client', scope: scopeFor(root, file) }).css
      if (out) css += `/* ${relative(root, file).split(sep).join('/')} */\n${out}`
    } catch {} // compile errors are reported when the component itself is compiled
  }
  mkdirSync(resolve(root, '.clarusjs'), { recursive: true })
  writeFileSync(resolve(root, STYLES_FILE), css)
  return css !== ''
}
// Client entry name of a client-mode page's browser render module.
const renderEntry = (name: string) => `render/${name}`
const CLIENT_OUT = 'dist/client'
// Placeholder for a nested island's chunk URL in the client build, replaced once the bundle's file names are known.
const CHUNK_TOKEN = '__CLARUS_CHUNK__'
const SERVER_OUT = 'dist/server'
const entryName = (root: string, file: string) => relative(root, file).replace(/\.[^./\\]+$/, '')

export type ClarusOptions = {
  /** When each route renders: { '/account/*': 'server' }. Routes default to 'static' (prerendered at build). */
  routes?: ModeTable
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
   * Every page's <head>: `titleTemplate` ('%s · Site') wraps the document title, `tags` are added unless the page has
   * its own with the same key. Anything else: export `transformHead(head, page)` from src/head.ts.
   */
  head?: { titleTemplate?: string; tags?: HeadTag[]; jsonLd?: object | object[] }
  /**
   * The site's public address. Every page gets a canonical URL and social cards (Open Graph, Twitter) from its title,
   * description and an image (the page's og:image, or `image`); absolute links to the site are link-checked.
   */
  site?: SiteOptions
}
export type { HeadTag }
export type LinkLevel = 'error' | 'warn' | 'off'

/**
 * A page source: files with another extension (such as Markdown) turned into .tscl text, then compiled like any
 * page. `route` is the page's route when the file is under src/pages.
 */
export type Source = { extension: string; toTscl(code: string, file: string, context: SourceContext): string }
/** `root`: the app root. `addDependency(file)`: another file the output depends on (rebuilt when it changes in dev). */
export type SourceContext = { route: string; root: string; addDependency(file: string): void }

/** How the plugin finds and reads component files: .tscl, plus the extensions of its page sources. */
type Files = { find(dir: string): string[]; read(file: string, root: string): string }

/** Client-mode pages: route (as the file names it) → absolute file. */
function clientPages(appRoot: string, modes: ModeTable, files: Files): Map<string, string> {
  const pages = new Map<string, string>()
  for (const file of files.find(resolve(appRoot, 'src/pages'))) {
    const route = routeFromFile(`/${relative(appRoot, file).split(sep).join('/')}`)
    if (modeFor(route, modes) === 'client') pages.set(route, file)
  }
  return pages
}

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
  const files: Files = {
    find: (dir) => findClarusFiles(dir, extensions).filter((f) => f.endsWith('.tscl') || f.includes(`${sep}src${sep}pages${sep}`)),
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
    }
    return built
  }
  return {
    name: 'clarusjs',
    config(userConfig, env) {
      const config: UserConfig = {
        appType: 'custom',
        resolve: {
          alias: [
            { find: 'clarusjs/runtime/server', replacement: here('../runtime/server') },
            { find: 'clarusjs/runtime', replacement: here('../runtime/index') },
          ],
        },
      }
      if (env.isPreview) config.build = { outDir: CLIENT_OUT } // preview serves the static site
      if (env.command !== 'build') return config
      if (userConfig.base !== undefined && !userConfig.base.startsWith('/') && !/^https?:\/\//.test(userConfig.base)) {
        // Pages live at different depths and islands are imported from the loader, so URLs must not be relative.
        throw new Error(`clarusjs: relative base "${userConfig.base}" is not supported; use an absolute base such as "/" or "/docs/"`)
      }
      // Client entries: the island loader plus every stateful component. Stateless components never reach the client.
      const appRoot = resolve(userConfig.root ?? process.cwd())
      const input: Record<string, string> = { [LOADER_ENTRY]: here('../runtime/loader') }
      for (const file of files.find(resolve(appRoot, 'src'))) {
        if (compile(files.read(file, appRoot), { file, target: 'client' }).stateful) input[entryName(appRoot, file)] = file
      }
      // Client routes: the router, and each page's render function for the browser.
      const client = clientPages(appRoot, modes, files)
      if (client.size) input[ROUTER_ENTRY] = here('../runtime/router')
      if (options.fragments) input[NAV_ENTRY] = here('../runtime/fragments')
      if (writeStyles(appRoot, files)) input[STYLES_ENTRY] = resolve(appRoot, STYLES_FILE)
      // Stylesheets imported by pages and components: each goes through Vite's CSS pipeline as its own entry.
      for (const sheet of new Set([...pageStylesheets(appRoot, files).values()].flat())) {
        if (!existsSync(sheet)) throw new Error(`clarusjs: imported stylesheet not found: ${relative(appRoot, sheet)}`)
        input[`css/${relative(appRoot, sheet).split(sep).join('/').replace(/\.css$/, '')}`] = sheet
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
    },
    // Order matters: the server build needs the client's hashed URLs, and prerendering needs the server build.
    async buildApp(builder) {
      const { client, ssr } = builder.environments
      if (!client || !ssr) return
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
      const issues = checkLinks({
        outDir: out,
        routes: pageRoutes,
        serverRoutes: server.map((x) => x.route),
        clientRoutes: pageRoutes.filter((r) => routes.includes(r === '/' ? '/__data.json' : `${r}/__data.json`)),
        base: builder.config.base,
        site: options.site?.url,
      })
      const levels = { pages: options.links?.pages ?? 'error', anchors: options.links?.anchors ?? 'warn' }
      // Each problem names the page's source file, and the line where the link is written literally.
      const sourceOf = new Map(files.find(resolve(builder.config.root, 'src/pages')).map((f) => [routeFromFile(`/${relative(builder.config.root, f).split(sep).join('/')}`), f]))
      const locate = (page: string, href: string) => {
        const file = sourceOf.get(page) ?? [...sourceOf].find(([route]) => new RegExp(`^${route.replace(/\[[^\]]+\]/g, '[^/]+')}$`).test(page))?.[1]
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
      if (options.adapter === 'netlify') writeNetlifyFunction(builder.config.root, entry, server.map((s) => s.route), options.fragments === true)
    },
    resolveId(id) {
      if (id === '/cl-loader.js') return here('../runtime/loader')
      if (id === '/cl-router.js') return here('../runtime/router')
      if (id === '/cl-nav.js') return here('../runtime/fragments')
      if (id === ENTRY) return '\0' + ENTRY
    },
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
      for (const [route, sheets] of pageStylesheets(root, files)) {
        if (!sheets.length) continue
        css[route] = sheets.map((sheet) => {
          const key = relative(root, sheet).split(sep).join('/')
          const url = urls ? urls.get(key) : clientUrlFor(root, sheet).replace(/\?.*$/, '')
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
        const url = urls ? urls.get(key) : `${clientUrlFor(root, file).replace(/\?.*$/, '')}?render&import`
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
        `  modes: ${JSON.stringify(modes)},\n` +
        `  routerUrl: ${JSON.stringify(routerUrl)},\n` +
        `  client: ${JSON.stringify(client)},\n` +
        `  base: ${JSON.stringify(base)},\n` +
        `  fragments: ${options.fragments === true},\n` +
        `  navUrl: ${JSON.stringify(navUrl)},\n` +
        `  stylesUrl: ${JSON.stringify(stylesUrl)},\n` +
        `  css: ${JSON.stringify(css)},\n` +
        // src/head.ts is optional: its transformHead (a function, so not a plugin option) runs on every page's head.
        `  site: ${JSON.stringify(options.site)},\n` +
        `  head: { ...${JSON.stringify(options.head ?? {})}, transform: Object.values(import.meta.glob('/src/head.ts', { eager: true }))[0]?.transformHead },\n` +
        `})\n`
    } },
    transform: {
      filter: { id: fileRe },
      handler(raw, id) {
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
          ? urls.get(entryName(root, file)) ?? urls.get(relative(root, file).split(sep).join('/'))
          : command === 'build' ? `${CHUNK_TOKEN}[${entryName(root, file)}]__` : clientUrlFor(root, file)
        if (urls && !clientUrl && compile(code, { file, target: 'client' }).stateful) {
          this.error(`${file}: stateful component is not under src/, so it has no client chunk`)
        }
        try {
          // A ?render module runs in the browser: its child components must be render modules too.
          const renderImports = renderQuery && this.environment.config.consumer !== 'server'
          // moduleType: a source extension may have its own built-in type in Rolldown (.txt is text); the output is JS.
          return { code: compile(code, { file, target, clientUrl, renderImports, scope: scopeFor(root, file) }).code, map: null, moduleType: 'js' }
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
      server.middlewares.use((req, _res, next) => {
        let url: string
        try {
          url = decodeURIComponent((req.url ?? '/').split('?')[0]!)
        } catch {
          return next() // a malformed %-escape names no built page
        }
        const inBase = url === base.slice(0, -1) ? '/' : url.startsWith(base) ? '/' + url.slice(base.length) : undefined
        if (inBase !== undefined) {
          // A built page wins; anything else (assets, /x.css) falls through to Vite's static files.
          const file = resolve(outDir, `.${inBase.replace(/\/?$/, '/')}index.html`)
          if (file.startsWith(outDir) && existsSync(file)) req.url = base + file.slice(outDir.length + 1).replace(/\\/g, '/')
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
      }
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
            const app = await env.runner.import<{ default: { fetch(r: Request): Promise<Response> } }>(ENTRY)
            const response = await app.default.fetch(toRequest(req))
            if (response.status === 404) return next()
            await sendResponse(res, response)
          } catch (err) {
            next(err)
          }
        })
      }
    },
  }
}
