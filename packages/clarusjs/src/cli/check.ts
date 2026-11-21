// `clarusjs check`: type-check every .tscl file in a project (and the .ts it uses) with the project's TypeScript,
// reporting each error at file.tscl:line:col.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, dirname, relative, resolve, sep } from 'node:path'
import { ClarusError } from '../compiler/errors.ts'
import { generateTs, routesDeclaration, toSourceOffset, viewsDeclaration, type Mapping } from '../check/generate.ts'
import { findClarusFiles, reachableComponents } from '../vite/build.ts'
import { projectAliases } from '../vite/aliases.ts'

export type Diagnostic = { file: string; line: number; column: number; code: string; message: string }
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
  const generated = new Map<string, { file: string; source: string; code: string; mappings: Mapping[]; loaderSpan?: [number, number]; fromPackage?: boolean }>()

  for (const path of findClarusFiles(resolve(root, 'src'))) {
    const file = posix(relative(root, path))
    const source = readFileSync(path, 'utf8')
    try {
      // A page's .load.ts that exports load(): what it returns is checked against the page's inputs.
      const loaderPath = path.replace(/\.tscl$/, '.load.ts')
      const hasLoad = existsSync(loaderPath) && /export\s+(async\s+)?function\s+load\b|export\s+(const|let)\s+load\b/.test(readFileSync(loaderPath, 'utf8'))
      const { code, mappings, loaderSpan } = generateTs(source, file, hasLoad ? { loader: `./${basename(loaderPath)}` } : {})
      const vpath = resolve(virtualRoot, `${file}.ts`)
      mkdirSync(dirname(vpath), { recursive: true })
      writeFileSync(vpath, code)
      generated.set(vpath, { file, source, code, mappings, loaderSpan })
    } catch (err) {
      if (!(err instanceof ClarusError)) throw err
      const message = err.message.slice(`${err.file}:${err.line}:${err.column} `.length)
      diagnostics.push({ file, line: err.line, column: err.column, code: 'clarus', message })
    }
  }

  // Components from packages: a virtual file each (mirroring the package's folders, so their imports of each other
  // resolve), with their other relative imports made absolute, so they reach the real files. Their own errors are
  // the package's; what's checked is how the app uses them (paths below map each package specifier to its file).
  const appRoot = realpathSync(root)
  const paths: Record<string, string[]> = {}
  const virtualOf = new Map<string, string>()
  const components = reachableComponents(root, findClarusFiles(resolve(root, 'src')), (p) => readFileSync(p, 'utf8'), ['.tscl'], projectAliases(root))
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
    for (const m of readFileSync(path, 'utf8').matchAll(/^@import\s+[A-Za-z_$][\w-]*\s+from\s+(['"])([^'"./][^'"]*\.tscl)\1/gm)) {
      try {
        const target = virtualOf.get(realpathSync(require.resolve(m[2]!)))
        if (target) paths[`${m[2]}.ts`] = [`./${posix(relative(resolve(root, '.clarusjs'), target))}`]
      } catch {} // an unresolvable import is reported by the template compiler
    }
  }

  // Path aliases (~/, tsconfig/jsconfig paths), as the build resolves them: each to the real folder, then to its
  // mirror of generated template files (a component import resolves to its .tscl.ts there). They replace the
  // project's own paths, which `paths` here would hide (TypeScript doesn't merge them).
  // ponytail: Vite's resolve.alias isn't read here (check doesn't load the Vite config); tsconfig paths cover it.
  const fromCheck = (path: string) => { const rel = posix(relative(resolve(root, '.clarusjs'), path)); return rel.startsWith('.') ? rel : `./${rel}` }
  for (const alias of projectAliases(root)) {
    const tail = alias.exact ? '' : '*'
    const mirror = resolve(virtualRoot, relative(root, alias.replacement))
    paths[alias.find + tail] = [fromCheck(alias.replacement) + (alias.exact ? '' : '/') + tail, fromCheck(mirror) + (alias.exact ? '' : '/') + tail].map((p) => p.replace(/\/\/\*$/, '/*'))
  }

  // The view registry: every view's name → its inputs, so render(name, props) is checked. Declarations only, so apps
  // can add .clarusjs/views.d.ts to their own tsconfig's include and get the same types in their editor.
  mkdirSync(resolve(root, '.clarusjs'), { recursive: true })
  const sources = findClarusFiles(resolve(root, 'src')).map((path) => ({ file: posix(relative(root, path)), source: readFileSync(path, 'utf8') }))
  writeFileSync(resolve(root, '.clarusjs/views.d.ts'), viewsDeclaration(sources))
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
      diagnostics.push({ file: posix(relative(root, path)), line: Number(m[2]), column: Number(m[3]), code: m[4]!, message: m[5]! })
      continue
    }
    const lines = g.code.split('\n')
    const offset = lines.slice(0, Number(m[2]) - 1).reduce((n, l) => n + l.length + 1, 0) + Number(m[3]) - 1
    const source = toSourceOffset(g.mappings, offset)
    const at = source === null ? { line: 1, column: 1 } : position(g.source, source)
    const fromLoader = g.loaderSpan && offset >= g.loaderSpan[0] && offset < g.loaderSpan[1]
    const message = fromLoader ? `load() returns a value that doesn't fit this page's inputs: ${m[5]}` : source === null ? `${m[5]} (in generated code)` : m[5]!
    diagnostics.push({ file: g.file, ...at, code: m[4]!, message })
  }

  diagnostics.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column)
  return {
    diagnostics,
    exitCode: diagnostics.length ? 1 : 0,
    text: diagnostics.map((d) => `${d.file}:${d.line}:${d.column} error ${d.code}: ${d.message}`).join('\n'),
    json: JSON.stringify(diagnostics, null, 2),
  }
}
