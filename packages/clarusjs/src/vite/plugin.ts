// The clarusjs Vite plugin: a thin adapter around the compiler.
// Server environment gets render(), client environment gets attach(). Dev requests go through the fetch handler.
import { isAbsolute, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isRunnableDevEnvironment, type Plugin } from 'vite'
import { compile, ClarusError } from '../compiler/index.ts'
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

export default function clarusjs(): Plugin {
  let root = process.cwd()
  return {
    name: 'clarusjs',
    config: () => ({
      appType: 'custom',
      resolve: {
        alias: [
          { find: 'clarusjs/runtime/server', replacement: here('../runtime/server') },
          { find: 'clarusjs/runtime', replacement: here('../runtime/index') },
        ],
      },
    }),
    configResolved(config) { root = config.root },
    resolveId(id) {
      if (id === '/cl-loader.js') return here('../runtime/loader')
      if (id === ENTRY) return '\0' + ENTRY
    },
    load(id) {
      if (id !== '\0' + ENTRY) return
      return `import { createHandler } from ${JSON.stringify(here('../server/handler'))}\n` +
        `export default createHandler(import.meta.glob('/src/pages/**/*.clarus'))\n`
    },
    transform: {
      filter: { id: /\.clarus(\?|$)/ },
      handler(code, id) {
        const file = id.replace(/\?.*$/, '')
        const target = this.environment.config.consumer === 'server' ? 'server' : 'client'
        // ponytail: ?import makes Vite's dev transform middleware serve .clarus as JS for the loader's dynamic import; build output uses hashed chunk URLs from the client manifest (stage 3)
        const clientUrl = clientUrlFor(root, file)
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
