// <script> analysis and signal rewrites. Reads `count` → `count.get()`, writes `count++` → `count.set(count.get() + 1)`.
import { parse as acornParse, parseExpressionAt } from 'acorn'
import { ClaruError } from './errors.ts'

export type Signals = Map<string, 'state' | 'derived'>

// Minimal ESTree node view; acorn produces ESTree with start/end offsets.
type N = { type: string; start: number; end: number; [key: string]: any }
type Hook = (node: N, parent: N | null, key: string) => string | undefined

const OPTS = { ecmaVersion: 'latest', sourceType: 'module' } as const

function isNode(v: unknown): v is N {
  return !!v && typeof (v as N).type === 'string' && typeof (v as N).start === 'number'
}

// Child slots that hold names, not reads.
function isBinding(parent: N | null, key: string): boolean {
  if (!parent) return false
  switch (parent.type) {
    case 'MemberExpression': return key === 'property' && !parent.computed
    case 'Property': case 'MethodDefinition': case 'PropertyDefinition': return key === 'key' && !parent.computed
    case 'VariableDeclarator': return key === 'id'
    case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression': return key === 'id' || key === 'params'
    case 'LabeledStatement': case 'BreakStatement': case 'ContinueStatement': return key === 'label'
    case 'ImportSpecifier': case 'ImportDefaultSpecifier': case 'ExportSpecifier': return true
  }
  return false
}

// Print `node` from `code`, replacing any subtree for which `hook` returns a string.
function print(node: N, code: string, hook: Hook, parent: N | null = null, key = ''): string {
  const replaced = hook(node, parent, key)
  if (replaced !== undefined) return replaced
  const kids: { node: N; key: string }[] = []
  for (const [k, v] of Object.entries(node)) {
    if (Array.isArray(v)) for (const c of v) { if (isNode(c)) kids.push({ node: c, key: k }) }
    else if (isNode(v) && k !== 'loc') kids.push({ node: v, key: k })
  }
  kids.sort((a, b) => a.node.start - b.node.start)
  let out = ''
  let pos = node.start
  for (const kid of kids) {
    if (kid.node.start < pos) continue // shorthand property: key and value share a range
    out += code.slice(pos, kid.node.start) + print(kid.node, code, hook, node, kid.key)
    pos = kid.node.end
  }
  return out + code.slice(pos, node.end)
}

function parseScript(code: string, file = '<script>', source = code, offset = 0): N {
  try {
    return acornParse(code, OPTS) as unknown as N
  } catch (e) {
    const pos = (e as { pos?: number }).pos ?? 0
    throw new ClaruError(`script: ${(e as Error).message.replace(/ \(\d+:\d+\)$/, '')}`, file, source, offset + pos)
  }
}

