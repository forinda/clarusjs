// `clarusjs check`: type-check every .tscl file in a project (and the .ts it uses) with the project's TypeScript,
// reporting each error at file.tscl:line:col.
import { COMPONENT_DIRS, componentIndex } from '../compiler/components.ts'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, dirname, relative, resolve, sep } from 'node:path'
import { ClarusError } from '../compiler/errors.ts'
import { lint, type LintConfig, type LintRuleDef } from '../compiler/lint.ts'
import { checkIcons } from '../compiler/icon.ts'
import { parse } from '../compiler/parse.ts'
import { resolveIcon } from '../icons.ts'
import { generateTs, routesDeclaration, toSourceOffset, viewsDeclaration, type Mapping } from '../check/generate.ts'
import { findClarusFiles, reachableComponents } from '../vite/build.ts'
import { projectAliases, resolveAlias } from '../vite/aliases.ts'
import { routeFromFile } from '../server/handler.ts'

/** A type error, a template error, or a lint finding (#304: `code` is the rule, usually a warning). */
export type Diagnostic = { file: string; line: number; column: number; severity: 'error' | 'warning'; code: string; message: string }
export type CheckResult = { diagnostics: Diagnostic[]; exitCode: 0 | 1; text: string; json: string }

const VIRTUAL = '.clarusjs/virtual'
const posix = (path: string) => path.split(sep).join('/')

/** The package a component outside the app belongs to: its name and folder (from the nearest package.json). */
function packageInfo(file: string): { name: string; dir: string } {
  for (let dir = dirname(file); dir !== dirname(dir); dir = dirname(dir)) {
    const json = resolve(dir, 'package.json')
    if (existsSync(json)) return { name: JSON.parse(readFileSync(json, 'utf8')).name ?? basename(dir), dir }
  }
  return { name: '_', dir: dirname(file) }
}

/** Line and column (1-based) of an offset in `text`. */
function position(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, offset)
  return { line: before.split('\n').length, column: offset - before.lastIndexOf('\n') }
}

/**
 * Where an offset in a page source's generated .tscl text is in the source file itself. Component tags and their
 * expressions pass through a page source (such as Markdown) as written, so the element tag around the offset, or its
 * line, is found in the source; it must occur there once. Null when it can't be placed.
 */
function inSource(original: string, converted: string, offset: number): number | null {
  const tag = [converted.lastIndexOf('<', offset), converted.indexOf('>', offset) + 1]
  const line = [converted.lastIndexOf('\n', offset - 1) + 1, converted.indexOf('\n', offset) === -1 ? converted.length : converted.indexOf('\n', offset)]
  for (const [a, b] of [tag, line] as [number, number][]) {
    if (a < 0 || b <= offset || b - a < 3) continue
    const snippet = converted.slice(a, b)
    const at = original.indexOf(snippet)
    if (at !== -1 && original.indexOf(snippet, at + 1) === -1) return at + (offset - a)
  }
  return null
}

/** A page's .load.ts that exports load(), as an import specifier: what it returns is checked against the inputs. */
export function loaderOf(path: string): string | undefined {
  const loaderPath = path.replace(/\.[^./]+$/, '.load.ts')
  const hasLoad = existsSync(loaderPath) && /export\s+(async\s+)?function\s+load\b|export\s+(const|let)\s+load\b/.test(readFileSync(loaderPath, 'utf8'))
  return hasLoad ? `./${basename(loaderPath)}` : undefined
}

/** Where the project's TypeScript lives (overridable for tests and monorepos). */
function typescriptDir(root: string, override?: string): string {
  if (override) return override
  return dirname(createRequire(resolve(root, 'package.json')).resolve('typescript/package.json'))
}

/** A page source, as the Vite plugin's `sources` option takes it (Markdown from @clarusjs/content, …). */
export type CheckSource = { extension: string; toTscl(code: string, file: string, context: { route: string; root: string; addDependency(file: string): void }): string }

