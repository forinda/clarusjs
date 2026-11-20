// `clarusjs check`: type-check every .clarus file in a project (and the .ts it uses) with the project's TypeScript,
// reporting each error at file.clarus:line:col.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, relative, resolve, sep } from 'node:path'
import { ClarusError } from '../compiler/errors.ts'
import { generateTs, toSourceOffset, type Mapping } from '../check/generate.ts'
import { findClarusFiles } from '../vite/build.ts'

export type Diagnostic = { file: string; line: number; column: number; code: string; message: string }
export type CheckResult = { diagnostics: Diagnostic[]; exitCode: 0 | 1; text: string; json: string }

const VIRTUAL = '.clarusjs/virtual'
const posix = (path: string) => path.split(sep).join('/')

/** Line and column (1-based) of an offset in `text`. */
function position(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, offset)
  return { line: before.split('\n').length, column: offset - before.lastIndexOf('\n') }
}

/** Where the project's TypeScript lives (overridable for tests and monorepos). */
function typescriptDir(root: string, override?: string): string {
  if (override) return override
  return dirname(createRequire(resolve(root, 'package.json')).resolve('typescript/package.json'))
}

export function check(options: { root: string; typescript?: string }): CheckResult {
  const root = resolve(options.root)
  const virtualRoot = resolve(root, VIRTUAL)
  rmSync(virtualRoot, { recursive: true, force: true })
  const diagnostics: Diagnostic[] = []
  const generated = new Map<string, { file: string; source: string; code: string; mappings: Mapping[] }>()

  for (const path of findClarusFiles(resolve(root, 'src'))) {
    const file = posix(relative(root, path))
    const source = readFileSync(path, 'utf8')
    try {
      const { code, mappings } = generateTs(source, file)
      const vpath = resolve(virtualRoot, `${file}.ts`)
      mkdirSync(dirname(vpath), { recursive: true })
      writeFileSync(vpath, code)
      generated.set(vpath, { file, source, code, mappings })
    } catch (err) {
      if (!(err instanceof ClarusError)) throw err
      const message = err.message.slice(`${err.file}:${err.line}:${err.column} `.length)
      diagnostics.push({ file, line: err.line, column: err.column, code: 'clarus', message })
    }
  }

  // The project's own settings, plus what checking templates needs. Scripts are JavaScript, so untyped parameters
  // are expected (noImplicitAny off). rootDirs lets virtual files and real sources import each other.
  const hasConfig = existsSync(resolve(root, 'tsconfig.json'))
  const config = {
    ...(hasConfig ? { extends: '../tsconfig.json' } : {}),
    compilerOptions: {
      ...(hasConfig ? {} : { strict: true, target: 'ES2023', module: 'ESNext', moduleResolution: 'Bundler', lib: ['ES2023', 'DOM', 'DOM.Iterable'] }),
      noEmit: true,
      allowImportingTsExtensions: true,
      noImplicitAny: false,
      skipLibCheck: true,
      rootDirs: ['..', './virtual'],
    },
    include: ['../src', './virtual'],
  }
  const configPath = resolve(root, '.clarusjs/tsconfig.check.json')
  mkdirSync(dirname(configPath), { recursive: true })
  writeFileSync(configPath, JSON.stringify(config, null, 2))

  const tsDir = typescriptDir(root, options.typescript)
  const bin = JSON.parse(readFileSync(resolve(tsDir, 'package.json'), 'utf8')).bin
  const tsc = resolve(tsDir, typeof bin === 'string' ? bin : bin.tsc)
  const run = spawnSync(process.execPath, [tsc, '-p', configPath, '--pretty', 'false'], { cwd: root, encoding: 'utf8' })

  for (const line of `${run.stdout}\n${run.stderr}`.split('\n')) {
    const m = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/.exec(line.trim())
    if (!m) continue
    const path = resolve(root, m[1]!)
    const g = generated.get(path)
    if (!g) {
      diagnostics.push({ file: posix(relative(root, path)), line: Number(m[2]), column: Number(m[3]), code: m[4]!, message: m[5]! })
      continue
    }
    const lines = g.code.split('\n')
    const offset = lines.slice(0, Number(m[2]) - 1).reduce((n, l) => n + l.length + 1, 0) + Number(m[3]) - 1
    const source = toSourceOffset(g.mappings, offset)
    const at = source === null ? { line: 1, column: 1 } : position(g.source, source)
    diagnostics.push({ file: g.file, ...at, code: m[4]!, message: source === null ? `${m[5]} (in generated code)` : m[5]! })
  }

  diagnostics.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column)
  return {
    diagnostics,
    exitCode: diagnostics.length ? 1 : 0,
    text: diagnostics.map((d) => `${d.file}:${d.line}:${d.column} error ${d.code}: ${d.message}`).join('\n'),
    json: JSON.stringify(diagnostics, null, 2),
  }
}
