// Syntax tree → IR: static HTML chunks, holes (reactive or not), child components, events. Build-time checks live here.
import { KviewError } from './errors.ts'
import type { ImportDecl, InputDecl, ParsedFile, TemplateNode } from './parse.ts'
import { analyzeScript, referencesSignal, type Signals } from './script.ts'

export type IRNode =
  | { kind: 'static'; html: string }
  | { kind: 'hole'; expr: string; reactive: boolean; index: number } // index = -1 when not reactive
  | { kind: 'component'; name: string; props: { name: string; expr: string }[] }
export type IREvent = { index: number; type: string; handler: string }
export type ComponentIR = {
  file: string
  name: string // basename without .kvw
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
  const fail = (text: string, at: number): never => { throw new KviewError(text, file, source, at) }
  const stateful = !!parsed.script
  const signals: Signals = parsed.script ? analyzeScript(parsed.script.code, file, source, parsed.script.start) : new Map()
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

  function visit(node: TemplateNode): void {
    if (node.type === 'text') return emitStatic(node.value)
    if (node.type === 'expr') {
      const reactive = referencesSignal(node.expr, signals)
      nodes.push({ kind: 'hole', expr: node.expr, reactive, index: reactive ? holeCount++ : -1 })
      return
    }
    if (components.has(node.tag)) {
      if (stateful) fail('components inside a stateful component are not supported yet', node.start)
      if (node.children.length) fail('slots are not supported yet', node.start)
      const props: { name: string; expr: string }[] = []
      for (const a of node.attrs) {
        if (a.kind === 'prop') props.push({ name: a.name, expr: a.expr })
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
    }
    if (elementEvents.length) {
      const index = eventElementCount++
      open += ` data-kv-e="${index}"`
      for (const a of elementEvents) events.push({ index, type: a.name, handler: a.kind === 'event' ? a.expr : '' })
    }
    emitStatic(open + '>')
    node.children.forEach(visit)
    if (!VOID.has(node.tag)) emitStatic(`</${node.tag}>`)
  }

  parsed.nodes.forEach(visit)
  return {
    file,
    name: file.split('/').pop()!.replace(/\.kvw$/, ''),
    inputs: parsed.inputs,
    imports: parsed.imports,
    script: parsed.script?.code,
    signals,
    stateful,
    nodes,
    events,
  }
}
