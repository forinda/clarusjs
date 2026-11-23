// @clarusjs/eslint-plugin (#305): ESLint for .tscl components.
// - parser: the file with everything outside <script> blanked to spaces (newlines kept), so every offset is where it
//   was: errors land on the .tscl line and column, and fixes apply to the file. Parsed by ESLint's own espree, or by
//   `parserOptions.parser` (typescript-eslint, …). The file's inputs, imported data and state()/derived()/shared() are
//   its globals.
// - clarusjs/uses-vars: script names the template reads count as used (no-unused-vars).
// - clarusjs/template: the template rules of `clarusjs check` (#304), with a project's own from settings.
// - parserOptions.typeAware (#339): typescript-eslint's type-aware rules on the script, types from a program built by
//   type-aware.ts (TypeScript 6 until typescript-eslint runs on 7).
import { createRequire } from 'node:module'
import { lint, parse, ClarusError, type LintConfig, type LintRuleDef, type TemplateNode } from 'clarusjs/compiler'
import type { ESLint, Linter, Rule, Scope } from 'eslint'
import { declarations, fromTypescriptEslint, loadTypeScript, typeProgram } from './type-aware.ts'

type Node = { type: string; range: [number, number]; loc: { start: { line: number; column: number }; end: { line: number; column: number } } }
type Program = Node & { body: Node[]; tokens?: Node[]; comments?: Node[] }
type Parser = { parse?(code: string, options?: object): unknown; parseForESLint?(code: string, options?: object): { ast: unknown; scopeManager?: unknown; visitorKeys?: unknown; services?: unknown } }
type ScopeManager = Scope.ScopeManager & { addGlobals?(names: string[]): void }

// ESLint's own parser and scope analyzer: dependencies of the project's eslint (a peer), loaded from there.
const fromEslint = createRequire(createRequire(import.meta.url).resolve('eslint'))
const espree = fromEslint('espree') as Required<Pick<Parser, 'parse'>>
const eslintScope = fromEslint('eslint-scope') as { analyze(ast: unknown, options: object): ScopeManager }

const RUNTIME = ['state', 'derived', 'shared'] // what a script uses without importing (see the compiler's script.ts)

/** Every expression a template reads, as text. */
function* expressions(nodes: TemplateNode[]): Generator<string> {
  for (const n of nodes) {
    if (n.type === 'expr') yield n.expr
    else if (n.type === 'element') {
      for (const a of n.attrs) {
        if (a.kind === 'interp') for (const p of a.parts) { if (typeof p !== 'string') yield p.expr }
        else if (a.kind !== 'static') yield a.expr
      }
      yield* expressions(n.children)
    } else if (n.type === 'if') for (const b of n.branches) { if (b.cond) yield b.cond; yield* expressions(b.children) }
    else if (n.type === 'for') { yield n.list; if (n.track) yield n.track; yield* expressions(n.children); if (n.empty) yield* expressions(n.empty) }
    else if (n.type === 'fill') yield* expressions(n.children)
    else if (n.type === 'await') { yield n.expr; for (const kids of [n.pending, ...(n.then ? [n.then.children] : []), ...(n.catch ? [n.catch.children] : [])]) yield* expressions(kids) }
  }
}

/** The text ESLint parses: the script where it is, everything else spaces (line breaks kept). */
function blank(text: string, script?: { code: string; start: number }): string {
  const spaces = (s: string) => s.replace(/[^\r\n]/g, ' ')
  if (!script) return spaces(text)
  const end = script.start + script.code.length
  return spaces(text.slice(0, script.start)) + script.code + spaces(text.slice(end))
}

/** A template syntax error as ESLint reports a parsing error: at its line and column. */
function parsingError(err: ClarusError): Error {
  const message = err.message.slice(`${err.file}:${err.line}:${err.column} `.length)
  return Object.assign(new SyntaxError(message), { lineNumber: err.line, column: err.column, index: 0 })
}

export const parser = {
  meta: { name: '@clarusjs/eslint-plugin/parser' },
  parseForESLint(code: string, options: { filePath?: string; parser?: Parser; ecmaVersion?: Linter.EcmaVersion; sourceType?: string } & Record<string, unknown> = {}) {
    let parsed
    try {
      parsed = parse(code, options.filePath ?? 'file.tscl')
    } catch (err) {
      throw err instanceof ClarusError ? parsingError(err) : err
    }
    const text = blank(code, parsed.script)
    const { parser: delegate, typeAware, typescript, ...rest } = options
    const parserOptions = { ecmaVersion: 'latest', sourceType: 'module', ...rest, range: true, loc: true, tokens: true, comment: true }
    if (typeAware) return typeAwareParse(code, text, parsed, options.filePath ?? 'file.tscl', delegate, parserOptions, typescript as object | undefined)
    const result = delegate?.parseForESLint ? delegate.parseForESLint(text, parserOptions) : { ast: (delegate ?? espree).parse!(text, parserOptions) }
    const scopeManager = (result.scopeManager as ScopeManager | undefined) ?? eslintScope.analyze(result.ast, { ecmaVersion: 2022, sourceType: 'module', ...(result.visitorKeys ? { childVisitorKeys: result.visitorKeys } : {}) })
    // ponytail: addGlobals is eslint-scope's (ESLint 9.x late and 10); older ones skip it, so no-undef may report them.
    scopeManager.addGlobals?.(globalsOf(parsed))
    return { ...result, scopeManager }
  },
}

/** The file's own globals: inputs, imported data, and the runtime's signal functions. */
const globalsOf = (parsed: ReturnType<typeof parse>) => [...RUNTIME, ...parsed.inputs.map((i) => i.name), ...parsed.dataImports.flatMap((d) => importNames(d.clause))]

