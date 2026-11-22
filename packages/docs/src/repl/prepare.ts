// The page prepares compiled code before posting it to the preview frame, in one acorn pass:
// - each runtime import becomes a read from the copies the frame bundles (`globalThis.__cl_repl`), since a blob URL
//   module can't resolve bare imports;
// - each loop gets a guard that throws after a second, because the sandboxed frame shares the page's thread: an endless
//   loop there would freeze the editor too.
import { parse } from 'acorn'

type Node = { type: string; start: number; end: number; [key: string]: any }

const RUNTIME = new Set(['clarusjs/runtime', 'clarusjs/runtime/server'])
const LOOPS = new Set(['ForStatement', 'ForInStatement', 'ForOfStatement', 'WhileStatement', 'DoWhileStatement'])
const LIMIT_MS = 1000

/** `code` (compile() output) with its runtime imports rewritten and its loops guarded. Throws on other imports. */
export function prepare(code: string): string {
  const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module' }) as unknown as Node
  // Text inserted at positions: opening text before closing at one position; outer openings first, inner closings first.
  const inserts: { pos: number; text: string; open: boolean; depth: number }[] = []
  const replaces: { start: number; end: number; text: string }[] = []
  let loops = 0

  for (const node of ast.body as Node[]) {
    if (node.type !== 'ImportDeclaration') continue
    const from = node.source.value as string
    if (!RUNTIME.has(from)) throw new Error(`the playground supports imports from clarusjs/runtime only, not '${from}'`)
    const names = (node.specifiers as Node[]).map((s) => {
      if (s.type !== 'ImportSpecifier') throw new Error(`in the playground, import runtime functions by name: import { … } from '${from}'`)
      const imported = s.imported.type === 'Identifier' ? s.imported.name : s.imported.value
      return imported === s.local.name ? imported : `${imported}: ${s.local.name}`
    })
    replaces.push({ start: node.start, end: node.end, text: `const { ${names.join(', ')} } = globalThis.__cl_repl['${from}']` })
  }

  const visit = (node: Node, parent: Node | undefined, depth: number) => {
    if (LOOPS.has(node.type)) {
      const n = loops++
      // The clock starts where the loop does: a block around it (around its labels, so `continue label` still works).
      const target = parent?.type === 'LabeledStatement' ? labelRoot(parent, ast) : node
      inserts.push({ pos: target.start, text: `{ const __cl_t${n} = Date.now(); `, open: true, depth: depth - 1 })
      inserts.push({ pos: target.end, text: ' }', open: false, depth: depth - 1 })
      const guard = `if (Date.now() - __cl_t${n} > ${LIMIT_MS}) throw new Error('a loop ran for more than 1 second: stopped (is it endless?)'); `
      const body = node.body as Node
      if (body.type === 'BlockStatement') inserts.push({ pos: body.start + 1, text: ' ' + guard, open: true, depth })
      else {
        inserts.push({ pos: body.start, text: `{ ${guard}`, open: true, depth })
        inserts.push({ pos: body.end, text: ' }', open: false, depth })
      }
    }
    for (const key of Object.keys(node)) {
      const value = node[key]
      if (Array.isArray(value)) for (const v of value) { if (v && typeof v.type === 'string') visit(v, node, depth + 1) }
      else if (value && typeof value === 'object' && typeof value.type === 'string') visit(value, node, depth + 1)
    }
  }
  visit(ast, undefined, 0)

  const events = [
    ...replaces.map((r) => ({ pos: r.start, end: r.end, text: r.text, rank: 1 })),
    ...inserts.map((i) => ({ pos: i.pos, end: i.pos, text: i.text, rank: i.open ? 2 + i.depth : -1 - i.depth })),
  ].sort((a, b) => a.pos - b.pos || a.rank - b.rank)
  let out = ''
  let at = 0
  for (const e of events) {
    out += code.slice(at, e.pos) + e.text
    at = Math.max(at, e.end)
  }
  return out + code.slice(at)
}

/** The outermost of a chain of labels (`a: b: for …`) ending at `label`. */
function labelRoot(label: Node, ast: Node): Node {
  let root = label
  for (;;) {
    const up = findParent(ast, root)
    if (up?.type !== 'LabeledStatement') return root
    root = up
  }
}

function findParent(node: Node, child: Node): Node | undefined {
  for (const key of Object.keys(node)) {
    const value = node[key]
    const kids = Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : []
    for (const k of kids) {
      if (!k || typeof k.type !== 'string') continue
      if (k === child) return node
      if (k.start <= child.start && k.end >= child.end) return findParent(k, child)
    }
  }
  return undefined
}
