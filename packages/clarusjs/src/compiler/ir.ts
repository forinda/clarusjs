// Syntax tree → IR: static HTML chunks, holes (reactive or not), child components, events. Build-time checks live here.
import { modifierError, splitEvent } from './events.ts'
import { extendedAttrs } from './element-attrs.ts'
import { parseExpressionAt } from 'acorn'
import { iconElement, type IconResolver } from './icon.ts'
import { ClarusError } from './errors.ts'
import { outerIndexIn } from './loops.ts'
import { FOR_IMPLICIT, importNames, type Attr, type DataImport, type ImportDecl, type InputDecl, type ParsedFile, type TemplateNode } from './parse.ts'
import { baseUrl, isBaseAttr } from '../runtime/attrs.ts'
import { analyzeScript, providesIn, mutationsOf, writesTo, checkExpr, checkHandler, referencesNames, scriptNames, serverScriptParts, splitImports, type Signals } from './script.ts'

export type IRNode =
  | { kind: 'static'; html: string }
  | { kind: 'hole'; expr: string; reactive: boolean; index: number; json?: true } // index = -1 when not reactive; json: JSON-LD
  // children: content for the default slot; fills: content for named slots (@slot('name') { … }).
  // region: inside an island, a component whose props read state or that wraps content gets markers so the browser
  // can re-render it (-1 otherwise).
  // models: [(name)]="path" bindings: each write from the child runs `set` (a statement using __cl_v).
  | { kind: 'component'; name: string; props: { name: string; expr: string }[]; models?: { name: string; set: string }[]; listens?: { name: string; handler: string }[]; children: IRNode[]; fills: { name: string; params?: string; nodes: IRNode[] }[]; region: number; attach?: string; paths?: { name: string; expr: string }[]; class?: string }
  // Where a stateless component renders content it is given ('default' or a name); fallback shows when none is given.
  // props: what the slot passes to the content filling it (#455): <slot name="row" [item]="r" />.
  | { kind: 'slot'; name: string; props: { name: string; expr: string }[]; fallback: IRNode[] }
  // A dynamic attribute: [name]="expr" (value) or name="a {{ b }}" (parts, joined into a string).
  // name '...': a spread (#405); skip: the names written on the element (lowercase), where: its place, for warnings.
  // content: a textarea's value, written as its text in HTML (a value attribute means nothing there); the browser
  // still sets the property.
  // base: under Vite's base, a spread's (or passed attributes') URL attributes get it.
  | { kind: 'attr'; name: string; value: { expr: string } | { parts: (string | { expr: string })[] }; reactive: boolean; index: number; tag: string; skip?: string[]; where?: string; content?: true; base?: string }
  // [engine]="f": an element connected to a form from clarusjs/forms (marked data-cl-form="index").
  | { kind: 'connect'; expr: string; index: number }
  // [use]="behaviour" (#464): an element handed to a function in the browser (marked data-cl-u="index").
  | { kind: 'use'; expr: string; index: number }
  // @if / @else. block = -1 outside islands (plain server-side choice); inside an island, the block's marker index.
  | { kind: 'if'; branches: { cond: string | null; nodes: IRNode[] }[]; block: number; transition?: { name: string | null; options: string | null } }
  // @await (#430): `block` shares @if's markers (<!--[bN:K-->, K = 0 pending, 1 then, 2 catch); -1 outside islands.
  | { kind: 'await'; expr: string; pending: IRNode[]; then: { name: string; nodes: IRNode[] } | null; catch: { name: string; nodes: IRNode[] } | null; block: number }
  // @for / @empty. block = -1 outside islands; inside an island, the list's marker index. `item` and `$index` are in
  // scope in `nodes`; `track` (or the index) keys rows.
  | { kind: 'for'; item: string; list: string; track: string | null; aliases: { name: string; of: string }[]; nodes: IRNode[]; empty: IRNode[] | null; block: number; transition?: { name: string | null; options: string | null } }
// scope: which @if branch the element is in ("block.branch"); undefined at the top level.
/** An element's (type.mods)="handler"; mods are #444's modifiers, as written. */
export type IREvent = { index: number; type: string; handler: string; scope?: string; mods?: string[] }
export type ComponentIR = {
  file: string
  name: string // basename without .tscl
  inputs: InputDecl[]
  /** `@extends tag`: the attribute names passed through to the root besides the usual ones. */
  extends?: string[]
  imports: ImportDecl[]
  script?: string // without its import statements, which are in scriptImports
  scriptImports: string[]
  /** <script server> (#430): its hoisted imports, its body (run at the top of render), and whether it awaits. */
  server?: { imports: string[]; body: string; awaits: boolean }
  dataImports: DataImport[]
  signals: Signals
  stateful: boolean
  nodes: IRNode[]
  events: IREvent[]
  /** The component sends events to its parent (@event, #442): its script gets emit(). */
  sends: boolean
  /** Their names: the parent's (name) listens for these as component events, not DOM events. */
  sendNames: string[]
  /** @context declarations (#465): values read from the components around this one. */
  contexts: InputDecl[]
  /** The script calls provide() (#465): this component adds to the context its children render with. */
  provides: boolean
  /** Things that compile but likely aren't meant (located, not thrown). */
  warnings: ClarusError[]
}

const ATTACH_MODES = ['load', 'idle', 'visible', 'interaction']
// Elements a spread could make load something (their URL attributes are static only): no [...] on them.
export const SPREAD_REFUSED = new Set(['iframe', 'frame', 'embed', 'object', 'base', 'link', 'script', 'meta'])
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])

/**
 * The body of each <svg> an <icon> became, emitted right after its open tag. Keyed by the element object itself, so
 * visit() must emit the open tag of the node it was given: a pass that copies the element first ({ ...node, attrs })
 * would lose the body (the icon tests catch that: the svg would come out empty).
 */
const iconBodies = new WeakMap<object, string>()

