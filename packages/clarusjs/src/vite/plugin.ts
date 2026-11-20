// The clarusjs Vite plugin: a thin adapter around the compiler.
// Server environment gets render(), client environment gets attach(). Dev requests go through the fetch handler.
import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isRunnableDevEnvironment, type Plugin, type UserConfig } from 'vite'
import { compile, ClarusError } from '../compiler/index.ts'
import { findClarusFiles, prerender } from './build.ts'
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
const CLIENT_OUT = 'dist/client'
// Placeholder for a nested island's chunk URL in the client build, replaced once the bundle's file names are known.
const CHUNK_TOKEN = '__CLARUS_CHUNK__'
const SERVER_OUT = 'dist/server'
const entryName = (root: string, file: string) => relative(root, file).replace(/\.clarus$/, '')

export default function clarusjs(): Plugin {
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
    for (const chunk of Object.values(manifest)) if (chunk.isEntry && chunk.name) built.set(chunk.name, base + chunk.file)
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
          if (!url) this.error(`clarusjs: no client chunk for ${name}.clarus (stateful components must be under src/)`)
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
      await prerender(resolve(builder.config.root, SERVER_OUT, 'index.mjs'), resolve(builder.config.root, CLIENT_OUT))
    },
    resolveId(id) {
      if (id === '/cl-loader.js') return here('../runtime/loader')
      if (id === ENTRY) return '\0' + ENTRY
    },
    load(id) {
      if (id !== '\0' + ENTRY) return
      const loaderUrl = builtUrls()?.get(LOADER_ENTRY) ?? '/cl-loader.js'
      return `import { createHandler } from ${JSON.stringify(here('../server/handler'))}\n` +
        `export default createHandler(import.meta.glob('/src/pages/**/*.clarus'), { loaderUrl: ${JSON.stringify(loaderUrl)} })\n`
    },
    transform: {
      filter: { id: /\.clarus(\?|$)/ },
      handler(code, id) {
        const file = id.replace(/\?.*$/, '')
        // ?render: a component's server render function, used in the browser to render children of islands.
        const target = this.environment.config.consumer === 'server' || /[?&]render\b/.test(id) ? 'server' : 'client'
        // ponytail: ?import makes Vite's dev transform middleware serve .clarus as JS for the loader's dynamic import; build output uses hashed chunk URLs from the client manifest (stage 3)
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
          return { code: compile(code, { file, target, clientUrl }).code, map: null }
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
        const url = decodeURIComponent((req.url ?? '/').split('?')[0]!)
        const inBase = url === base.slice(0, -1) ? '/' : url.startsWith(base) ? '/' + url.slice(base.length) : undefined
        if (inBase !== undefined) {
          // A built page wins; anything else (assets, /x.css) falls through to Vite's static files.
          const file = resolve(outDir, `.${inBase.replace(/\/?$/, '/')}index.html`)
          if (file.startsWith(outDir) && existsSync(file)) req.url = base + file.slice(outDir.length + 1).replace(/\\/g, '/')
        }
        next()
      })
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
