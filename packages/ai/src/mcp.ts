// The clarusjs MCP server (#51): agents check their own work. Tools: check (type errors and lint), explain (where a
// built route's parts run), compile (one component, without a project), docs_search (clarusjs.com).
// MCP over stdio is newline-delimited JSON-RPC 2.0: written out here rather than with an SDK, so the package has no
// dependencies. https://modelcontextprotocol.io/specification
import { realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { relative, resolve, isAbsolute } from 'node:path'
import { compile, lint, ClarusError } from 'clarusjs/compiler'
import { runClarus } from './clarus.ts'
import { loadDocs, search } from './docs.ts'

const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'] // newest first
const INSTRUCTIONS = `Tools for clarusjs (.tscl components compiled to server HTML plus small islands). After writing or changing .tscl files, run check and fix what it reports before calling the work done: it type-checks templates and scripts and runs the template lint rules. Use compile to see what a component turns into (and whether it ships JavaScript), explain for where a built route's parts run, and docs_search to look up syntax and APIs.`

type Message = { jsonrpc: '2.0'; id?: number | string; method: string; params?: Record<string, unknown> }
type Result = { content: { type: 'text'; text: string }[]; isError?: boolean }
type Tool = { name: string; description: string; inputSchema: object; run(args: Record<string, unknown>): Result | Promise<Result> }

/** A tool call the server won't run, said to the agent as a tool error. */
class Refused extends Error {}

const reply = (text: string, isError = false): Result => ({ content: [{ type: 'text', text }], ...(isError ? { isError } : {}) })
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)

export type McpOptions = { cwd: string; fetch?: typeof fetch; cacheDir?: string }

