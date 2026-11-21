// Syntax tree → IR: static HTML chunks, holes (reactive or not), child components, events. Build-time checks live here.
import { parseExpressionAt } from 'acorn'
import { ClarusError } from './errors.ts'
import { FOR_IMPLICIT, importNames, type Attr, type DataImport, type ImportDecl, type InputDecl, type ParsedFile, type TemplateNode } from './parse.ts'
import { analyzeScript, writesTo, checkExpr, checkHandler, referencesNames, scriptNames, splitImports, type Signals } from './script.ts'

export type IRNode =
  | { kind: 'static'; html: string }
  | { kind: 'hole'; expr: string; reactive: boolean; index: number; json?: true } // index = -1 when not reactive; json: JSON-LD
  // children: content for the default slot; fills: content for named slots (@slot('name') { … }).
  // region: inside an island, a component whose props read state or that wraps content gets markers so the browser
  // can re-render it (-1 otherwise).
  // models: [(name)]="path" bindings: each write from the child runs `set` (a statement using __cl_v).
  | { kind: 'component'; name: string; props: { name: string; expr: string }[]; models?: { name: string; set: string }[]; children: IRNode[]; fills: { name: string; nodes: IRNode[] }[]; region: number; attach?: string; paths?: { name: string; expr: string }[]; class?: string }
  // Where a stateless component renders content it is given ('default' or a name); fallback shows when none is given.
  | { kind: 'slot'; name: string; fallback: IRNode[] }
  // A dynamic attribute: [name]="expr" (value) or name="a {{ b }}" (parts, joined into a string).
  | { kind: 'attr'; name: string; value: { expr: string } | { parts: (string | { expr: string })[] }; reactive: boolean; index: number; tag: string }
  // [engine]="f": an element connected to a form from clarusjs/forms (marked data-cl-form="index").
  | { kind: 'connect'; expr: string; index: number }
  // @if / @else. block = -1 outside islands (plain server-side choice); inside an island, the block's marker index.
  | { kind: 'if'; branches: { cond: string | null; nodes: IRNode[] }[]; block: number }
  // @for / @empty. block = -1 outside islands; inside an island, the list's marker index. `item` and `$index` are in
  // scope in `nodes`; `track` (or the index) keys rows.
  | { kind: 'for'; item: string; list: string; track: string | null; nodes: IRNode[]; empty: IRNode[] | null; block: number }
// scope: which @if branch the element is in ("block.branch"); undefined at the top level.
export type IREvent = { index: number; type: string; handler: string; scope?: string }
export type ComponentIR = {
  file: string
  name: string // basename without .tscl
  inputs: InputDecl[]
  imports: ImportDecl[]
  script?: string // without its import statements, which are in scriptImports
  scriptImports: string[]
  dataImports: DataImport[]
  signals: Signals
  stateful: boolean
  nodes: IRNode[]
  events: IREvent[]
  /** Things that compile but likely aren't meant (located, not thrown). */
  warnings: ClarusError[]
}

const ATTACH_MODES = ['load', 'idle', 'visible', 'interaction']
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])

