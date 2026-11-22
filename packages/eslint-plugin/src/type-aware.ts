// Type-aware linting of .tscl scripts (#339): a TypeScript program in which the .tscl file is its script, every offset
// where it was, followed by declarations for what the script uses without importing (inputs, imported data, signals).
// typescript-eslint reads types from it; the declarations are cut from the tree ESLint sees.
//
// ponytail: built with TypeScript 6's JavaScript API, the one typescript-eslint runs on today. Once it runs on
// TypeScript 7.1, typeProgram() becomes the content mapper's program (clarusjs registered), and the TypeScript 6
// requirement goes (#342).
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import type { ParsedFile } from 'clarusjs/compiler'
import type * as TS from 'typescript'

type TypeScript = typeof TS

/** What the script uses without importing it, as TypeScript, appended after the file's own text. */
export function declarations(parsed: ParsedFile): string {
  const lines = [
    'declare function state<T>(value: T): T extends never[] ? any[] : T',
    'declare function derived<T>(fn: () => T): T',
    'declare function shared<T>(store: { get(): T }): T',
    ...parsed.typeImports.map((t) => `import type ${t.clause} from ${JSON.stringify(t.from)}`),
    ...parsed.dataImports.map((d) => `import ${d.clause} from ${JSON.stringify(d.from)}`),
    ...parsed.types.map((t) => (t.kind === 'interface' ? `interface ${t.name}${t.params ?? ''} ${t.type}` : `type ${t.name}${t.params ?? ''} = ${t.type}`)),
    ...parsed.inputs.map((i) => `declare ${i.model ? 'let' : 'const'} ${i.name}: ${i.type}`),
    'export {}',
  ]
  return '\n' + lines.join('\n') + '\n'
}

/** require() from where the project's typescript-eslint parser is (its TypeScript, its scope manager). */
export function fromTypescriptEslint(file: string): NodeJS.Require {
  return createRequire(createRequire(resolve(dirname(file), 'package.json')).resolve('@typescript-eslint/parser'))
}

/**
 * The TypeScript typescript-eslint runs on: the one its typescript-estree resolves from the project (or `override`).
 * Throws when it isn't TypeScript 6 or older, saying what to install.
 */
export function loadTypeScript(file: string, override?: Partial<TypeScript>): TypeScript {
  let ts = override as TypeScript | undefined
  if (!ts) {
    try {
      ts = createRequire(fromTypescriptEslint(file).resolve('@typescript-eslint/typescript-estree'))('typescript') as TypeScript
    } catch {}
  }
  return requireTypeScript6(ts)
}

/** `ts` when it is TypeScript 6 or older (with its JavaScript API); otherwise an error saying what to install. */
export function requireTypeScript6(ts?: Partial<TypeScript>): TypeScript {
  if (ts && Number(ts.versionMajorMinor?.split('.')[0]) <= 6 && typeof ts.createProgram === 'function') return ts as TypeScript
  throw new Error(
    `clarusjs: type-aware linting of .tscl files needs TypeScript 6 for typescript-eslint, which doesn't run on 7 yet; ` +
      `found ${ts ? `TypeScript ${ts.version}` : 'no TypeScript'}. Install Microsoft's compatibility package as "typescript" ` +
      `and keep TypeScript 7 for tsc under another name: ` +
      `pnpm add -D typescript@npm:@typescript/typescript6 @typescript/native@npm:typescript@^7. ` +
      `Or turn typeAware off: the other rules don't need it.`,
  )
}

type Cached = { ts: TypeScript; options: TS.CompilerOptions; program?: TS.Program }
const projects = new Map<string, Cached>() // by tsconfig (or folder, without one)

/** Compiler options: the project's tsconfig.json (or jsconfig.json), else strict defaults with browser types. */
function compilerOptions(ts: TypeScript, file: string): { key: string; options: TS.CompilerOptions } {
  const config = ts.findConfigFile(dirname(file), ts.sys.fileExists, 'tsconfig.json') ?? ts.findConfigFile(dirname(file), ts.sys.fileExists, 'jsconfig.json')
  const defaults: TS.CompilerOptions = { strict: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, lib: ['lib.es2023.d.ts', 'lib.dom.d.ts'] }
  if (!config) return { key: dirname(file), options: defaults }
  const read = ts.readConfigFile(config, ts.sys.readFile)
  const parsed = ts.parseJsonConfigFileContent(read.config ?? {}, ts.sys, dirname(config))
  return { key: config, options: parsed.options }
}

/** A program with `virtualFile` (the .tscl file's script and declarations) as its one root. Reused between files. */
export function typeProgram(ts: TypeScript, file: string, virtualFile: string, text: string): TS.Program {
  const { key, options: own } = compilerOptions(ts, file)
  let cached = projects.get(key)
  if (!cached || cached.ts !== ts) projects.set(key, (cached = { ts, options: { ...own, noEmit: true, allowJs: true, allowImportingTsExtensions: true } }))
  const host = ts.createCompilerHost(cached.options, true)
  const getSourceFile = host.getSourceFile.bind(host)
  host.getSourceFile = (name, language, ...rest) => (name === virtualFile ? ts.createSourceFile(name, text, language, true, ts.ScriptKind.TS) : getSourceFile(name, language, ...rest))
  const fileExists = host.fileExists.bind(host)
  host.fileExists = (name) => name === virtualFile || fileExists(name)
  cached.program = ts.createProgram([virtualFile], cached.options, host, cached.program)
  return cached.program
}