function parseExpr(expr: string): N {
  const ast = parseExpressionAt(expr, 0, OPTS) as unknown as N
  // acorn drops wrapping parens from the node range: `({ a })` gives a node ending before `)`. Allow exactly those.
  const open = (expr.slice(0, ast.start).match(/\(/g) ?? []).length
  if (!/^[\s(]*$/.test(expr.slice(0, ast.start)) || expr.slice(ast.end).replace(/\s/g, '') !== ')'.repeat(open)) {
    throw Object.assign(new SyntaxError('expected a single expression'), { pos: ast.end })
  }
  return ast
}

function located<T>(fn: () => T, what: string, file: string, source: string, offset: number): T {
  try {
    return fn()
  } catch (e) {
    if (e instanceof ClaruError) throw e
    throw new ClaruError(`${what}: ${(e as Error).message.replace(/ \(\d+:\d+\)$/, '')}`, file, source, offset)
  }
}

/** Throw a located ClaruError unless `expr` is exactly one JS expression. */
export function checkExpr(expr: string, file: string, source: string, offset: number): void {
  located(() => parseExpr(expr), 'invalid expression', file, source, offset)
}

/** Throw a located ClaruError unless `code` parses as statements (event handlers may hold several). */
export function checkHandler(code: string, file: string, source: string, offset: number): void {
  located(() => acornParse(code, OPTS), 'invalid event handler', file, source, offset)
}

/** Names declared at the top level of <script>: variables, functions, classes. */
export function scriptNames(code: string): Set<string> {
  const names = new Set<string>()
  for (const stmt of parseScript(code).body as N[]) {
    if (stmt.type === 'VariableDeclaration') {
      for (const d of stmt.declarations as N[]) if (d.id.type === 'Identifier') names.add(d.id.name)
    } else if ((stmt.type === 'FunctionDeclaration' || stmt.type === 'ClassDeclaration') && stmt.id) {
      names.add(stmt.id.name)
    }
  }
  return names
}

function signalCall(init: N | null | undefined): 'state' | 'derived' | undefined {
  if (init?.type !== 'CallExpression' || init.callee.type !== 'Identifier') return undefined
  return init.callee.name === 'state' || init.callee.name === 'derived' ? init.callee.name : undefined
}

export function analyzeScript(code: string, file: string, source: string, offset: number): Signals {
  const signals: Signals = new Map()
  for (const stmt of parseScript(code, file, source, offset).body as N[]) {
    if (stmt.type === 'ImportDeclaration' || stmt.type.startsWith('Export')) {
      throw new ClaruError('imports in <script> are not supported yet', file, source, offset + stmt.start)
    }
    if (stmt.type !== 'VariableDeclaration') continue
    for (const d of stmt.declarations as N[]) {
      const kind = signalCall(d.init)
      if (kind && d.id.type === 'Identifier') signals.set(d.id.name, kind)
    }
  }
  return signals
}

// ponytail: name-based rewrite ignores shadowing (a local named like a signal gets rewritten); add scope tracking with @for/nested functions in stage 2
function clientHook(code: string, signals: Signals): Hook {
  const hook: Hook = (node, parent, key) => {
    const rec = (n: N) => print(n, code, hook, node, '')
    const isSignal = (n: N) => n.type === 'Identifier' && signals.has(n.name)
    if (node.type === 'VariableDeclaration' && node.kind === 'let' && (node.declarations as N[]).every((d) => signalCall(d.init))) {
      return 'const' + print({ ...node, kind: 'const', start: node.start + 3 }, code, hook, parent, key)
    }
    if (node.type === 'UpdateExpression' && isSignal(node.argument)) {
      const name = node.argument.name
      return `${name}.set(${name}.get() ${node.operator[0]} 1)`
    }
    if (node.type === 'AssignmentExpression' && isSignal(node.left)) {
      const name = node.left.name
      const right = rec(node.right)
      return node.operator === '='
        ? `${name}.set(${right})`
        : `${name}.set(${name}.get() ${node.operator.slice(0, -1)} (${right}))`
    }
    if (node.type === 'Property' && node.shorthand && isSignal(node.value)) {
      return `${node.key.name}: ${node.value.name}.get()`
    }
    if (isSignal(node) && !isBinding(parent, key)) return `${node.name}.get()`
    return undefined
  }
  return hook
}

export function rewriteClient(code: string, signals: Signals): string {
  const ast = parseScript(code)
  return code.slice(0, ast.start) + print(ast, code, clientHook(code, signals)) + code.slice(ast.end)
}

export function rewriteClientExpr(expr: string, signals: Signals): string {
  const ast = parseExpr(expr)
  return expr.slice(0, ast.start) + print(ast, expr, clientHook(expr, signals)) + expr.slice(ast.end)
}

export function rewriteServer(code: string): string {
  const ast = parseScript(code)
  const hook: Hook = (node) => {
    if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier') return undefined
    const arg = node.arguments[0] as N | undefined
    const inner = arg ? print(arg, code, hook) : 'undefined'
    if (node.callee.name === 'state') return `(${inner})`
    if (node.callee.name === 'derived') return `(${inner})()`
    return undefined
  }
  return code.slice(0, ast.start) + print(ast, code, hook) + code.slice(ast.end)
}

export function referencesSignal(expr: string, signals: Signals): boolean {
  return referencesNames(expr, new Set(signals.keys()))
}

/** Does `expr` read any of `names`? */
export function referencesNames(expr: string, names: Set<string>): boolean {
  let found = false
  print(parseExpr(expr), expr, (node, parent, key) => {
    if (node.type === 'Identifier' && names.has(node.name) && !isBinding(parent, key)) found = true
    if (node.type === 'Property' && node.shorthand && names.has(node.value?.name)) found = true
    return undefined
  })
  return found
}