/**
 * typescript-eslint's parse of the script followed by declarations for what it uses without importing, with the types
 * of a program that has them; the declarations are then cut from the tree, so ESLint sees the file as it is.
 */
function typeAwareParse(code: string, text: string, parsed: ReturnType<typeof parse>, file: string, delegate: Parser | undefined, parserOptions: Record<string, unknown>, typescript?: object) {
  if (!delegate?.parseForESLint) throw new Error("clarusjs: typeAware needs typescript-eslint's parser as parserOptions.parser (import tseslint from 'typescript-eslint', then parserOptions: { parser: tseslint.parser, typeAware: true })")
  const ts = loadTypeScript(file, typescript)
  const virtualFile = `${file}.ts` // never written: the program reads it from memory
  const full = text + declarations(parsed)
  const program = typeProgram(ts, file, virtualFile, full)
  const { project: _p, projectService: _s, ...options } = parserOptions
  const result = delegate.parseForESLint(full, { ...options, filePath: virtualFile, programs: [program] })
  const ast = result.ast as Program
  const inFile = (n: Node) => n.range[1] <= code.length
  ast.body = ast.body.filter(inFile)
  if (ast.tokens) ast.tokens = ast.tokens.filter(inFile)
  if (ast.comments) ast.comments = ast.comments.filter(inFile)
  const lines = code.split('\n')
  ast.range = [ast.range[0], code.length]
  ast.loc = { ...ast.loc, end: { line: lines.length, column: lines.at(-1)!.length } }
  // The scopes of the file as ESLint sees it (without the declarations), and its globals as without typeAware.
  const { analyze } = fromTypescriptEslint(file)('@typescript-eslint/scope-manager') as { analyze(ast: unknown, options: object): ScopeManager }
  const scopeManager = analyze(ast, { sourceType: 'module', lib: ['esnext', 'dom'] })
  scopeManager.addGlobals?.(globalsOf(parsed))
  return { ...result, ast, scopeManager }
}

/** Local names an import clause binds: `{ a, b as c }` → a, c. */
function importNames(clause: string): string[] {
  if (!clause.startsWith('{')) return [clause]
  return clause.slice(1, -1).split(',').map((p) => p.trim()).filter((p) => p && !p.startsWith('type ')).map((p) => p.split(/\s+as\s+/).pop()!.trim())
}

const usesVars: Rule.RuleModule = {
  meta: { type: 'problem', docs: { description: 'Script names the template reads count as used (for no-unused-vars)' }, schema: [] },
  create(context) {
    const { sourceCode } = context
    return {
      Program(node) {
        let nodes: TemplateNode[]
        try { nodes = parse(sourceCode.text, context.filename).nodes } catch { return }
        const corpus = [...expressions(nodes)].join('\n')
        const scope = sourceCode.getScope(node)
        // The module scope's names (a script is a module), and the global scope's for scripts parsed as scripts.
        for (const variable of [...scope.variables, ...(scope.childScopes[0]?.variables ?? [])]) {
          if (new RegExp(`(?<![\\w$.])${variable.name.replace(/\$/g, '\\$')}(?![\\w$])`).test(corpus)) sourceCode.markVariableAsUsed(variable.name, node)
        }
      },
    }
  },
}

const template: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: 'The template rules of clarusjs check: unused inputs and imports, images without alt, labels and buttons without names' },
    schema: [{ type: 'object', additionalProperties: { enum: ['off', 'warn', 'error'] } }],
  },
  create(context) {
    const levels = (context.options[0] ?? {}) as LintConfig
    const own = ((context.settings as { clarusjs?: { lintRules?: LintRuleDef[] } }).clarusjs?.lintRules) ?? []
    return {
      'Program:exit'() {
        let found
        try { found = lint(context.sourceCode.text, context.filename, levels, own) } catch { return } // the parser reports it
        // One ESLint rule for them all: its severity is the configured one, and the finding's rule is in the message.
        for (const m of found) context.report({ loc: { line: m.line, column: m.column - 1 }, message: `${m.message} (${m.rule})` })
      },
    }
  },
}

// `let x = state(…)` (or shared(store)) is a signal the template assigns (`(click)="x++"`, `[(value)]="x.name"`), where
// ESLint can't see: prefer-const's report on its declaration is dropped. The file itself is linted as it is.
const texts = new Map<string, string>()
const processor: Linter.Processor = {
  meta: { name: '@clarusjs/eslint-plugin/tscl' },
  supportsAutofix: true,
  preprocess(text, filename) {
    texts.set(filename, text)
    return [text]
  },
  postprocess(messages, filename) {
    const lines = (texts.get(filename) ?? '').split('\n')
    texts.delete(filename)
    return messages.flat().filter((m) => m.ruleId !== 'prefer-const' || !/^[\w$]+\s*=\s*(state|shared)\s*\(/.test(lines[m.line - 1]?.slice(m.column - 1) ?? ''))
  },
}

/** The plugin: its parser, the .tscl processor, its rules, and `configs.recommended`. */
const plugin: ESLint.Plugin & { parser: typeof parser; configs: { recommended: Linter.Config[] } } = {
  meta: { name: '@clarusjs/eslint-plugin' },
  parser,
  processors: { tscl: processor },
  rules: { 'uses-vars': usesVars, template },
  configs: { recommended: [] },
}

/** For .tscl files: the parser, script names the template reads marked as used, and the template rules as warnings. */
plugin.configs.recommended = [
  {
    name: 'clarusjs/recommended',
    files: ['**/*.tscl'],
    plugins: { clarusjs: plugin },
    languageOptions: { parser },
    processor,
    rules: { 'clarusjs/uses-vars': 'error', 'clarusjs/template': 'warn' },
  },
]

export default plugin