/** `lint`: the plugin's rule levels; `lintRules`: the project's own rules; `strict`: warnings fail too. */
export function check(options: { root: string; typescript?: string; sources?: CheckSource[]; viteAliases?: unknown; lint?: LintConfig; lintRules?: LintRuleDef[]; strict?: boolean; components?: { dirs?: string[]; auto?: boolean } }): CheckResult {
  const root = resolve(options.root)
  // Automatic component imports (#458), named as the plugin names them.
  const names = options.components?.auto === false ? undefined : componentIndex(findClarusFiles(resolve(root, 'src'), ['.tscl']).map((f) => posix(relative(root, f))), options.components?.dirs ?? COMPONENT_DIRS).names
  const virtualRoot = resolve(root, VIRTUAL)
  rmSync(virtualRoot, { recursive: true, force: true })
  const diagnostics: Diagnostic[] = []
  // `source`: the .tscl text checked; `original`: the file's own text, when a page source converted it.
  const generated = new Map<string, { file: string; source: string; original?: string; code: string; mappings: Mapping[]; loaderSpan?: [number, number]; fromPackage?: boolean }>()
  const sources = options.sources ?? []
  const aliases = projectAliases(root, options.viteAliases)
  // Every .tscl file, and the page sources' files under src/pages (elsewhere they are plain files, as in the build).
  const pageFiles = findClarusFiles(resolve(root, 'src'), ['.tscl', ...sources.map((x) => x.extension)])
    .filter((f) => f.endsWith('.tscl') || f.startsWith(resolve(root, 'src/pages') + sep))
  const views: { file: string; source: string }[] = []

  for (const path of pageFiles) {
    const file = posix(relative(root, path))
    const original = readFileSync(path, 'utf8')
    const src = sources.find((x) => path.endsWith(x.extension))
    let source = original
    try {
      if (src) source = src.toTscl(original, path, { route: routeFromFile(`/${file}`), root, addDependency: () => {} })
    } catch (err) {
      diagnostics.push({ file, line: 1, column: 1, severity: 'error', code: 'clarus', message: (err as Error).message })
      continue
    }
    views.push({ file, source })
    // Lint (#304): .tscl files only, a page source's generated text isn't what its author wrote. A syntax error is
    // reported once, below.
    if (!src) {
      try {
        for (const m of lint(source, file, options.lint, options.lintRules)) diagnostics.push({ file, line: m.line, column: m.column, severity: m.severity, code: m.rule, message: m.message })
      } catch {}
    }
    // A compile error where its author wrote it: a page source's is placed in the source file when its text is found.
    const located = (err: ClarusError): void => {
      const message = err.message.slice(`${err.file}:${err.line}:${err.column} `.length)
      const lines = source.split('\n')
      const at = src ? inSource(original, source, lines.slice(0, err.line - 1).reduce((n, l) => n + l.length + 1, 0) + err.column - 1) : null
      diagnostics.push({ file, ...(src ? (at === null ? { line: 1, column: 1 } : position(original, at)) : { line: err.line, column: err.column }), severity: 'error', code: 'clarus', message })
    }
    try {
      const loader = loaderOf(path)
      const { code, mappings, loaderSpan } = generateTs(source, file, { ...(loader ? { loader } : {}), components: names })
      const vpath = resolve(virtualRoot, `${file}.ts`)
      mkdirSync(dirname(vpath), { recursive: true })
      writeFileSync(vpath, code)
      generated.set(vpath, { file, source, code, mappings, loaderSpan, ...(src ? { original } : {}) })
    } catch (err) {
      if (!(err instanceof ClarusError)) throw err
      located(err)
    }
    // <icon> names, against the sets installed for this package (a template error was reported above).
    try {
      for (const err of checkIcons(parse(source, file), file, source, (name) => resolveIcon(name, path))) located(err)
    } catch {}
  }

  // Components from packages: a virtual file each (mirroring the package's folders, so their imports of each other
  // resolve), with their other relative imports made absolute, so they reach the real files. Their own errors are
  // the package's; what's checked is how the app uses them (paths below map each package specifier to its file).
  const appRoot = realpathSync(root)
  const paths: Record<string, string[]> = {}
  const virtualOf = new Map<string, string>()
  // The text each file is checked as, by real path (a symlinked root gives real paths here): a page source's
  // generated .tscl, with the imports its conversion adds.
  const converted = new Map(views.map((v) => [realpathSync(resolve(root, v.file)), v.source]))
  const textOf = (p: string) => converted.get(realpathSync(p)) ?? readFileSync(p, 'utf8')
  const components = reachableComponents(root, pageFiles, textOf, ['.tscl'], aliases)
  for (const path of components.filter((p) => !p.startsWith(resolve(appRoot, 'src') + sep))) {
    const pkg = packageInfo(path)
    const vpath = resolve(virtualRoot, '_pkg', pkg.name, `${relative(pkg.dir, path)}.ts`)
    virtualOf.set(path, vpath)
    const source = readFileSync(path, 'utf8').replace(/^(@import\b.*?\bfrom\s+)(['"])(\.{1,2}\/[^'"]*)\2/gm, (all, head: string, q: string, spec: string) =>
      spec.endsWith('.tscl') ? all : `${head}${q}${posix(resolve(dirname(path), spec))}${q}`)
    try {
      const { code, mappings } = generateTs(source, posix(relative(root, path)))
      mkdirSync(dirname(vpath), { recursive: true })
      writeFileSync(vpath, code)
      generated.set(vpath, { file: posix(relative(root, path)), source, code, mappings, fromPackage: true })
    } catch (err) {
      if (!(err instanceof ClarusError)) throw err // a package's own template errors are its own
    }
  }
  const require = createRequire(resolve(root, 'package.json'))
  for (const path of components) {
    for (const m of textOf(path).matchAll(/^@import\s+[A-Za-z_$][\w-]*\s+from\s+(['"])([^'"./][^'"]*\.tscl)\1/gm)) {
      try {
        // An alias (~/, tsconfig paths, resolve.alias) first, as the build resolves it; then a package.
        const file = realpathSync(resolveAlias(m[2]!, aliases) ?? require.resolve(m[2]!))
        // A package's (or an outside folder's) component, or one of this project's own .tscl files.
        const target = virtualOf.get(file) ?? (file.startsWith(appRoot + sep) ? resolve(virtualRoot, `${relative(appRoot, file)}.ts`) : undefined)
        if (target) paths[`${m[2]}.ts`] = [`./${posix(relative(resolve(root, '.clarusjs'), target))}`]
      } catch {} // an unresolvable import is reported by the template compiler
    }
  }

  // Path aliases (~/, tsconfig/jsconfig paths), as the build resolves them: each to the real folder, then to its
  // mirror of generated template files (a component import resolves to its .tscl.ts there). They replace the
  // project's own paths, which `paths` here would hide (TypeScript doesn't merge them).
  const fromCheck = (path: string) => { const rel = posix(relative(resolve(root, '.clarusjs'), path)); return rel.startsWith('.') ? rel : `./${rel}` }
  // Root paths ('/src/layouts/docs.tscl'), which Vite resolves from the project root.
  paths['/*'] = ['../*', './virtual/*']
  for (const alias of aliases) {
    const mirror = resolve(virtualRoot, relative(root, alias.replacement))
    const targets = (tail: string) => [fromCheck(alias.replacement) + tail, fromCheck(mirror) + tail].map((p) => p.replace(/\/\/\*$/, '/*'))
    // A prefix ('~/'), an exact key, or (a Vite alias) the key itself and anything under it.
    if (alias.find.endsWith('/')) paths[`${alias.find}*`] = targets('/*')
    else {
      paths[alias.find] = targets('')
      if (!alias.exact) paths[`${alias.find}/*`] = targets('/*')
    }
  }

  // The view registry: every view's name → its inputs, so render(name, props) is checked. Declarations only, so apps
  // can add .clarusjs/views.d.ts to their own tsconfig's include and get the same types in their editor.
  mkdirSync(resolve(root, '.clarusjs'), { recursive: true })
  writeFileSync(resolve(root, '.clarusjs/views.d.ts'), viewsDeclaration(views))
  // The routes: every page → its params, so href() from clarusjs/navigation only takes real routes. Also for apps'
  // own tsconfig (add .clarusjs/routes.d.ts to include).
  const walk = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(resolve(dir, e.name)) : [resolve(dir, e.name)])) : [])
  writeFileSync(resolve(root, '.clarusjs/routes.d.ts'), routesDeclaration(walk(resolve(root, 'src/pages')).map((path) => posix(relative(root, path)))))

  // The project's own settings, plus what checking templates needs. Scripts are JavaScript, so untyped parameters
  // are expected (noImplicitAny off). rootDirs lets virtual files and real sources import each other.
  // A JavaScript project's jsconfig.json counts like a tsconfig.json.
  const own = ['tsconfig.json', 'jsconfig.json'].find((name) => existsSync(resolve(root, name)))
  const hasConfig = own !== undefined
  const config = {
    ...(hasConfig ? { extends: `../${own}` } : {}),
    compilerOptions: {
      ...(hasConfig ? {} : { strict: true, target: 'ES2023', module: 'ESNext', moduleResolution: 'Bundler', lib: ['ES2023', 'DOM', 'DOM.Iterable'] }),
      noEmit: true,
      allowImportingTsExtensions: true,
      noImplicitAny: false,
      skipLibCheck: true,
      rootDirs: ['..', './virtual'],
      paths,
    },
    include: ['../src', './virtual', './views.d.ts', './routes.d.ts'],
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
    // Errors inside a package (its components or its .ts files) are the package's, not the app's.
    if (g?.fromPackage || (!g && (!resolve(path).startsWith(resolve(root) + sep) || path.includes(`${sep}node_modules${sep}`)))) continue
    if (!g) {
      diagnostics.push({ file: posix(relative(root, path)), line: Number(m[2]), column: Number(m[3]), severity: 'error', code: m[4]!, message: m[5]! })
      continue
    }
    const lines = g.code.split('\n')
    const offset = lines.slice(0, Number(m[2]) - 1).reduce((n, l) => n + l.length + 1, 0) + Number(m[3]) - 1
    let source = toSourceOffset(g.mappings, offset)
    // A page source: from its generated .tscl text back to the file's own text.
    if (source !== null && g.original !== undefined) source = inSource(g.original, g.source, source)
    const at = source === null ? { line: 1, column: 1 } : position(g.original ?? g.source, source)
    const fromLoader = g.loaderSpan && offset >= g.loaderSpan[0] && offset < g.loaderSpan[1]
    const message = fromLoader ? `load() returns a value that doesn't fit this page's inputs: ${m[5]}` : source === null ? `${m[5]} (in generated code)` : m[5]!
    diagnostics.push({ file: g.file, ...at, severity: 'error', code: m[4]!, message })
  }

  diagnostics.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column)
  return {
    diagnostics,
    exitCode: diagnostics.some((d) => d.severity === 'error' || options.strict) ? 1 : 0,
    text: diagnostics.map((d) => `${d.file}:${d.line}:${d.column} ${d.severity} ${d.code}: ${d.message}`).join('\n'),
    json: JSON.stringify(diagnostics, null, 2),
  }
}