/** The server's message handler: a request's response, or undefined for a notification. */
export function createMcp(options: McpOptions): { handle(message: Message): Promise<object | undefined> } {
  // `root` comes from the agent (so possibly from text it read): only a folder inside the server's own, by real path, so
  // .. and symlinks can't lead out. The clarusjs that runs is always the server folder's.
  const rootOf = (args: Record<string, unknown>): string => {
    const base = realpathSync(options.cwd)
    let root: string
    try { root = realpathSync(resolve(base, str(args.root) ?? '.')) } catch { throw new Refused(`root ${String(args.root)} doesn't exist`) }
    const rel = relative(base, root)
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Refused(`root ${String(args.root)} is outside the server's folder (${base})`)
    return root
  }
  const cacheDir = options.cacheDir ?? resolve(homedir(), '.cache', 'clarusjs')
  let docs: Promise<string> | undefined

  const tools: Tool[] = [
    {
      name: 'check',
      description: 'Type-check and lint the clarusjs project (every .tscl file and page, and the .ts they use): errors and warnings at file:line:col, as `clarusjs check` reports them. Run it after editing.',
      inputSchema: { type: 'object', properties: { root: { type: 'string', description: "The project's folder, inside the server's folder (default: the server's folder)" } } },
      run(args) {
        const run = runClarus(['check', rootOf(args), '--json'], options.cwd)
        let diagnostics: { file: string; line: number; column: number; severity: string; code: string; message: string }[]
        try { diagnostics = JSON.parse(run.stdout) } catch { return reply(run.stderr || run.stdout || 'clarusjs check failed', true) }
        if (!diagnostics.length) return reply('No errors.')
        const lines = diagnostics.map((d) => `${d.file}:${d.line}:${d.column} ${d.severity} ${d.code}: ${d.message}`)
        const errors = diagnostics.filter((d) => d.severity === 'error').length
        return reply(`${lines.join('\n')}\n\n${errors} errors, ${diagnostics.length - errors} warnings`, errors > 0)
      },
    },
    {
      name: 'explain',
      description: "Where each part of a built route runs: rendering (build, server, browser), data, islands with their size and attach mode, JavaScript and CSS. Needs `vite build` first. Without a route, lists the routes.",
      inputSchema: { type: 'object', properties: { route: { type: 'string', description: 'A route such as /guide/intro' }, root: { type: 'string', description: "The project's folder, inside the server's folder" } } },
      run(args) {
        const run = runClarus(['explain', ...(str(args.route) ? [str(args.route)!] : []), '--root', rootOf(args)], options.cwd)
        return run.status ? reply(run.stderr.trim() || run.stdout.trim(), true) : reply(run.stdout.trim())
      },
    },
    {
      name: 'compile',
      description: "Compile one .tscl component without a project: whether it is an island (ships JavaScript), its server and client output, compile warnings and template lint findings. A mistake comes back as an error at file:line:col.",
      inputSchema: { type: 'object', properties: { source: { type: 'string', description: 'The .tscl text' }, file: { type: 'string', description: 'Its path, for messages (default component.tscl)' } }, required: ['source'] },
      run(args) {
        const source = str(args.source) ?? ''
        const file = str(args.file) ?? 'component.tscl'
        try {
          const server = compile(source, { file, target: 'server', clientUrl: `/${file}?import` }) // the island's chunk URL, as in dev
          const client = compile(source, { file, target: 'client' })
          const notes = [
            ...client.warnings.map((w) => `${w.message.replace(/^(\S+:\d+:\d+) /, '$1 warning: ')}`),
            ...lint(source, file).map((m) => `${file}:${m.line}:${m.column} ${m.severity} ${m.rule}: ${m.message}`),
          ]
          return reply([
            `island: ${client.stateful ? 'yes (ships JavaScript)' : 'no (HTML only)'}`,
            notes.length ? notes.join('\n') : 'No warnings.',
            `--- server module ---\n${server.code}`,
            ...(client.stateful ? [`--- client module ---\n${client.code}`] : []),
          ].join('\n\n'))
        } catch (err) {
          if (err instanceof ClarusError) return reply(err.message, true)
          throw err
        }
      },
    },
    {
      name: 'docs_search',
      description: 'Search the clarusjs docs (clarusjs.com): template syntax, islands, signals, routing, data, forms, the CLI and Vite options. Returns the best sections with their URLs.',
      inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Words to look for, such as "@for track" or "load() cookies"' }, limit: { type: 'number', description: 'How many sections (default 5)' } }, required: ['query'] },
      async run(args) {
        docs ??= loadDocs(options.fetch ?? fetch, cacheDir)
        let full: string
        try { full = await docs } catch (err) { docs = undefined; return reply(`Couldn't load the docs: ${(err as Error).message}`, true) }
        const found = search(full, str(args.query) ?? '', typeof args.limit === 'number' ? args.limit : 5)
        if (!found.length) return reply('No matches. Try other words, or browse https://clarusjs.com/llms.txt.')
        return reply(found.map((s) => `${s.url}\n${s.text.trim().slice(0, 1500)}`).join('\n\n---\n\n'))
      },
    },
  ]

  return {
    async handle(message) {
      const { id, method, params = {} } = message
      if (id === undefined) return undefined // a notification
      const ok = (result: object) => ({ jsonrpc: '2.0', id, result })
      const fail = (code: number, text: string) => ({ jsonrpc: '2.0', id, error: { code, message: text } })
      if (method === 'initialize') {
        const asked = str(params.protocolVersion)
        return ok({
          protocolVersion: asked && VERSIONS.includes(asked) ? asked : VERSIONS[0],
          capabilities: { tools: {} },
          serverInfo: { name: 'clarusjs', version: '0.1.0' },
          instructions: INSTRUCTIONS,
        })
      }
      if (method === 'ping') return ok({})
      if (method === 'tools/list') return ok({ tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) })
      if (method === 'tools/call') {
        const tool = tools.find((t) => t.name === params.name)
        if (!tool) return fail(-32602, `Unknown tool: ${String(params.name)}`)
        try {
          return ok(await tool.run((params.arguments ?? {}) as Record<string, unknown>))
        } catch (err) {
          return ok(reply(err instanceof Refused ? err.message : `${tool.name} failed: ${(err as Error).message}`, true))
        }
      }
      return fail(-32601, `Method not found: ${method}`)
    },
  }
}

/** Serve over stdio: one JSON-RPC message per line in, one per line out. Logs go to stderr (stdout is the protocol). */
export function serveStdio(options: McpOptions): void {
  const server = createMcp(options)
  let buffer = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (chunk: string) => {
    buffer += chunk
    for (let i; (i = buffer.indexOf('\n')) >= 0; ) {
      const line = buffer.slice(0, i).trim()
      buffer = buffer.slice(i + 1)
      if (!line) continue
      let message: Message
      try { message = JSON.parse(line) } catch {
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n')
        continue
      }
      void server.handle(message).then((response) => { if (response) process.stdout.write(JSON.stringify(response) + '\n') })
    }
  })
}