export function lower(parsed: ParsedFile, file: string, source: string): ComponentIR {
  const fail = (text: string, at: number): never => { throw new ClarusError(text, file, source, at) }
  // An island: it has a script, or a @model input (which it writes, even from an event handler alone).
  const stateful = !!parsed.script || parsed.inputs.some((i) => i.model)
  const warnings: ClarusError[] = []
  // This component's @model inputs: fields bound to them take their path from the parent (see modelPath).
  const modelNames = new Set(parsed.inputs.filter((i) => i.model).map((i) => i.name))
  const split = parsed.script ? splitImports(parsed.script.code, file, source, parsed.script.start) : { imports: [], body: '' }
  const signals: Signals = parsed.script ? analyzeScript(split.body, file, source, parsed.script.start) : new Map()
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

  function visit(node: TemplateNode, rawText?: string): void {
    if (node.type === 'text') return emitStatic(node.value)
    if (node.type === 'fill') return fail('@slot only works directly inside a component tag', node.start)
    if (node.type === 'if') {
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
      out.push({ kind: 'if', branches, block })
      return
    }
    if (node.type === 'for') {
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
      if (block >= 0 && node.track === null) warnings.push(new ClarusError('@for without track: rows are matched by position, so a row\'s state moves to another item when the list changes order; add track item.id (or another unique key)', file, source, node.start))
      const nodes = lowerInto(node.children, `f${block}`, new Set([...parentLoop, node.item, ...FOR_IMPLICIT]))
      const empty = node.empty ? lowerInto(node.empty, `f${block}e`, parentLoop) : null
      out = parent
      scopeKey = parentScope
      loopNames = parentLoop
      out.push({ kind: 'for', item: node.item, list: node.list, track: node.track, nodes, empty, block })
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
    if (components.has(node.tag)) {
      const props: { name: string; expr: string }[] = []
      const models: { name: string; set: string }[] = []
      let attach: string | undefined
      let cls: string | undefined
      const paths: { name: string; expr: string }[] = []
      for (const a of node.attrs) {
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
        else if (a.kind === 'static' && a.name === 'attach') {
          // When the island's code loads in the browser (see runtime/loader.ts).
          if (typeof a.value !== 'string' || !ATTACH_MODES.includes(a.value)) fail(`attach must be one of ${ATTACH_MODES.join(', ')}`, a.start)
          attach = a.value as string
        } else fail(`component <${node.tag}> only takes [prop] and [(prop)] bindings and attach="…"`, a.start)
      }
      // Content is rendered here, in this component's scope, and handed to the child for its slots.
      const hasContent = node.children.some((c) => c.type !== 'text' || c.value.trim())
      const readsState = props.some((p) => referencesNames(p.expr, scriptScope) || referencesNames(p.expr, loopNames))
      const region = stateful && (hasContent || readsState || models.length > 0) ? regionCount++ : -1
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
      const fills: { name: string; nodes: IRNode[] }[] = []
      for (const child of node.children) {
        if (child.type !== 'fill') continue
        if (fills.some((f) => f.name === child.name)) fail(`slot "${child.name}" is filled twice`, child.start)
        fills.push({ name: child.name, nodes: lowerList(child.children) })
      }
      const rest = node.children.filter((c) => c.type !== 'fill')
      // Whitespace around @slot blocks is not content for the default slot.
      const children = rest.every((c) => c.type === 'text' && !c.value.trim()) ? [] : lowerList(rest)
      scopeKey = parentScope
      out.push({ kind: 'component', name: node.tag, props, ...(models.length ? { models } : {}), children, fills, region, ...(attach ? { attach } : {}), ...(paths.length ? { paths } : {}), ...(cls ? { class: cls } : {}) })
      return
    }
    if (node.tag === 'slot') {
      if (stateful) fail('<slot /> is only supported in components without <script>', node.start)
      let name = 'default'
      for (const a of node.attrs) {
        if (a.kind === 'static' && a.name === 'name' && typeof a.value === 'string' && a.value) name = a.value
        else fail('<slot> only takes name="…"', a.start)
      }
      // Fallback content belongs to this component: its holes read this component's inputs.
      const fallback: IRNode[] = []
      const parent = out
      out = fallback
      node.children.forEach((child) => visit(child, rawText))
      out = parent
      out.push({ kind: 'slot', name, fallback })
      return
    }
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
      const typeAttr = node.attrs.find((x) => x.kind === 'static' && x.name === 'type')
      const inputType = typeAttr?.kind === 'static' && typeof typeAttr.value === 'string' ? typeAttr.value : 'text'
      const path = { kind: 'prop' as const, name: 'data-cl-path', expr: modelPath(a.expr, modelNames), start: a.start }
      // Checkboxes with a value bound by [(value)] (#241): an array, as Vue's v-model: checked when it includes the
      // value; toggling adds or removes it.
      if (a.name === 'value' && tag === 'input' && inputType === 'checkbox') {
        const own = node.attrs.find((x) => x.name === 'value' && (x.kind === 'static' || x.kind === 'prop'))
        if (!own) return fail("a checkbox bound with [(value)] needs a value (value=\"…\" or [value]): it's what goes into the array; for a boolean, use [(checked)]", a.start)
        const mine = own.kind === 'static' ? JSON.stringify(own.value === true ? '' : own.value) : `(${(own as { expr: string }).expr})`
        const next = `($event.target.checked ? [...(${a.expr}), ${mine}] : (${a.expr}).filter((__cl_x) => __cl_x !== ${mine}))`
        return [
          { kind: 'prop', name: 'checked', expr: `(${a.expr}).includes(${mine})`, start: a.start },
          { kind: 'event', name: 'change', expr: writeBack(a.expr, next, a.name, a.start), start: a.start },
          path,
        ]
      }
      // <select multiple>: the selected values, as an array.
      if (a.name === 'value' && tag === 'select' && node.attrs.some((x) => x.kind === 'static' && x.name === 'multiple')) {
        return [
          { kind: 'prop', name: a.name, expr: a.expr, start: a.start },
          { kind: 'event', name: 'change', expr: writeBack(a.expr, 'Array.from($event.target.selectedOptions, (__cl_o) => __cl_o.value)', a.name, a.start), start: a.start },
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
    emitStatic(`<${node.tag}`)
    const elementEvents = attrs.filter((a) => a.kind === 'event')
    const dynamic: Extract<IRNode, { kind: 'attr' }>[] = []
    let engine = false
    for (const a of attrs) {
      if (a.kind === 'static') emitStatic(a.value === true ? ` ${a.name}` : ` ${a.name}="${a.value}"`)
      else if (a.kind === 'event') {
        if (!stateful) fail('event bindings need a <script> with state; this component is static', a.start)
        checkHandler(a.expr, file, source, a.start)
        if (inputNames.size) {
          const found = source.indexOf(a.expr, a.start)
          const exprStart = found === -1 ? a.start : found // a generated handler ([(value)]): at the binding
          for (const w of writesTo(a.expr, inputNames)) readOnly(w.name, exprStart + w.start)
        }
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
        const value = a.kind === 'prop' ? { expr: a.expr } : { parts: a.parts.map((p) => (typeof p === 'string' ? p : { expr: p.expr })) }
        const node_ = { kind: 'attr' as const, name: a.name, value, reactive, index: -1, tag: node.tag }
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
      for (const a of elementEvents) events.push({ index, type: a.name, handler: a.kind === 'event' ? a.expr : '', scope: scopeKey })
    }
    emitStatic('>')
    const outer = engineScope
    if (engine) engineScope = { root: null }
    node.children.forEach((child) => visit(child, RAW_TEXT.has(node.tag) ? node.tag : rawText))
    engineScope = outer
    if (!VOID.has(node.tag)) emitStatic(`</${node.tag}>`)
  }

  parsed.nodes.forEach((n) => visit(n))
  return {
    file,
    name: file.split('/').pop()!.replace(/\.tscl$/, ''),
    inputs: parsed.inputs,
    imports: parsed.imports,
    script: parsed.script ? split.body : undefined,
    scriptImports: split.imports.map((imp) => imp.text),
    dataImports: parsed.dataImports,
    signals,
    stateful,
    nodes,
    events,
    warnings,
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
