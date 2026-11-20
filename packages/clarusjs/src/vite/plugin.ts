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
    if (!existsSync(manifestFile)) return undefined
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
      if (env.command !== 'build') return config
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
        ssr: { build: { outDir: SERVER_OUT, rolldownOptions: { input: { index: ENTRY } } } },
      }
      return config
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
      await prerender(resolve(builder.config.root, SERVER_OUT, 'index.js'), resolve(builder.config.root, CLIENT_OUT))
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
        const target = this.environment.config.consumer === 'server' ? 'server' : 'client'
        // ponytail: ?import makes Vite's dev transform middleware serve .clarus as JS for the loader's dynamic import; build output uses hashed chunk URLs from the client manifest (stage 3)
        const urls = target === 'server' ? builtUrls() : undefined
        const clientUrl = urls ? urls.get(entryName(root, file)) : clientUrlFor(root, file)
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
