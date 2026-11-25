// The project index: every .tscl file under a workspace folder, and Markdown pages' @import lines; how each import
// resolves (as the build does: relative paths, ~/, tsconfig paths, package specifiers); who imports what; and each
// component's interface from the compiler's parser (the last good parse, while a file is being typed).
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { componentIndex, type ComponentNames, type ParsedFile } from 'clarusjs/compiler'
import { projectAliases, resolveAlias, type Alias } from '../../clarusjs/src/vite/aliases.ts' // the build's own rules, bundled
import { blankFences, blankOut, scan } from './blank.ts'
import type { Compiler } from './compiler.ts'
import type { Formatter } from './format.ts'

/** An @import: its name (nameStart..nameStart+name.length) and specifier (start..end, without quotes). */
export type Import = { name: string; nameStart: number; specifier: string; target?: string; start: number; end: number }

const IGNORED = new Set(['node_modules', 'dist', '.clarusjs', '.git'])
// `@import name from 'spec'` at the start of a line (indented too); start/end are the specifier's, without quotes.
const IMPORT = /^[ \t]*@import[ \t]+([A-Za-z_$][\w$-]*)[ \t]+from[ \t]+(['"])([^'"\n]+)\2/gm

/** A tsconfig.json's object, with // and /* comments and trailing commas allowed. */
function readJsonc(path: string): any {
  try {
    const text = readFileSync(path, 'utf8').replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m, str) => str ?? '').replace(/,(\s*[}\]])/g, '$1')
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

export class Project {
  private texts = new Map<string, string>()
  private imports = new Map<string, Import[]>()
  private parsed = new Map<string, ParsedFile>()
  private aliases: Alias[] | undefined
  private mapperCache = new Map<string, boolean>()

  /** Format Document: the project's Prettier with the plugin (trusted, and both installed), else none. */
  format: Formatter | undefined

  constructor(readonly root: string, readonly compiler: Compiler) {}

