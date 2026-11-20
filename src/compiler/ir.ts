// Syntax tree → IR: static HTML chunks, holes (reactive or not), child components, events. Build-time checks live here.
import { ClarusError } from './errors.ts'
import type { ImportDecl, InputDecl, ParsedFile, TemplateNode } from './parse.ts'
import { analyzeScript, checkExpr, checkHandler, referencesNames, scriptNames, type Signals } from './script.ts'

export type IRNode =
  | { kind: 'static'; html: string }
  | { kind: 'hole'; expr: string; reactive: boolean; index: number } // index = -1 when not reactive
  | { kind: 'component'; name: string; props: { name: string; expr: string }[] }
export type IREvent = { index: number; type: string; handler: string }
export type ComponentIR = {
  file: string
  name: string // basename without .clarus
  inputs: InputDecl[]
  imports: ImportDecl[]
  script?: string
  signals: Signals
  stateful: boolean
  nodes: IRNode[]
  events: IREvent[]
}

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])

export function lower(parsed: ParsedFile, file: string, source: string): ComponentIR {
  const fail = (text: string, at: number): never => { throw new ClarusError(text, file, source, at) }
  const stateful = !!parsed.script
  const signals: Signals = parsed.script ? analyzeScript(parsed.script.code, file, source, parsed.script.start) : new Map()
  // A hole is reactive if it reads anything the script declares: a signal directly, or a function/value that may read one.
  // text()'s effect tracks the real dependencies, so over-marking only costs a pair of comment markers.
  const scriptScope = parsed.script ? new Set([...signals.keys(), ...scriptNames(parsed.script.code)]) : new Set<string>()
  const components = new Set(parsed.imports.map((i) => i.name))
  const nodes: IRNode[] = []
  const events: IREvent[] = []
  let holeCount = 0
  let eventElementCount = 0

  const emitStatic = (html: string) => {
    const last = nodes[nodes.length - 1]
    if (last?.kind === 'static') last.html += html
    else nodes.push({ kind: 'static', html })
  }

  for (const input of parsed.inputs) if (input.default !== undefined) checkExpr(input.default, file, source, input.start)

  // Elements whose content is raw text: comment markers inside them would be literal text, not Comment nodes.
  const RAW_TEXT = new Set(['textarea', 'title', 'style'])

  function visit(node: TemplateNode, rawText?: string): void {
    if (node.type === 'text') return emitStatic(node.value)
    if (node.type === 'expr') {
      checkExpr(node.expr, file, source, node.start)
      const reactive = referencesNames(node.expr, scriptScope)
      if (reactive && rawText) fail(`reactive {{ }} inside <${rawText}> is not supported yet (it cannot hold update markers)`, node.start)
      nodes.push({ kind: 'hole', expr: node.expr, reactive, index: reactive ? holeCount++ : -1 })
      return
    }
    if (components.has(node.tag)) {
      if (stateful) fail('components inside a stateful component are not supported yet', node.start)
      if (node.children.length) fail('slots are not supported yet', node.start)
      const props: { name: string; expr: string }[] = []
      for (const a of node.attrs) {
        if (a.kind === 'prop') { checkExpr(a.expr, file, source, a.start); props.push({ name: a.name, expr: a.expr }) }
        else fail(`component <${node.tag}> only takes [prop] bindings`, a.start)
      }
      nodes.push({ kind: 'component', name: node.tag, props })
      return
    }
    let open = `<${node.tag}`
    const elementEvents = node.attrs.filter((a) => a.kind === 'event')
    for (const a of node.attrs) {
      if (a.kind === 'static') open += a.value === true ? ` ${a.name}` : ` ${a.name}="${a.value}"`
      else if (a.kind === 'prop') fail('[prop] bindings on HTML elements are not supported yet', a.start)
      else if (!stateful) fail('event bindings need a <script> with state; this component is static', a.start)
      else checkHandler(a.expr, file, source, a.start)
    }
    if (elementEvents.length) {
      const index = eventElementCount++
      open += ` data-cl-e="${index}"`
      for (const a of elementEvents) events.push({ index, type: a.name, handler: a.kind === 'event' ? a.expr : '' })
    }
    emitStatic(open + '>')
    node.children.forEach((child) => visit(child, RAW_TEXT.has(node.tag) ? node.tag : rawText))
    if (!VOID.has(node.tag)) emitStatic(`</${node.tag}>`)
  }

  parsed.nodes.forEach((n) => visit(n))
  return {
    file,
    name: file.split('/').pop()!.replace(/\.clarus$/, ''),
    inputs: parsed.inputs,
    imports: parsed.imports,
    script: parsed.script?.code,
    signals,
    stateful,
    nodes,
    events,
  }
}
