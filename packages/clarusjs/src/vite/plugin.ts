// The clarusjs Vite plugin: a thin adapter around the compiler.
// Server environment gets render(), client environment gets attach(). Dev requests go through the fetch handler.
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isRunnableDevEnvironment, type Plugin, type UserConfig } from 'vite'
import { compile, ClarusError } from '../compiler/index.ts'
import { findClarusFiles, prerender } from './build.ts'
import { writeManifest } from './manifest.ts'
import { writeNetlifyFunction } from './netlify.ts'
import { checkModes, modeFor, type ModeTable } from '../server/modes.ts'
import { routeFromFile } from '../server/handler.ts'
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
// Client entry name of a client-mode page's browser render module.
const renderEntry = (name: string) => `render/${name}`
const CLIENT_OUT = 'dist/client'
// Placeholder for a nested island's chunk URL in the client build, replaced once the bundle's file names are known.
const CHUNK_TOKEN = '__CLARUS_CHUNK__'
const SERVER_OUT = 'dist/server'
const entryName = (root: string, file: string) => relative(root, file).replace(/\.tscl$/, '')

export type ClarusOptions = {
  /** When each route renders: { '/account/*': 'server' }. Routes default to 'static' (prerendered at build). */
  routes?: ModeTable
  /** Where server routes deploy. 'netlify': a Netlify Function (Frameworks API) next to the static files. */
  adapter?: 'netlify'
}

/** Client-mode pages: route (as the file names it) → absolute file. */
function clientPages(appRoot: string, modes: ModeTable): Map<string, string> {
  const pages = new Map<string, string>()
  for (const file of findClarusFiles(resolve(appRoot, 'src/pages'))) {
    const route = routeFromFile(`/${relative(appRoot, file).split(sep).join('/')}`)
    if (modeFor(route, modes) === 'client') pages.set(route, file)
  }
  return pages
}

export default function clarusjs(options: ClarusOptions = {}): Plugin {
  const modes = options.routes ?? {}
  checkModes(modes)
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
      for (const file of findClarusFiles(resolve(appRoot, 'src'))) {
        if (compile(readFileSync(file, 'utf8'), { file, target: 'client' }).stateful) input[entryName(appRoot, file)] = file
      }
      // Client routes: the router, and each page's render function for the browser.
      const client = clientPages(appRoot, modes)
      if (client.size) input[ROUTER_ENTRY] = here('../runtime/router')
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
      for (const out of Object.values(bundle)) if (out.type === 'chunk' && out.isEntry) byName.set(out.name, base + out.fileName)
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
      if (options.adapter === 'netlify') writeNetlifyFunction(builder.config.root, entry, server.map((s) => s.route))
    },
    resolveId(id) {
      if (id === '/cl-loader.js') return here('../runtime/loader')
      if (id === '/cl-router.js') return here('../runtime/router')
      if (id === ENTRY) return '\0' + ENTRY
    },
    load(id) {
      if (id !== '\0' + ENTRY) return
      const urls = builtUrls()
      const loaderUrl = urls?.get(LOADER_ENTRY) ?? '/cl-loader.js'
      const routerUrl = urls?.get(ROUTER_ENTRY) ?? '/cl-router.js'
      // Built: hashed chunk URLs. Dev: the source, served as JS by Vite.
      const client: Record<string, string> = {}
      for (const [route, file] of clientPages(root, modes)) {
        const key = `${relative(root, file).split(sep).join('/')}?render`
        const url = urls ? urls.get(key) : `${clientUrlFor(root, file).replace(/\?.*$/, '')}?render&import`
        if (!url) throw new Error(`clarusjs: no client chunk for ${key}`)
        client[route] = url
      }
      return `import { createHandler } from ${JSON.stringify(here('../server/handler'))}\n` +
        `export default createHandler(import.meta.glob('/src/pages/**/*.tscl'), {\n` +
        `  loaderUrl: ${JSON.stringify(loaderUrl)},\n` +
        `  data: import.meta.glob('/src/pages/**/*.load.ts'),\n` +
        `  modes: ${JSON.stringify(modes)},\n` +
        `  routerUrl: ${JSON.stringify(routerUrl)},\n` +
        `  client: ${JSON.stringify(client)},\n` +
        `})\n`
    },
    transform: {
      filter: { id: /\.tscl(\?|$)/ },
      handler(code, id) {
        const file = id.replace(/\?.*$/, '')
        // ?render: a component's server render function, used in the browser to render children of islands.
        const renderQuery = /[?&]render\b/.test(id)
        const target = this.environment.config.consumer === 'server' || renderQuery ? 'server' : 'client'
        // ponytail: ?import makes Vite's dev transform middleware serve .tscl as JS for the loader's dynamic import; build output uses hashed chunk URLs from the client manifest (stage 3)
        const consumer = this.environment.config.consumer
        // Server build: chunk URLs come from the client manifest. Client build (a ?render child): the chunk doesn't
        // exist yet, so write a placeholder that generateBundle swaps for the real file name. Dev: the source URL.
        const urls = consumer === 'server' ? builtUrls() : undefined
        const clientUrl = urls
          ? urls.get(entryName(root, file))
          : command === 'build' ? `${CHUNK_TOKEN}[${entryName(root, file)}]__` : clientUrlFor(root, file)
        if (urls && !clientUrl && compile(code, { file, target: 'client' }).stateful) {
          this.error(`${file}: stateful component is not under src/, so it has no client chunk`)
        }
        try {
          // A ?render module runs in the browser: its child components must be render modules too.
          const renderImports = renderQuery && this.environment.config.consumer !== 'server'
          return { code: compile(code, { file, target, clientUrl, renderImports }).code, map: null }
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