export function lower(parsed: ParsedFile, file: string, source: string, options: { collapseWhitespace?: boolean; icon?: IconResolver; base?: string } = {}): ComponentIR {
  // Vite's base for root-relative URL attributes; none at '/' (the output is then exactly as without one).
  const base = options.base && options.base !== '/' ? options.base : undefined
  const fail = (text: string, at: number): never => { throw new ClarusError(text, file, source, at) }
  // An inner @for's $index on an outer loop's list (#585): the wrong row, silently.
  const outer = outerIndexIn(parsed.nodes)
  if (outer) fail(outer.message, outer.start)
  // An island: it has a script, or a @model input (which it writes, even from an event handler alone).
  // let: off while a fill that receives data inside an island is lowered, as plain server HTML (#472).
  let stateful = !!parsed.script || parsed.inputs.some((i) => i.model)
  // A component sends its events from its script (#442).
  if (parsed.events.length && !parsed.script) fail('@event needs a <script> that sends it with emit(\'name\', value)', parsed.events[0]!.start)
  // Context (#465): an island has no incoming context in the browser, so it can't read any yet.
  // ponytail: lift by serializing the island's incoming context into its props.
  if (parsed.contexts.length && stateful) fail('@context is only for components without <script> or @model for now: an island has no context in the browser. Read it in a component without a script, or pass it in as a prop', parsed.contexts[0]!.start)
  for (const c of parsed.contexts) if (parsed.inputs.some((i) => i.name === c.name)) fail(`"${c.name}" is already an @input`, c.nameStart)
  const warnings: ClarusError[] = []
  const ss = parsed.serverScript
  // ponytail: not in an island yet: its names would be gone when the island re-renders in the browser. Lift it when
  // islands can take server values as props automatically.
  if (ss && stateful) fail('<script server> runs on the server only, and this component is an island (it has a <script> or a @model input): load the data in a parent, or in a page\'s <script server>, and pass it to the island as props', ss.tag)
  const server = ss ? serverScriptParts(ss.code, file, source, ss.start) : undefined
  // This component's @model inputs: fields bound to them take their path from the parent (see modelPath).
  const modelNames = new Set(parsed.inputs.filter((i) => i.model).map((i) => i.name))
  const split = parsed.script ? splitImports(parsed.script.code, file, source, parsed.script.start) : { imports: [], body: '' }
  const signals: Signals = parsed.script ? analyzeScript(split.body, file, source, parsed.script.start) : new Map()
  const provides = parsed.script ? providesIn(split, file, source, parsed.script.start) : false
  // A hole is reactive if it reads anything the script declares: a signal directly, or a function/value that may read one.
  // text()'s effect tracks the real dependencies, so over-marking only costs a pair of comment markers.
  const scriptScope = parsed.script ? new Set([...signals.keys(), ...scriptNames(parsed.script.code)]) : new Set<string>()
  // An island's inputs are read-only signals its parent updates in place: what reads them is reactive, and writing
  // to one is an error (to change a value locally, copy it into state()).
  const inputNames = new Set(stateful ? parsed.inputs.filter((i) => !i.model).map((i) => i.name).filter((name) => !signals.has(name)) : [])
  for (const name of inputNames) {
    signals.set(name, 'input')
    scriptScope.add(name)
  }
  // @model inputs may be written: the write goes to the parent island (or, with none, stays here).
  for (const i of stateful ? parsed.inputs.filter((x) => x.model && !signals.has(x.name)) : []) {
    signals.set(i.name, 'model')
    scriptScope.add(i.name)
  }
  /**
   * [(x)]="path": the statement writing `value` back to path, copy-on-write: `form.name` gives
   * form = { ...form, name: value }, and `rows[$index].name` gives rows = rows.map((r, i) => i === $index ? … : r).
   */
  const writeBack = (path: string, value: string, name: string, at: number): string => {
    if (!stateful) fail(`[(${name})] needs a <script> with state to write back to`, at)
    const invalid = () => fail(`[(${name})] needs a variable or a property path (form.name, rows[$index].name) to write back to, not "${path}"`, at)
    const parsed = pathSegments(path) ?? invalid()
    const { root, segments } = parsed
    if (loopNames.has(root)) fail(`[(${name})] can't write back to the row variable "${root}": bind the list by index, like [(${name})]="rows[$index].${path.slice(root.length).replace(/^\./, '') || 'name'}"`, at)
    // From the innermost segment out: each level is a copy of its parent with one part replaced.
    const bases = [root]
    for (const seg of segments) bases.push('key' in seg ? `${bases.at(-1)}.${seg.key}` : `${bases.at(-1)}[${seg.index}]`)
    let next = value
    for (let k = segments.length - 1; k >= 0; k--) {
      const seg = segments[k]!
      const parent = bases[k]!
      // A bracket picks an array element (a copy with it replaced) or an object property (form['name']).
      next = 'key' in seg
        ? `{ ...${parent}, ${seg.key}: ${next} }`
        : `(Array.isArray(${parent}) ? ${parent}.map((__cl_x, __cl_i) => __cl_i === (${seg.index}) ? ${next} : __cl_x) : { ...${parent}, [${seg.index}]: ${next} })`
    }
    const statement = `${root} = ${next}`
    for (const w of writesTo(statement, inputNames)) readOnly(w.name, at)
    return statement
  }
  const readOnly = (name: string, at: number): never =>
    fail(`@input ${name} is read-only: inputs belong to the parent. Copy it to change it here: let local = state(${name})`, at)
  if (parsed.script && inputNames.size) for (const w of writesTo(parsed.script.code, inputNames)) readOnly(w.name, parsed.script.start + w.start)
  // State changed in place (items.push(x), form.a = 1) notifies nothing, so the page doesn't update (#350): a warning
  // with the copy to write, in the script here and in event handlers below.
  const stateNames = new Set(signals.keys())
  if (parsed.script) for (const m of mutationsOf(parsed.script.code, stateNames)) warnings.push(new ClarusError(m.message, file, source, parsed.script.start + m.start))
  for (const d of parsed.dataImports) {
    // In an island the import is bundled for the browser, like a script import.
    if (stateful && d.from.startsWith('node:')) fail(`\`${d.from}\` can't be imported in an island: its imports are bundled for the browser`, d.start)
    if (stateful) for (const name of importNames(d.clause)) scriptScope.add(name)
  }
  const components = new Set(parsed.imports.map((i) => i.name))
  const nodes: IRNode[] = []
  let out = nodes // where lowering writes; switched while lowering a component's children
  const events: IREvent[] = []
  let holeCount = 0
  let eventElementCount = 0
  let attrElementCount = 0
  let formCount = 0
  let useCount = 0
  let selectModel: string | undefined // inside a <select [(value)]>: its bound value, for its options' `selected`
  // Under an [engine] element: the object its fields bind (one per form, so a path can't silently miss).
  let engineScope: { root: string | null } | null = null
  const sameRoot = (path: string, at: number) => {
    const root = pathSegments(path)?.root
    if (!engineScope || !root) return
    if (engineScope.root === null) engineScope.root = root
    else if (engineScope.root !== root) fail(`fields under [engine] bind one object: found ${engineScope.root} and ${root}`, at)
  }
  let blockCount = 0
  let forCount = 0
  let regionCount = 0
  let loopNames = new Set<string>() // @for item and $index names in scope: they make holes inside rows reactive
  let scopeKey: string | undefined // the @if branch being lowered, for events

  const emitStatic = (html: string) => {
    const last = out[out.length - 1]
    if (last?.kind === 'static') last.html += html
    else out.push({ kind: 'static', html })
  }

  for (const input of parsed.inputs) if (input.default !== undefined) checkExpr(input.default, file, source, input.start)

  // Elements whose content is raw text: comment markers inside them would be literal text, not Comment nodes.
  const RAW_TEXT = new Set(['textarea', 'title', 'style'])

  // A whitespace run (not \u00a0) becomes one character, \n if it had one.
  const KEEP_WHITESPACE = new Set(['pre', 'textarea', 'script', 'style'])
  let keep = 0
  const text = (value: string) => options.collapseWhitespace && !keep ? value.replace(/[ \t\n\f\r]+/g, (run) => (run.includes('\n') ? '\n' : ' ')) : value

  function visit(node: TemplateNode, rawText?: string): void {
    if (node.type === 'text') return emitStatic(text(node.value))
    if (node.type === 'fill') return fail('@slot only works directly inside a component tag', node.start)
    if (node.type === 'if') {
      const tr = node.transition
      if (tr) {
        // The wrapper only does something in the browser: a component without an island has no code there.
        if (!stateful) fail('@transition runs in the browser: this component needs a <script> or a @model input (an island)', tr.start)
        if (tr.name !== null) checkExpr(tr.name, file, source, tr.nameStart)
        if (tr.options !== null) checkExpr(tr.options, file, source, tr.optionsStart)
      }
      const block = stateful ? blockCount++ : -1
      const parent = out
      const parentScope = scopeKey
      const branches = node.branches.map((b, i) => {
        if (b.cond !== null) checkExpr(b.cond, file, source, b.condStart)
        const branchNodes: IRNode[] = []
        out = branchNodes
        if (stateful) scopeKey = `${block}.${i}`
        b.children.forEach((child) => visit(child, rawText))
        return { cond: b.cond, nodes: branchNodes }
      })
      out = parent
      scopeKey = parentScope
      out.push({ kind: 'if', branches, block, ...(tr ? { transition: { name: tr.name, options: tr.options } } : {}) })
      return
    }
    if (node.type === 'await') {
      checkExpr(node.expr, file, source, node.exprStart)
      const block = stateful ? blockCount++ : -1
      const parent = out
      const parentScope = scopeKey
      const lowerBranch = (children: TemplateNode[], k: number) => {
        const list: IRNode[] = []
        out = list
        if (stateful) scopeKey = `${block}.${k}`
        children.forEach((child) => visit(child, rawText))
        return list
      }
      const pending = lowerBranch(node.pending, 0)
      const then = node.then ? { name: node.then.name, nodes: lowerBranch(node.then.children, 1) } : null
      const caught = node.catch ? { name: node.catch.name, nodes: lowerBranch(node.catch.children, 2) } : null
      out = parent
      scopeKey = parentScope
      out.push({ kind: 'await', expr: node.expr, pending, then, catch: caught, block })
      return
    }
    if (node.type === 'for') {
      const tr = node.transition
      if (tr) {
        if (!stateful) fail('@transition runs in the browser: this component needs a <script> or a @model input (an island)', tr.start)
        if (tr.name !== null) checkExpr(tr.name, file, source, tr.nameStart)
        if (tr.options !== null) checkExpr(tr.options, file, source, tr.optionsStart)
      }
      checkExpr(node.list, file, source, node.listStart)
      if (node.track !== null) checkExpr(node.track, file, source, node.trackStart)
      const block = stateful ? forCount++ : -1
      const parent = out
      const parentScope = scopeKey
      const parentLoop = loopNames
      const lowerInto = (children: TemplateNode[], key: string, names: Set<string>) => {
        const list: IRNode[] = []
        out = list
        loopNames = names
        if (stateful) scopeKey = key
        children.forEach((child) => visit(child, rawText))
        return list
      }
      if (node.track !== null && referencesNames(node.track, new Set([...FOR_IMPLICIT.filter((x) => x !== '$index'), ...node.aliases.filter((a) => a.of !== '$index').map((a) => a.name)]))) fail('track can use the item and $index, not $count, $first, $last, $even or $odd (a key must not change when the list grows)', node.trackStart)
      if (block >= 0 && node.track === null) warnings.push(new ClarusError('@for without track: rows are matched by position, so a row\'s state moves to another item when the list changes order; add track item.id (or another unique key)', file, source, node.start))
      const nodes = lowerInto(node.children, `f${block}`, new Set([...parentLoop, node.item, ...FOR_IMPLICIT, ...node.aliases.map((a) => a.name)]))
      const empty = node.empty ? lowerInto(node.empty, `f${block}e`, parentLoop) : null
      out = parent
      scopeKey = parentScope
      loopNames = parentLoop
      out.push({ kind: 'for', item: node.item, list: node.list, track: node.track, aliases: node.aliases.map(({ name, of }) => ({ name, of })), nodes, empty, block, ...(tr ? { transition: { name: tr.name, options: tr.options } } : {}) })
      return
    }
    if (node.type === 'raw') return emitStatic(node.value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
    if (node.type === 'expr') {
      checkExpr(node.expr, file, source, node.start)
      if (node.json) {
        if (stateful) fail('JSON-LD is rendered on the server: put it in a component without a <script> (a layout or page)', node.start)
        out.push({ kind: 'hole', expr: node.expr, reactive: false, index: -1, json: true })
        return
      }
      const reactive = stateful && (referencesNames(node.expr, scriptScope) || referencesNames(node.expr, loopNames))
      if (reactive && rawText) fail(`reactive {{ }} inside <${rawText}> is not supported yet (it cannot hold update markers)`, node.start)
      out.push({ kind: 'hole', expr: node.expr, reactive, index: reactive ? holeCount++ : -1 })
      return
    }
    // <icon name="set:name" />: the icon as an <svg>, drawn now (a component imported as icon wins).
    if (node.tag === 'icon' && !components.has('icon')) {
      const { svg, body } = iconElement(node, file, source, options.icon)
      iconBodies.set(svg, body)
      return visit(svg, rawText)
    }
    // The <svg> an <icon> became is always the element, even when a component named svg is imported.
    if (components.has(node.tag) && !iconBodies.has(node)) {
      const props: { name: string; expr: string }[] = []
      const models: { name: string; set: string }[] = []
      let attach: string | undefined
      let cls: string | undefined
      const paths: { name: string; expr: string }[] = []
      const listens: { name: string; handler: string }[] = []
      for (const a of node.attrs) {
        if (/^(class|style)\./.test(a.name)) fail(`a component takes a static class="…" only: [${a.name}] is for elements`, a.start)
        if (a.kind === 'prop' && a.name === 'use') fail('[use] is for elements: put it on an element inside the component', a.start)
        // [...]="props" (#406): every key a prop, first, so props written on the tag win.
        if (a.kind === 'prop' && a.name === '...') {
          if (props.some((p) => p.name === '...')) fail('one [...] per element', a.start)
          checkExpr(a.expr, file, source, a.start)
          props.unshift({ name: '...', expr: a.expr })
          continue
        }
        if (a.name === 'class') {
          // Passed through to the component's top-level elements (see markRoots in index.ts).
          if (a.kind !== 'static' || typeof a.value !== 'string') fail('a component takes a static class="…" only ([class] and {{ }} in it aren\'t supported on a component yet)', a.start)
          else cls = a.value
          continue
        }
        if (a.kind === 'prop') { checkExpr(a.expr, file, source, a.start); props.push({ name: a.name, expr: a.expr }) }
        else if (a.kind === 'model') {
          const set = writeBack(a.expr, '__cl_v', a.name, a.start)
          checkExpr(a.expr, file, source, a.start)
          props.push({ name: a.name, expr: a.expr })
          sameRoot(a.expr, a.start)
          // The forms engine's path for this component (the first two-way binding's); island() puts it on the island.
          paths.push({ name: a.name, expr: modelPath(a.expr, modelNames) })
          models.push({ name: a.name, set })
        }
        else if (a.kind === 'event') {
          // (change)="…": the child's @event change (#442), handled in this island with $event (the value) and $info.
          if (!stateful) fail('event bindings need a <script> with state; this component is static', a.start)
          if (a.name.includes('.')) fail(`(${a.name}): modifiers are for elements' DOM events; handle it in the handler`, a.start)
          checkHandler(a.expr, file, source, a.start)
          listens.push({ name: a.name, handler: a.expr })
        }
        else if (a.kind === 'interp') {
          // name="a {{ b }}": the text, as a string prop.
          for (const p of a.parts) if (typeof p !== 'string') checkExpr(p.expr, file, source, p.start)
          props.push({ name: a.name, expr: `[${a.parts.map((p) => (typeof p === 'string' ? JSON.stringify(p) : `(${p.expr})`)).join(', ')}].join('')` })
        }
        else if (a.kind === 'static' && a.name !== 'attach') {
          // An attribute for the child's root element (#463): passed as a prop; the child keeps attribute-like ones.
          props.push({ name: a.name, expr: JSON.stringify(a.value) })
        }
        else if (a.kind === 'static' && a.name === 'attach') {
          // When the island's code loads in the browser (see runtime/loader.ts).
          if (typeof a.value !== 'string' || !ATTACH_MODES.includes(a.value)) fail(`attach must be one of ${ATTACH_MODES.join(', ')}`, a.start)
          attach = a.value as string
        } else fail(`component <${node.tag}> only takes [prop], [(prop)] and (event) bindings and attach="…"`, a.start)
      }
      // Content is rendered here, in this component's scope, and handed to the child for its slots.
      const hasContent = node.children.some((c) => c.type !== 'text' || c.value.trim())
      const readsState = props.some((p) => referencesNames(p.expr, scriptScope) || referencesNames(p.expr, loopNames))
      // An island that provides (#465): any child may read the context, so each re-renders when what it reads changes.
      const region = stateful && (hasContent || readsState || models.length > 0 || listens.length > 0 || provides) ? regionCount++ : -1
      const parentScope = scopeKey
      if (region >= 0) scopeKey = `c${region}`
      const lowerList = (list: TemplateNode[]) => {
        const nodes_: IRNode[] = []
        const parent = out
        out = nodes_
        list.forEach((child) => visit(child, rawText))
        out = parent
        return nodes_
      }
      const fills: { name: string; params?: string; nodes: IRNode[] }[] = []
      for (const child of node.children) {
        if (child.type !== 'fill') continue
        if (fills.some((f) => f.name === child.name)) fail(`slot "${child.name}" is filled twice`, child.start)
        let nodes: IRNode[]
        if (child.params !== undefined) {
          slotParamsCheck(child.params, file, source, child.paramsStart!)
          // In an island (#472) it shows what it receives: the region re-renders the component, fill included, when
          // what they read changes, so its content is plain server HTML, no markers.
          // ponytail: handlers and bindings would need the slot's data in the browser, per call of the fill; wire them
          // when a region can re-run a fill function there.
          if (stateful) {
            const wired = wiredIn(child.children)
            if (wired) fail(`a fill that receives data inside an island shows the data it receives: ${wired.what} would need that data in the browser, which isn't supported yet. Move it outside the @slot, or render this component outside the island`, wired.start)
            stateful = false
            nodes = lowerList(child.children)
            stateful = true
          } else nodes = lowerList(child.children)
        } else nodes = lowerList(child.children)
        fills.push({ name: child.name, ...(child.params !== undefined ? { params: child.params } : {}), nodes })
      }
      const rest = node.children.filter((c) => c.type !== 'fill')
      // Whitespace around @slot blocks is not content for the default slot.
      const children = rest.every((c) => c.type === 'text' && !c.value.trim()) ? [] : lowerList(rest)
      if (children.length && fills.some((f) => f.name === 'default')) fail('the default slot is filled twice: by @slot(\'default\') and by content outside any @slot', node.start)
      scopeKey = parentScope
      out.push({ kind: 'component', name: node.tag, props, ...(models.length ? { models } : {}), ...(listens.length ? { listens } : {}), children, fills, region, ...(attach ? { attach } : {}), ...(paths.length ? { paths } : {}), ...(cls ? { class: cls } : {}) })
      return
    }
    if (node.tag === 'slot') {
      // In an island (#465) the content is server HTML the browser never re-renders: so not where the browser re-renders.
      if (stateful && scopeKey !== undefined) fail('in an island, <slot /> goes outside @if, @for and @await blocks and component content: the browser re-renders those, and slot content only exists on the server', node.start)
      let name = 'default'
      const props: { name: string; expr: string }[] = []
      for (const a of node.attrs) {
        if (a.kind === 'static' && a.name === 'name' && typeof a.value === 'string' && a.value) name = a.value
        // What the slot passes to its content (#455): [item]="r".
        else if (a.kind === 'prop' && /^[A-Za-z_$][\w$]*$/.test(a.name)) { checkExpr(a.expr, file, source, a.start + a.name.length + 4); props.push({ name: a.name, expr: a.expr }) }
        else fail('<slot> only takes name="…", and the data it passes to its fill as [name]="expression"', a.start)
      }
      // Fallback content belongs to this component: its holes read this component's inputs.
      const fallback: IRNode[] = []
      const parent = out
      out = fallback
      node.children.forEach((child) => visit(child, rawText))
      out = parent
      // ponytail: island slots are plain holes for server HTML. Data and fallbacks would need the slot in the browser.
      if (stateful && props.length) fail('in an island, a slot passes no data: render the component outside the island to use [name]="…" on <slot>', node.start)
      if (stateful && fallback.length) fail('in an island, a slot has no fallback content', node.start)
      out.push({ kind: 'slot', name, props, fallback })
      return
    }
    const outerSelect = selectModel // restored after this element: a <select>'s binding reaches its options only
    // [(value)] / [(checked)] on a form element: the property, and an event writing it back (copy-on-write).
    const tag = node.tag
    const attrs = node.attrs.flatMap((a): Exclude<Attr, { kind: 'model' }>[] => {
      if (a.kind !== 'model') return [a]
      const bindable = (a.name === 'value' && ['input', 'select', 'textarea'].includes(tag)) || (a.name === 'checked' && tag === 'input')
      if (!bindable) fail(`[(${a.name})] on <${tag}>: an element binds two ways only with [(value)] (input, select, textarea) or [(checked)]`, a.start)
      const type = a.name === 'checked' || tag === 'select' ? 'change' : 'input'
      sameRoot(a.expr, a.start)
      // A radio group (#267): [(value)] on each radio binds one value: checked when it equals the radio's value, and
      // picking the radio writes that value (as Vue's v-model on radios).
      // Radios, checkboxes and number fields bind differently: that needs a static type. A bound [type] (text or email,
      // a field component's prop) binds as text.
      const typeAttr = node.attrs.find((x) => x.kind === 'static' && x.name === 'type')
      const inputType = typeAttr?.kind === 'static' && typeof typeAttr.value === 'string' ? typeAttr.value.toLowerCase() : 'text' // types are case-insensitive
      const path = { kind: 'prop' as const, name: 'data-cl-path', expr: modelPath(a.expr, modelNames), start: a.start }
      // Checkboxes with a value bound by [(value)] (#241): an array, as Vue's v-model: checked when it includes the
      // value; toggling adds or removes it.
      if (a.name === 'value' && tag === 'input' && inputType === 'checkbox') {
        const own = node.attrs.find((x) => x.name === 'value' && (x.kind === 'static' || x.kind === 'prop'))
        if (!own) return fail("a checkbox bound with [(value)] needs a value (value=\"…\" or [value]): it's what goes into the array; for a boolean, use [(checked)]", a.start)
        const mine = own.kind === 'static' ? JSON.stringify(own.value === true ? '' : own.value) : `(${(own as { expr: string }).expr})`
        // A missing array (undefined, null) is an empty one.
        const next = `($event.target.checked ? [...((${a.expr}) ?? []), ${mine}] : ((${a.expr}) ?? []).filter((__cl_x) => __cl_x !== ${mine}))`
        return [
          { kind: 'prop', name: 'checked', expr: `((${a.expr}) ?? []).includes(${mine})`, start: a.start },
          { kind: 'event', name: 'change', expr: writeBack(a.expr, next, a.name, a.start), start: a.start },
          path,
        ]
      }
      // A <select>: its value, or (multiple, static or bound) the selected values as an array. Its options render
      // `selected` on the server (see the option case below), so the page shows the choice before any JavaScript.
      if (a.name === 'value' && tag === 'select') {
        selectModel = a.expr
        return [
          { kind: 'prop', name: a.name, expr: a.expr, start: a.start },
          { kind: 'event', name: 'change', expr: writeBack(a.expr, '($event.target.multiple ? Array.from($event.target.selectedOptions, (__cl_o) => __cl_o.value) : $event.target.value)', a.name, a.start), start: a.start },
          path,
        ]
      }
      // Number and range inputs write numbers (as Vue's v-model): a field that isn't a number (empty) stays a string.
      if (a.name === 'value' && tag === 'input' && (inputType === 'number' || inputType === 'range')) {
        return [
          { kind: 'prop', name: a.name, expr: a.expr, start: a.start },
          { kind: 'event', name: type, expr: writeBack(a.expr, '((__cl_v) => (isNaN(parseFloat(__cl_v)) ? __cl_v : parseFloat(__cl_v)))($event.target.value)', a.name, a.start), start: a.start },
          path,
        ]
      }
      // Text: no write while an input method composes (IME); the composed text is written when it ends.
      if (type === 'input' && !(tag === 'input' && inputType === 'radio')) {
        const write = writeBack(a.expr, `$event.target.${a.name}`, a.name, a.start)
        return [
          { kind: 'prop', name: a.name, expr: a.expr, start: a.start },
          { kind: 'event', name: 'input', expr: `if (!$event.isComposing) { ${write} }`, start: a.start },
          { kind: 'event', name: 'compositionend', expr: write, start: a.start },
          path,
        ]
      }
      if (a.name === 'value' && tag === 'input' && inputType === 'radio') {
        const own = node.attrs.find((x) => x.name === 'value' && (x.kind === 'static' || x.kind === 'prop'))
        if (!own) return fail("a radio bound with [(value)] needs a value (value=\"…\" or [value]): it's what the radio writes when picked", a.start)
        const mine = own.kind === 'static' ? JSON.stringify(own.value === true ? '' : own.value) : `(${(own as { expr: string }).expr})`
        return [
          { kind: 'prop', name: 'checked', expr: `(${a.expr}) === ${mine}`, start: a.start },
          { kind: 'event', name: 'change', expr: writeBack(a.expr, mine, a.name, a.start), start: a.start },
          { kind: 'prop', name: 'data-cl-path', expr: modelPath(a.expr, modelNames), start: a.start },
        ]
      }
      const event = { kind: 'event' as const, name: type, expr: writeBack(a.expr, `$event.target.${a.name}`, a.name, a.start), start: a.start }
      // Its path, for the forms engine (clarusjs/forms): see docs/architecture.md §5.
      return [{ kind: 'prop', name: a.name, expr: a.expr, start: a.start }, event, { kind: 'prop', name: 'data-cl-path', expr: modelPath(a.expr, modelNames), start: a.start }]
    })
    // A field's value and checked go last: a browser clamps a value to the min/max/step (and type) already set.
    const late = (x: { kind: string; name: string }) => x.kind !== 'event' && (x.name === 'value' || x.name === 'checked')
    attrs.sort((x, y) => Number(late(x)) - Number(late(y)))
    // An <option> of a bound <select>: `selected` when the bound value (or array, for multiple) has its value.
    if (tag === 'option' && selectModel !== undefined) {
      const own = node.attrs.find((x) => x.name === 'value' && (x.kind === 'static' || x.kind === 'prop'))
      if (own) {
        const mine = own.kind === 'static' ? JSON.stringify(own.value === true ? '' : own.value) : `(${(own as { expr: string }).expr})`
        attrs.push({ kind: 'prop', name: 'selected', expr: `((__cl_s, __cl_v) => (Array.isArray(__cl_s) ? __cl_s.map(String).includes(String(__cl_v)) : String(__cl_s) === String(__cl_v)))(${selectModel}, ${mine})`, start: own.start })
      }
    }
    // Spread (#405): one per element, never where it could set what loads; and the forms that look like a binding.
    for (const a of node.attrs) {
      if (a.name.startsWith('{')) fail(`${a.name} isn't a binding: spread with [...]="${a.name.replace(/^\{\.*|\}$/g, '')}"`, a.start)
      if (a.kind === 'prop' && a.name.includes('.') && a.name !== '...' && !/^(class|style)\./.test(a.name)) fail(`[${a.name}]: only class. and style. take a . ([class.name], [style.prop])`, a.start)
    }
    const spreads = node.attrs.filter((a) => a.kind === 'prop' && a.name === '...')
    if (spreads.length > 1) fail('one [...] per element', spreads[1]!.start)
    if (spreads.length && SPREAD_REFUSED.has(node.tag.toLowerCase())) fail(`[...] can't spread onto <${node.tag}>: it could set what the element loads (write its attributes one by one)`, spreads[0]!.start)
    emitStatic(`<${node.tag}`)
    const elementEvents = attrs.filter((a) => a.kind === 'event')
    const dynamic: Extract<IRNode, { kind: 'attr' }>[] = []
    let textareaValue: string | undefined
    let engine = false
    for (const a of attrs) {
      if (a.kind === 'static') emitStatic(a.value === true ? ` ${a.name}` : ` ${a.name}="${base ? baseUrl(base, a.name, a.value) : a.value}"`)
      else if (a.kind === 'event') {
        if (!stateful) fail('event bindings need a <script> with state; this component is static', a.start)
        const { type, mods } = splitEvent(a.name)
        const wrong = modifierError(type, mods)
        if (wrong) fail(wrong, a.start)
        checkHandler(a.expr, file, source, a.start)
        const found = source.indexOf(a.expr, a.start)
        const exprStart = found === -1 ? a.start : found // a generated handler ([(value)]): at the binding
        if (inputNames.size) for (const w of writesTo(a.expr, inputNames)) readOnly(w.name, exprStart + w.start)
        // A generated handler ([(value)]) writes a copy already: only handlers as written are checked.
        if (found !== -1) for (const m of mutationsOf(a.expr, stateNames)) warnings.push(new ClarusError(m.message, file, source, exprStart + m.start))
      } else if (a.kind === 'prop' && a.name === '...') {
        checkExpr(a.expr, file, source, a.start)
        const reactive = stateful && (referencesNames(a.expr, scriptScope) || referencesNames(a.expr, loopNames))
        // Written attributes win over the spread's (class and style merge, in the fold): their names, lowercase.
        const skip = [...new Set(attrs.filter((x) => x !== a && x.kind !== 'event').map((x) => x.name.toLowerCase()))]
        const at = new ClarusError('', file, source, a.start)
        const node_ = { kind: 'attr' as const, name: '...', value: { expr: a.expr }, reactive, index: -1, tag: node.tag, skip, ...(a.expr === '__cl_attrs' ? {} : { where: `${file}:${at.line}:${at.column}` }), ...(base ? { base } : {}) }
        if (reactive) dynamic.push(node_)
        out.push(node_)
      } else if (a.kind === 'prop' && a.name === 'use') {
        // [use]="behaviour" (#464): the browser calls it with this element; what it returns, when the element goes.
        if (!stateful) fail('[use] needs a <script> (an island): behaviours run in the browser', a.start)
        checkExpr(a.expr, file, source, a.start)
        const index = useCount++
        emitStatic(` data-cl-u="${index}"`)
        out.push({ kind: 'use', expr: a.expr, index })
      } else if (a.kind === 'prop' && a.name === 'engine') {
        // [engine]="f": this element's form (and its fields) belong to the forms engine f (clarusjs/forms).
        if (!stateful) fail('[engine] needs a <script> (an island): the forms engine runs in the browser', a.start)
        checkExpr(a.expr, file, source, a.start)
        const index = formCount++
        emitStatic(` data-cl-form="${index}"`)
        out.push({ kind: 'connect', expr: a.expr, index })
        engine = true
      } else {
        if (/^on/i.test(a.name)) fail(`use (${a.name.slice(2).toLowerCase()}) for events, not an ${a.name} attribute`, a.start)
        // srcdoc is a whole HTML document: binding data into it is HTML injection, so it stays static.
        if (a.name.toLowerCase() === 'srcdoc') fail('srcdoc cannot be bound; write it as a static attribute', a.start)
        const loads = loadingUrl(node.tag, a.name, node.attrs)
        if (loads) fail(`${a.name} on <${node.tag}> ${loads}, so it can't come from data: write it as a static attribute`, a.start)
        const exprs = a.kind === 'prop' ? [{ expr: a.expr, start: a.start }] : a.parts.filter((p) => typeof p !== 'string')
        for (const e of exprs) checkExpr(e.expr, file, source, e.start)
        const reactive = stateful && exprs.some((e) => referencesNames(e.expr, scriptScope) || referencesNames(e.expr, loopNames))
        const written = a.kind === 'prop' ? { expr: a.expr } : { parts: a.parts.map((p) => (typeof p === 'string' ? p : { expr: p.expr })) }
        // Under a base, a URL attribute's value goes through baseUrl(): the base once, for a root-relative URL.
        const value = base && isBaseAttr(a.name)
          ? { expr: `__cl_baseUrl(${JSON.stringify(base)}, ${JSON.stringify(a.name)}, ${a.kind === 'prop' ? `(${a.expr})` : `[${a.parts.map((p) => (typeof p === 'string' ? JSON.stringify(p) : `(${p.expr})`)).join(', ')}].join('')`})` }
          : written
        const content = node.tag === 'textarea' && a.name === 'value'
        const node_ = { kind: 'attr' as const, name: a.name, value, reactive, index: -1, tag: node.tag, ...(content ? { content: true as const } : {}) }
        if (content) textareaValue = a.kind === 'prop' ? a.expr : `[${a.parts.map((p) => (typeof p === 'string' ? JSON.stringify(p) : `(${p.expr})`)).join(', ')}].join('')`
        if (reactive) dynamic.push(node_)
        out.push(node_)
      }
    }
    // One marker per element for its reactive attributes, one for its events.
    if (dynamic.length) {
      const index = attrElementCount++
      for (const d of dynamic) d.index = index
      emitStatic(` data-cl-a="${index}"`)
    }
    if (elementEvents.length) {
      const index = eventElementCount++
      emitStatic(` data-cl-e="${index}"`)
      for (const a of elementEvents) {
        const { type, mods } = splitEvent(a.name)
        events.push({ index, type, handler: a.kind === 'event' ? a.expr : '', scope: scopeKey, ...(mods.length ? { mods } : {}) })
      }
    }
    emitStatic('>')
    // A textarea's value is its text: written in place of its children.
    if (textareaValue !== undefined) {
      // The HTML parser drops one line break right after <textarea>: write one, so a value starting with one keeps it.
      emitStatic('\n')
      out.push({ kind: 'hole', expr: textareaValue, reactive: false, index: -1 })
      emitStatic('</textarea>')
      return
    }
    const iconBody = iconBodies.get(node)
    if (iconBody !== undefined) emitStatic(iconBody)
    const outer = engineScope
    if (engine) engineScope = { root: null }
    if (tag !== 'select' || !node.attrs.some((x) => x.kind === 'model')) selectModel = tag === 'optgroup' || tag === 'option' ? selectModel : undefined
    const keeps = KEEP_WHITESPACE.has(node.tag)
    if (keeps) keep++
    node.children.forEach((child) => visit(child, RAW_TEXT.has(node.tag) ? node.tag : rawText))
    if (keeps) keep--
    engineScope = outer
    selectModel = outerSelect
    if (!VOID.has(node.tag)) emitStatic(`</${node.tag}>`)
  }

  parsed.nodes.forEach((n) => visit(n))
  return {
    file,
    name: file.split('/').pop()!.replace(/\.tscl$/, ''),
    inputs: parsed.inputs,
    ...(parsed.extends ? { extends: Object.keys(extendedAttrs(parsed.extends.tag)) } : {}),
    imports: parsed.imports,
    script: parsed.script ? split.body : undefined,
    scriptImports: split.imports.map((imp) => imp.text),
    ...(server ? { server } : {}),
    dataImports: parsed.dataImports,
    signals,
    stateful,
    nodes,
    events,
    sends: parsed.events.length > 0,
    sendNames: parsed.events.map((e) => e.name),
    contexts: parsed.contexts,
    provides,
    warnings,
  }
}

/** The first handler or binding in these nodes (an island wires those in the browser): its spelling and place. */
function wiredIn(nodes: TemplateNode[]): { what: string; start: number } | undefined {
  for (const n of nodes) {
    if (n.type === 'element') {
      for (const a of n.attrs) {
        if (a.kind === 'event') return { what: `(${a.name})`, start: a.start }
        if (a.kind === 'model') return { what: `[(${a.name})]`, start: a.start }
        if (a.kind === 'prop' && (a.name === 'use' || a.name === 'engine')) return { what: `[${a.name}]`, start: a.start }
      }
    }
    const inner = n.type === 'element' || n.type === 'fill' ? [n.children]
      : n.type === 'if' ? n.branches.map((b) => b.children)
      : n.type === 'for' ? [n.children, n.empty ?? []]
      : n.type === 'await' ? [n.pending, n.then?.children ?? [], n.catch?.children ?? []]
      : []
    for (const list of inner) { const found = wiredIn(list); if (found) return found }
  }
}

/** What a fill receives, as a function parameter ({ item }, props): checked to be one, located. */
function slotParamsCheck(params: string, file: string, source: string, at: number): void {
  const bad = () => { throw new ClarusError('a fill names what its slot passes like a function parameter: @slot(\'row\', { item }) or @slot(\'row\', props)', file, source, at) }
  try {
    const node = parseExpressionAt(`(${params}) => 0`, 0, { ecmaVersion: 'latest' }) as unknown as { type: string; params?: unknown[]; end: number }
    if (node.type !== 'ArrowFunctionExpression' || node.params?.length !== 1 || node.end !== params.length + 7) bad()
  } catch (err) {
    if (err instanceof ClarusError) throw err
    bad()
  }
}

/** A two-way binding's path: its root name and its segments (`.key`, `[index]`), or null when it isn't a path. */
function pathSegments(path: string): { root: string; segments: ({ key: string } | { index: string })[] } | null {
  const root = /^[A-Za-z_$][\w$]*/.exec(path)?.[0]
  if (!root) return null
  const segments: ({ key: string } | { index: string })[] = []
  for (let rest = path.slice(root.length); rest; ) {
    const key = /^\.([A-Za-z_$][\w$]*)/.exec(rest)
    if (key) { segments.push({ key: key[1]! }); rest = rest.slice(key[0].length); continue }
    if (rest[0] !== '[') return null
    let depth = 0
    let close = 0
    for (; close < rest.length; close++) {
      if (rest[close] === '[') depth++
      else if (rest[close] === ']' && --depth === 0) break
    }
    const index = rest.slice(1, close).trim()
    if (close >= rest.length || !index) return null
    segments.push({ index })
    rest = rest.slice(close + 1)
  }
  return { root, segments }
}

/**
 * The forms engine's path for a two-way binding, as a JS expression: the path without its root name, dotted, with
 * computed indexes evaluated: `order.lines[$index].item` → `"lines." + ($index) + ".item"`, `value` → `""`.
 */
function modelPath(path: string, models: Set<string> = new Set()): string {
  const parsed = pathSegments(path)
  const parts = (parsed?.segments ?? []).map((seg) => {
    if ('key' in seg) return JSON.stringify(seg.key)
    // A literal key is its value ('email', "\u0065mail", 2); anything else is computed where it's rendered.
    let literal: unknown
    try {
      const node = parseExpressionAt(seg.index, 0, { ecmaVersion: 'latest' }) as unknown as { type: string; value?: unknown; end: number }
      if (node.type === 'Literal' && node.end === seg.index.length && (typeof node.value === 'string' || typeof node.value === 'number')) literal = node.value
    } catch {}
    return literal !== undefined ? JSON.stringify(String(literal)) : `(${seg.index})`
  })
  // Bound to one of this component's own @model inputs: its path comes from the parent ('@name', resolved by the
  // engine through the island's data-cl-path-name).
  if (parsed && models.has(parsed.root)) parts.unshift(JSON.stringify(`@${parsed.root}`))
  if (!parts.length) return '""'
  return parts.map((p, i) => (i ? `"." + ${p}` : p)).join(' + ')
}

// #248: URLs that load a page, plugin, stylesheet or base URL into this page. A value from data there (even
// https) could embed anyone's page or restyle the site, so these are static only, like srcdoc. Links and images
// keep the URL check (runtime/attrs.ts). (<script> in markup is `inline`, which takes static attributes only.)
const LOADS: Record<string, Record<string, string>> = {
  iframe: { src: 'loads a page into this one', sandbox: 'sets what the iframe may do', allow: 'sets what the iframe may do', referrerpolicy: 'sets what the iframe sends' },
  frame: { src: 'loads a page into this one' },
  embed: { src: 'loads a plugin or page into this one' },
  object: { data: 'loads a plugin or page into this one', codebase: 'sets where a plugin loads from' },
  base: { href: 'sets where every relative URL on the page points' },
}
// <link> rels that load nothing: their href may come from data (a canonical URL from the page's path).
const SAFE_RELS = new Set(['canonical', 'alternate', 'prev', 'next', 'author', 'license', 'help', 'search', 'me', 'bookmark', 'external', 'nofollow', 'noopener', 'noreferrer', 'tag', 'privacy-policy', 'terms-of-service'])

/** Why binding `attr` on `<tag>` is refused (it loads something into the page), or undefined. */
function loadingUrl(tag: string, attr: string, attrs: Attr[]): string | undefined {
  const t = tag.toLowerCase()
  const name = attr.toLowerCase()
  if (t === 'link' && name === 'href') {
    // Exactly one rel, and static: a second one (bound, or later in the tag) could say what really loads.
    const relAttrs = attrs.filter((x) => x.name.toLowerCase() === 'rel')
    const rel = relAttrs.length === 1 ? relAttrs[0] : undefined
    const rels = rel?.kind === 'static' && typeof rel.value === 'string' ? rel.value.toLowerCase().split(/\s+/).filter(Boolean) : []
    return rels.length && rels.every((r) => SAFE_RELS.has(r)) ? undefined : 'can load a stylesheet, icon or script (only rel="canonical", "alternate" and other rels that load nothing take an href from data)'
  }
  return LOADS[t]?.[name]
}