  /** Index every .tscl file under the root, and Markdown files under a src/pages folder. */
  async load(): Promise<void> {
    const walk = (dir: string): string[] => {
      let entries: import('node:fs').Dirent[] = []
      try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return [] }
      return entries.flatMap((e) => {
        const path = join(dir, e.name)
        if (e.isDirectory()) return IGNORED.has(e.name) ? [] : walk(path)
        if (e.name.endsWith('.tscl')) return [path]
        if (e.name.endsWith('.md') && path.includes(`${sep}src${sep}pages${sep}`)) return [path]
        return []
      })
    }
    for (const path of walk(this.root)) {
      try { this.update(path, readFileSync(path, 'utf8')) } catch {} // unreadable (a dangling symlink): skipped
    }
  }

  files(): string[] {
    return [...this.texts.keys()]
  }

  /** A file's current text (an open buffer, or what was read). */
  textOf(path: string): string | undefined {
    return this.texts.get(path)
  }

  update(path: string, text: string): void {
    if (this.texts.get(path) === text) return // unchanged: nothing to parse again
    this.texts.set(path, text)
    // Only real @import lines, blanked (same length) elsewhere: Markdown code samples; a template's {{-- --}}
    // comments and <script>/<style> bodies.
    const source = path.endsWith('.md') ? blankFences(text) : blankOut(text, [
      ...[...text.matchAll(/\{\{--[\s\S]*?(--\}\}|$)/g)].map((m): [number, number] => [m.index!, m.index! + m[0].length]),
      ...scan(text).scripts,
      ...scan(text).styles,
    ])
    this.imports.set(path, [...source.matchAll(IMPORT)].map((m) => {
      const start = m.index! + m[0].length - m[3]!.length - 1
      const nameStart = m.index! + /^[ \t]*@import[ \t]+/.exec(m[0])![0].length
      return { name: m[1]!, nameStart, specifier: m[3]!, target: this.resolve(m[3]!, path), start, end: start + m[3]!.length }
    }))
    if (path.endsWith('.tscl')) {
      try { this.parsed.set(path, this.compiler.parse(text, path)) } catch {} // a file being typed: keep the last good parse
    }
  }

  /** Back to the file on disk (an edited buffer closed without saving), or out of the index if it's gone. */
  restore(path: string): void {
    if (existsSync(path)) this.update(path, readFileSync(path, 'utf8'))
    else this.remove(path)
  }

  /** A tsconfig.json or jsconfig.json changed: forget cached answers and resolve the indexed imports again. */
  forgetConfig(): void {
    this.mapperCache.clear()
    this.aliases = undefined
    for (const [path, list] of this.imports) for (const i of list) i.target = this.resolve(i.specifier, path)
  }

  remove(path: string): void {
    this.texts.delete(path)
    this.imports.delete(path)
    this.parsed.delete(path)
  }

  /** Explicit @imports, then the components a template can use by name (#458) that the file doesn't import itself. */
  importsOf(path: string): Import[] {
    const own = this.imports.get(path) ?? []
    if (!path.endsWith('.tscl')) return own
    const named = new Set(own.map((i) => i.name))
    const auto = Object.entries(this.componentNames())
      .filter((e): e is [string, string] => typeof e[1] === 'string' && !named.has(e[0]))
      .map(([name, specifier]): Import => ({ name, nameStart: -1, specifier, target: specifier.startsWith('/') ? resolve(this.root, specifier.slice(1)) : this.resolve(specifier, path), start: -1, end: -1 }))
    return [...own, ...auto]
  }

  /**
   * The automatic component names (#458), as the build names them: kebab-case files under the config's
   * `components.dirs` (src/components and src/layouts by default).
   */
  componentNames(): ComponentNames {
    // From .clarusjs/components.json, which the plugin and `clarusjs check` write (the editor doesn't run the Vite
    // config): the folders, and the libraries' names. The app's own come from its files, so they're never stale.
    let written: { dirs?: unknown; names?: unknown } | undefined
    try { written = JSON.parse(readFileSync(resolve(this.root, '.clarusjs/components.json'), 'utf8')) as typeof written } catch {}
    const dirs = Array.isArray(written?.dirs) && written.dirs.every((d) => typeof d === 'string') ? (written.dirs as string[]) : ['src/components', 'src/layouts']
    const files = [...this.texts.keys()].filter((p) => p.endsWith('.tscl')).map((p) => relative(this.root, p).split(sep).join('/'))
    const own = componentIndex(files, dirs).names
    // A tool writes it, but it may be stale or hand-edited: only names to package paths (one, or several) count.
    const pkg = (v: unknown) => typeof v === 'string' && !v.startsWith('/')
    const entries = written?.names && typeof written.names === 'object' ? Object.entries(written.names) : []
    const libraries: ComponentNames = Object.fromEntries(entries.filter(([, v]) => pkg(v) || (Array.isArray(v) && v.length > 0 && v.every(pkg))))
    return { ...libraries, ...own }
  }

  /** A component's interface (its last good parse), read from disk when it isn't indexed (a package's). */
  componentAt(path: string): ParsedFile | undefined {
    if (!this.parsed.has(path) && !this.texts.has(path) && existsSync(path)) this.update(path, readFileSync(path, 'utf8'))
    return this.parsed.get(path)
  }

  importersOf(target: string): string[] {
    return [...this.imports].filter(([, list]) => list.some((i) => i.target === target)).map(([path]) => path)
  }

  /**
   * Where `specifier`, imported by `from`, leads, as the build reads it: relative, /-rooted, the aliases (~/ and
   * tsconfig/jsconfig paths with baseUrl, the most specific first), then a package.
   * ponytail: Vite's own resolve.alias entries aren't read (that needs the Vite config loaded).
   */
  resolve(specifier: string, from: string): string | undefined {
    if (specifier.startsWith('./') || specifier.startsWith('../')) return resolve(dirname(from), specifier)
    if (specifier.startsWith('/')) return resolve(this.root, specifier.slice(1))
    const aliased = resolveAlias(specifier, (this.aliases ??= projectAliases(this.root)))
    if (aliased) return resolve(aliased)
    try { return createRequire(from).resolve(specifier) } catch { return undefined }
  }

  /** Does the nearest tsconfig.json (up to the root) run the clarusjs content mapper? */
  mapperConfigured(path: string): boolean {
    const start = dirname(path)
    const cached = this.mapperCache.get(start)
    if (cached !== undefined) return cached
    let answer = false
    for (let dir = start; ; dir = dirname(dir)) {
      const config = join(dir, 'tsconfig.json')
      if (existsSync(config)) { answer = (readJsonc(config)?.contentMappers ?? []).some((m: { package?: string }) => m.package === 'clarusjs'); break }
      if (dir === this.root || dir === dirname(dir) || relative(this.root, dir).startsWith('..')) break
    }
    this.mapperCache.set(start, answer)
    return answer
  }
}

/** The project a file belongs to: the deepest workspace folder holding it, else the loose one. */
export function pickProject(projects: Project[], path: string, loose: Project): Project {
  let best: Project | undefined
  for (const p of projects) if ((path === p.root || path.startsWith(p.root + sep)) && (!best || p.root.length > best.root.length)) best = p
  return best ?? loose
}
