// The project index: every .tscl file under a workspace folder, and Markdown pages' @import lines; how each import
// resolves (as the build does: relative paths, ~/, tsconfig paths, package specifiers); who imports what; and each
// component's interface from the compiler's parser (the last good parse, while a file is being typed).
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve, sep } from 'node:path'
import type { ParsedFile } from 'clarusjs/compiler'
import type { Compiler } from './compiler.ts'

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
  private paths: [string, string[]][] | undefined

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
    for (const path of walk(this.root)) this.update(path, readFileSync(path, 'utf8'))
  }

  files(): string[] {
    return [...this.texts.keys()]
  }

  /** A file's current text (an open buffer, or what was read). */
  textOf(path: string): string | undefined {
    return this.texts.get(path)
  }

  update(path: string, text: string): void {
    this.texts.set(path, text)
    this.imports.set(path, [...text.matchAll(IMPORT)].map((m) => {
      const start = m.index! + m[0].length - m[3]!.length - 1
      const nameStart = m.index! + /^[ \t]*@import[ \t]+/.exec(m[0])![0].length
      return { name: m[1]!, nameStart, specifier: m[3]!, target: this.resolve(m[3]!, path), start, end: start + m[3]!.length }
    }))
    if (path.endsWith('.tscl')) {
      try { this.parsed.set(path, this.compiler.parse(text, path)) } catch {} // a file being typed: keep the last good parse
    }
  }

  remove(path: string): void {
    this.texts.delete(path)
    this.imports.delete(path)
    this.parsed.delete(path)
  }

  importsOf(path: string): Import[] {
    return this.imports.get(path) ?? []
  }

  /** A component's interface (its last good parse), read from disk when it isn't indexed (a package's). */
  componentAt(path: string): ParsedFile | undefined {
    if (!this.parsed.has(path) && !this.texts.has(path) && existsSync(path)) this.update(path, readFileSync(path, 'utf8'))
    return this.parsed.get(path)
  }

  importersOf(target: string): string[] {
    return [...this.imports].filter(([, list]) => list.some((i) => i.target === target)).map(([path]) => path)
  }

  /** Where `specifier`, imported by `from`, leads: relative, ~/ (src/), tsconfig paths, then a package. */
  resolve(specifier: string, from: string): string | undefined {
    if (specifier.startsWith('./') || specifier.startsWith('../')) return resolve(dirname(from), specifier)
    if (specifier.startsWith('~/')) return resolve(this.root, 'src', specifier.slice(2))
    if (specifier.startsWith('/')) return resolve(this.root, specifier.slice(1))
    this.paths ??= Object.entries((readJsonc(join(this.root, 'tsconfig.json'))?.compilerOptions?.paths ?? {}) as Record<string, string[]>)
    for (const [pattern, targets] of this.paths) {
      const star = pattern.indexOf('*')
      const head = star === -1 ? pattern : pattern.slice(0, star)
      const tail = star === -1 ? '' : pattern.slice(star + 1)
      if (star === -1 ? specifier !== pattern : !(specifier.startsWith(head) && specifier.endsWith(tail))) continue
      const middle = star === -1 ? '' : specifier.slice(head.length, specifier.length - tail.length)
      for (const target of targets) {
        const path = resolve(this.root, target.replace('*', middle))
        if (existsSync(path)) return path
      }
    }
    try { return createRequire(from).resolve(specifier) } catch { return undefined }
  }

  /** Does the nearest tsconfig.json (up to the root) run the clarusjs content mapper? */
  mapperConfigured(path: string): boolean {
    for (let dir = dirname(path); ; dir = dirname(dir)) {
      const config = join(dir, 'tsconfig.json')
      if (existsSync(config)) return (readJsonc(config)?.contentMappers ?? []).some((m: { package?: string }) => m.package === 'clarusjs')
      if (dir === this.root || dir === dirname(dir) || relative(this.root, dir).startsWith('..')) return false
    }
  }
}
