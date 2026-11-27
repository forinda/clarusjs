// A production server for any Node host (`clarusjs serve`, or serve() from clarusjs/node): dist/client's files,
// server routes through the built handler (dist/server/index.mjs), the headers in _headers, and the 404 page.
// No dependencies: node:http, and a table of content types.
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { canonical, headersFor, readHeaders } from '../vite/headers.ts'
import { acceptsEncoding, sendResponse, toRequest } from '../vite/node.ts'

const TEXT = 'charset=utf-8'
const TYPES: Record<string, string> = {
  '.html': `text/html; ${TEXT}`, '.js': `text/javascript; ${TEXT}`, '.mjs': `text/javascript; ${TEXT}`, '.css': `text/css; ${TEXT}`,
  '.json': `application/json; ${TEXT}`, '.map': `application/json; ${TEXT}`, '.webmanifest': `application/manifest+json; ${TEXT}`,
  '.txt': `text/plain; ${TEXT}`, '.md': `text/markdown; ${TEXT}`, '.xml': `application/xml; ${TEXT}`, '.svg': `image/svg+xml; ${TEXT}`,
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.wasm': 'application/wasm', '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg',
}
// Files the build leaves for hosts, not visitors (compared in lower case: some file systems ignore case).
const HIDDEN = new Set(['_headers', '_redirects'])

type App = { fetch(request: Request): Promise<Response>; isServerPath(pathname: string): boolean; base?: string }

/** @see https://clarusjs.com/guide/deploy#node */
export type ServeOptions = {
  /** The project folder (the one with dist/). Default: the current folder. */
  root?: string
  /** Default: $PORT, else 3000. 0 picks a free port. */
  port?: number
  /** Default: $HOST, else 0.0.0.0 (every interface, as a container needs). */
  host?: string
}

/**
 * The request listener for a built site, for your own `http.createServer()` (or a framework that takes one). Each
 * request: a file under dist/client (a page at `<path>/index.html`), else a server route or endpoint, else 404.html.
 * @example
 * const site = await createListener('.')
 * createServer((req, res) => (req.url === '/healthz' ? res.end('ok') : site(req, res))).listen(3000)
 * @see https://clarusjs.com/guide/deploy#node
 */
export async function createListener(root = '.'): Promise<(req: IncomingMessage, res: ServerResponse) => Promise<void>> {
  const client = resolve(root, 'dist/client')
  const entry = resolve(root, 'dist/server/index.mjs')
  if (!existsSync(client)) throw new Error(`clarusjs serve: no ${client}; run vite build first`)
  const app = existsSync(entry) ? ((await import(pathToFileURL(entry).href)) as { default: App }).default : undefined
  const base = app?.base ?? '/'
  const rules = readHeaders(client)

  // A file under dist/client: the path itself, else its page.
  const fileFor = (path: string): string | undefined => {
    for (const candidate of [path, `${path.replace(/\/?$/, '/')}index.html`]) {
      const file = resolve(client, `.${candidate}`)
      if (!file.startsWith(client + sep) || HIDDEN.has(file.slice(client.length + 1).toLowerCase())) continue
      if (existsSync(file) && statSync(file).isFile()) return file
    }
    return undefined
  }
  const withRules = (res: ServerResponse, pathname: string) => {
    for (const [name, value] of headersFor(rules, pathname)) if (!res.hasHeader(name)) res.setHeader(name, value)
  }
  function sendFile(req: IncomingMessage, res: ServerResponse, file: string, pathname: string, status = 200): void {
    const stat = statSync(file)
    const etag = `W/"${stat.size.toString(36)}-${stat.mtimeMs.toString(36)}"`
    res.setHeader('content-type', TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream')
    withRules(res, pathname)
    if (!res.hasHeader('cache-control')) res.setHeader('cache-control', 'no-cache') // revalidated by its ETag
    if (status === 200) {
      res.setHeader('etag', etag)
      if (req.headers['if-none-match'] === etag) {
        res.statusCode = 304
        return void res.end()
      }
    }
    // The build's .br / .gz copy (compress: true), when the client takes it.
    // ponytail: no Range requests (video seeking); a CDN in front, or add them when a site needs it.
    let body = file
    const copies = (['br', 'gzip'] as const).filter((enc) => existsSync(file + (enc === 'br' ? '.br' : '.gz')))
    if (copies.length) {
      res.setHeader('vary', 'Accept-Encoding')
      const pick = copies.find((enc) => acceptsEncoding(String(req.headers['accept-encoding'] ?? ''), enc))
      if (pick) {
        res.setHeader('content-encoding', pick)
        body = file + (pick === 'br' ? '.br' : '.gz')
      }
    }
    res.statusCode = status
    res.setHeader('content-length', statSync(body).size)
    if (req.method === 'HEAD') return void res.end()
    createReadStream(body).pipe(res)
  }

  return async (req, res) => {
    const bad = () => {
      res.statusCode = 400
      res.setHeader('content-type', `text/plain; ${TEXT}`)
      res.end('Bad Request: malformed URL')
    }
    // One path for everything: the file lookup, the _headers rules, the route check and the handler. Dot segments
    // (%2e too) resolved as browsers do, and runs of / collapsed, as the file system reads them; so /x/../admin/ and
    // //admin/ are /admin/, with /admin/*'s headers, wherever they go.
    const [raw, query] = (req.url ?? '/').split(/\?(.*)/s) as [string, string | undefined]
    let encoded: string
    let pathname: string
    try {
      // Prefixed, not resolved against a base: //x would be read as a host.
      encoded = new URL(raw.startsWith('/') ? `http://x${raw}` : raw).pathname.replace(/\/{2,}/g, '/')
      pathname = decodeURIComponent(encoded)
    } catch {
      return bad()
    }
    // Encoded slashes or backslashes that would make another path once decoded (/x/..%2fadmin): refused.
    if (canonical(pathname) !== pathname) return bad()
    // The base as sent (%64ocs isn't docs): stripped from the encoded path, then decoded with it.
    const inBaseEncoded = encoded === base.slice(0, -1) ? '/' : encoded.startsWith(base) ? '/' + encoded.slice(base.length) : undefined
    const inBase = inBaseEncoded === undefined ? undefined : decodeURIComponent(inBaseEncoded)
    const readable = req.method === 'GET' || req.method === 'HEAD'
    const file = inBase !== undefined && readable ? fileFor(inBase) : undefined
    if (file) return sendFile(req, res, file, pathname)
    if (app && inBase !== undefined && app.isServerPath(inBase)) {
      try {
        // The handler's routes are base-free, as in vite preview: the same path (still %-escaped), without the base.
        req.url = inBaseEncoded + (query === undefined ? '' : `?${query}`)
        const response = await app.fetch(toRequest(req))
        withRules(res, pathname)
        return await sendResponse(res, response)
      } catch (err) {
        console.error(err)
        res.statusCode = 500
        return void res.end()
      }
    }
    const notFound = fileFor('/404.html')
    if (notFound && readable) return sendFile(req, res, notFound, pathname, 404)
    res.statusCode = 404
    res.setHeader('content-type', `text/plain; ${TEXT}`)
    res.end('Not Found')
  }
}

/**
 * Serves a built site. Resolves once it listens.
 * @example
 * const server = await serve({ root: '.', port: 8080 })
 * @see https://clarusjs.com/guide/deploy#node
 */
export async function serve(options: ServeOptions = {}): Promise<Server> {
  const listener = await createListener(options.root)
  const server = createServer((req, res) => void listener(req, res))
  const port = options.port ?? Number(process.env.PORT ?? 3000)
  const host = options.host ?? process.env.HOST ?? '0.0.0.0'
  await new Promise<void>((done, fail) => server.once('error', fail).listen(port, host, done))
  return server
}
