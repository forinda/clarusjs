// Public compiler entry. Pure: string in, string out.
import { emitClient } from './emit-client.ts'
import { ClarusError } from './errors.ts'
import { emitServer } from './emit-server.ts'
import { lower, SPREAD_REFUSED } from './ir.ts'
import { autoImport, type ComponentNames } from './components.ts'
import { ELEMENT_ATTRS } from './element-attrs.ts'
import { awaitLists, fragmentRoot, parse, rootNodes, type Attr, type TemplateNode } from './parse.ts'

export { ClarusError } from './errors.ts'
export { parse } from './parse.ts'
export { componentIndex, COMPONENT_DIRS, type ComponentNames } from './components.ts'
import { foldClass } from './class-style.ts'
export { checkIcons, type IconResolver } from './icon.ts'
import type { IconResolver } from './icon.ts'
export { lint, lintRules, type LintRule, type LintLevel, type LintConfig, type LintMessage, type LintRuleDef, type LintContext, type LintElement } from './lint.ts'
export type { ParsedFile, InputDecl, EventDecl, ImportDecl, TemplateNode, Attr } from './parse.ts'

/**
 * `renderImports`: import child components' render functions with `?render`, for a render module that runs in the
 * browser (a client route's page, or a component re-rendered inside an island).
 */
/**
 * `compile()`'s options: the file (for errors and the style scope), the target (`'server'` renders HTML, `'client'`
 * attaches an island), and for the server target the island's client URL.
 * `scope`: the id that scopes this component's styles (default: from the file name).
 * @see https://clarusjs.com/reference/compiler#compile
 */
export type CompileOptions = {
  /**
   * The page's layouts (#456), outermost first, as import specifiers: its folder and config layouts, which the plugin
   * finds. The page's template is wrapped in them (each gets the route's `path` and `params`); `@layout none` skips them.
   */
  layouts?: string[]
  /**
   * Automatic imports (#458): tag names → component paths, from `componentIndex()`. A tag the template uses that's
   * here and not imported by the file is imported; other hyphenated tags stay HTML.
   */
  components?: ComponentNames
  file: string
  target: 'server' | 'client'
  clientUrl?: string
  renderImports?: boolean
  scope?: string
  collapseWhitespace?: boolean
  loader?: string
  hot?: string
  /** Finds `<icon name="set:name">` icons: `(name) => resolveIcon(name, file)` from clarusjs/icons. Without it, `<icon>` is an error. */
  icon?: IconResolver
}
/**
 * `css`: the component's stylesheet (`<style scoped>` blocks wrapped in @scope, the others as written); '' without
 * <style>. `warnings`: things that compile but likely aren't meant (each a located ClarusError, not thrown).
 * @see https://clarusjs.com/reference/compiler#compile
 */
export type CompileResult = { code: string; stateful: boolean; css: string; warnings: ClarusError[] }

/**
 * Compile a `.tscl` component: for the server, a module whose `render(props)` returns its HTML; for the client, an
 * island's `attach(root, props)` (or `export {}` when it has no script). Pure: strings in, strings out. Throws a
 * located `ClarusError` for a template it can't compile.
 * @example
 * ```ts
 * import { compile } from 'clarusjs/compiler'
 * const { code, css, stateful, warnings } = compile(source, { file: 'src/components/card.tscl', target: 'server', clientUrl: '/card.js' })
 * ```
 * @see https://clarusjs.com/reference/compiler#compile
 */
export function compile(source: string, options: CompileOptions): CompileResult {
  const parsed = parse(source, options.file)
  checkExtends(parsed, options.file, source)
  const fragmentRoot = unwrapFragments(parsed, options.file, source)
  if (options.components) autoImport(parsed, options.components, options.file, source)
  if (options.layouts?.length && parsed.layout !== 'none') wrapInLayouts(parsed, options.layouts, options.file, source)
  const warnings: ClarusError[] = []
  // Every component's top-level elements carry its scope class, styled or not: a parent's scope then takes in a
  // child's top-level element and stops inside it.
  const id = options.scope ?? scopeId(options.file)
  if (!fragmentRoot) fallThrough(parsed) // a <fragment> root renders no element for them
  foldClass(parsed.nodes, new Set(parsed.imports.map((imp) => imp.name)))
  // Slot content is marked only when this component has scoped styles to reach it (#418): no class on every
  // paragraph of every Markdown page otherwise.
  markRoots(parsed.nodes, `cl-c-${id}`, new Set(parsed.imports.map((imp) => imp.name)), parsed.styles.some((st) => st.mode === 'scoped'))
  let css = ''
  for (const s of parsed.styles) {
    if (s.mode === 'plain') {
      // ponytail: for one minor version after <style> stopped being scoped by default; drop the warning after it.
      warnings.push(new ClarusError('a plain <style> is global: add `scoped` to scope it to this component (it used to be scoped by default), or `global` to keep it global without this warning', options.file, source, s.tag))
    }
    if (s.mode !== 'scoped') { css += s.css; continue }
    // Native @scope: rules apply inside the component's top-level elements (style those with :scope) and to the
    // top-level elements of the components it renders, not inside those.
    // Statements that must be top-level (@reference for Tailwind's @apply, @import) go before the @scope block.
    const head = /^(?:\s*@(?:reference|import)\b[^;{]*;)+/.exec(s.css)?.[0] ?? ''
    const statements = head.split(';').map((x) => x.trim()).filter(Boolean).map((x) => `${x};\n`).join('')
    css += `${statements}@scope (.cl-c-${id}) to ([class*="cl-c-"]:not(.cl-c-${id}) > *) {${s.css.slice(head.length).replace(/\s*$/, '')}\n}\n`
  }
  // renderImports: a render module that runs in the browser (a client route's page, a child an island re-renders).
  if (options.renderImports && parsed.serverScript) throw new ClarusError('<script server> runs on the server only, and this component renders in the browser (a client route, or a child of an island, which re-renders it): make the route static or server, or render the component outside the island', options.file, source, parsed.serverScript.tag)
  const ir = lower(parsed, options.file, source, { collapseWhitespace: options.collapseWhitespace, icon: options.icon })
  warnings.push(...ir.warnings)
  if (options.target === 'client') return { code: emitClient(ir, options.hot), stateful: ir.stateful, css, warnings }
  if (ir.stateful && !options.clientUrl) throw new Error(`[clarusjs] ${options.file}: clientUrl is required to compile a stateful component for the server`)
  return { code: emitServer(ir, options.clientUrl ?? '', options.renderImports, options.loader), stateful: ir.stateful, css, warnings }
}

/** 'src/components/card.tscl' → 'card-<short hash of the path>'. @internal */
export function scopeId(file: string): string {
  let h = 0x811c9dc5 // FNV-1a
  for (let i = 0; i < file.length; i++) h = Math.imul(h ^ file.charCodeAt(i), 0x01000193)
  const name = (file.split(/[\\/]/).pop() ?? 'c').replace(/\.tscl$/, '').replace(/[^\w-]/g, '') || 'c'
  return `${name}-${(h >>> 0).toString(36)}`
}

// Elements that aren't the component's own visible markup: the document element, <head> tags (a page's or ones it
// moves there), scripts.
const UNMARKED = new Set(['slot', 'cl-head', 'script', 'style', 'html', 'title', 'meta', 'link', 'base'])

/**
 * The component's top-level HTML elements (also inside top-level @if/@for) get the scope class, merged with theirs,
 * then the class its parent passed (`<card class="wide">`): `__cl_class`, ' wide' or '', which render() and attach()
 * define.
 */
/** The scope class on the top-level elements of content passed to a component (static, merged with their own class). */
function markSlotContent(nodes: TemplateNode[], cls: string, components: Set<string>): void {
  for (const node of nodes) {
    if (node.type === 'fill') markSlotContent(node.children, cls, components)
    else if (node.type === 'if') for (const b of node.branches) markSlotContent(b.children, cls, components)
    else if (node.type === 'for') {
      markSlotContent(node.children, cls, components)
      if (node.empty) markSlotContent(node.empty, cls, components)
    } else if (node.type === 'await') for (const kids of awaitLists(node)) markSlotContent(kids, cls, components)
    else if (node.type === 'element' && components.has(node.tag)) markSlotContent(node.children, cls, components)
    else if (node.type === 'element' && !UNMARKED.has(node.tag)) {
      const at = node.attrs.findIndex((a) => a.name === 'class' && a.kind !== 'event')
      const own = node.attrs[at]
      if (!own) node.attrs.push({ kind: 'static', name: 'class', value: cls, start: node.start })
      else if (own.kind === 'static') node.attrs[at] = { ...own, value: own.value === true || !own.value ? cls : `${own.value} ${cls}` }
      else if (own.kind === 'interp') own.parts.push(` ${cls}`)
      else if (own.kind === 'prop') node.attrs[at] = { kind: 'interp', name: 'class', parts: [{ expr: own.expr.startsWith('__cl_classValue(') ? own.expr : `__cl_classValue((${own.expr}))`, start: own.start }, ` ${cls}`], start: own.start }
    }
  }
}

// ARIA attributes that hold a list of ids (#463): a passed one joins the root's own instead of losing to it.
const ID_LISTS = ['aria-describedby', 'aria-labelledby', 'aria-controls', 'aria-owns']

/**
 * `@extends tag`: a known element, and the component's root is that element (one, or a stateless @if … @else of one
 * each: an island re-renders blocks in the browser, without the passed attributes).
 */
function checkExtends(parsed: ReturnType<typeof parse>, file: string, source: string): void {
  const ext = parsed.extends
  if (!ext) return
  const fail = (text: string, at: number): never => { throw new ClarusError(text, file, source, at) }
  if (!ELEMENT_ATTRS[ext.tag]) fail(`@extends ${ext.tag}: clarusjs knows the attributes of ${Object.keys(ELEMENT_ATTRS).join(', ')}`, ext.start)
  const top = rootNodes
  const nodes = top(parsed.nodes)
  const is = (list: TemplateNode[]) => list.length === 1 && list[0]!.type === 'element' && list[0]!.tag === ext.tag
  // Its own [...] spread takes the place of the passed attributes (see fallOnto): they would be dropped.
  const spread = (el: TemplateNode) => el.type === 'element' && el.attrs.some((a) => a.kind === 'prop' && a.name === '...')
  for (const r of [nodes, ...(nodes[0]?.type === 'if' ? nodes[0].branches.map((b) => top(b.children)) : [])]) if (is(r) && spread(r[0]!)) fail(`@extends ${ext.tag}: its root has its own [...] spread, which takes the place of the attributes passed to it; pass what it spreads as inputs instead`, r[0]!.start)
  if (is(nodes)) return
  const first = nodes[0]
  const wrong = `@extends ${ext.tag}: the root must be a <${ext.tag}>, where the attributes land`
  if (nodes.length !== 1 || first!.type !== 'if') return fail(wrong, (nodes[0] ?? { start: ext.start }).start)
  if (parsed.script || parsed.inputs.some((i) => i.model)) fail(`@extends ${ext.tag}: an island's root must be one <${ext.tag}> (it re-renders an @if in the browser, without the passed attributes)`, first.start)
  if (first.branches.at(-1)!.cond !== null || !first.branches.every((b) => is(top(b.children)))) fail(wrong, first.start)
}

/**
 * `<fragment>` groups nodes without rendering an element: each one is replaced by its children, anywhere in the
 * template, before anything else sees it. It takes no attributes (there is no element to put them on); true when it
 * is the component's root, which then takes none from a parent either.
 */
function unwrapFragments(parsed: ReturnType<typeof parse>, file: string, source: string): boolean {
  const reserved = parsed.imports.find((i) => i.name === 'fragment')
  if (reserved) throw new ClarusError('fragment is reserved: <fragment> groups elements without rendering one; import the component under another name', file, source, reserved.start)
  // Every list of child nodes, whatever holds it: elements, @if branches, @for (and its @empty), @await parts, fills.
  const isNode = (x: unknown) => !!x && typeof x === 'object' && 'type' in x
  const holders = (n: TemplateNode): { children: TemplateNode[] }[] => {
    const out: { children: TemplateNode[] }[] = []
    for (const v of Object.values(n)) {
      const items = Array.isArray(v) ? v : [v]
      for (const x of items) if (x && typeof x === 'object' && !isNode(x) && Array.isArray(x.children)) out.push(x)
    }
    return out
  }
  const flat = (nodes: TemplateNode[]): TemplateNode[] =>
    nodes.flatMap((n) => {
      if ('children' in n) n.children = flat(n.children)
      const r = n as unknown as Record<string, unknown>
      for (const key of ['pending', 'empty']) if (Array.isArray(r[key])) r[key] = flat(r[key] as TemplateNode[])
      for (const h of holders(n)) h.children = flat(h.children)
      if (n.type !== 'element' || n.tag !== 'fragment') return [n]
      if (n.attrs.length) throw new ClarusError('<fragment> renders no element: attributes and events can\'t land on it', file, source, n.start)
      return n.children
    })
  const root = fragmentRoot(parsed.nodes)
  parsed.nodes = flat(parsed.nodes)
  return root
}

/**
 * Attributes a parent passes to this component land on its root element (#463): a spread of __cl_attrs (the passed
 * attribute-like props, see passed() in runtime/attrs.ts) onto the one top-level element, which can be a component too.
 * The root's own attributes win (the spread's rule), except style (the fold merges it) and ARIA id lists (joined here).
 * ponytail: nothing falls through with several top-level elements, or text or blocks beside one; Vue warns there.
 */
function fallThrough(parsed: ReturnType<typeof parse>): void {
  const meaningfulOf = (nodes: typeof parsed.nodes) => nodes.filter((n) => !(n.type === 'text' && !n.value.trim()) && !(n.type === 'element' && UNMARKED.has(n.tag)))
  const meaningful = meaningfulOf(parsed.nodes)
  if (meaningful.length !== 1) return
  const top = meaningful[0]!
  // @if … @else, one element per branch: each is the root (not in an island: its browser render lacks them).
  if (top.type === 'if') {
    const roots = top.branches.map((b) => meaningfulOf(b.children))
    if (parsed.script || parsed.inputs.some((i) => i.model) || top.branches.at(-1)!.cond !== null || roots.some((r) => r.length !== 1 || r[0]!.type !== 'element')) return
    for (const [r] of roots) fallOnto(parsed, r as El)
    return
  }
  if (top.type === 'element') fallOnto(parsed, top)
}

type El = Extract<ReturnType<typeof parse>['nodes'][number], { type: 'element' }>
function fallOnto(parsed: ReturnType<typeof parse>, root: El): void {
  // Not onto elements that load something (iframe, embed…): a spread could set what they load.
  if (SPREAD_REFUSED.has(root.tag.toLowerCase())) return
  // ponytail: a root with its own [...] takes none (in an island its spread is wired in the browser, which doesn't have
  // the passed attributes); merge them into it when a part needs both.
  if (root.attrs.some((a) => a.kind === 'prop' && a.name === '...')) return
  // ponytail: an island whose root is a component re-renders it in the browser, which doesn't have the passed attributes.
  const island = !!parsed.script || parsed.inputs.some((i) => i.model)
  if (island && parsed.imports.some((i) => i.name === root.tag)) return
  root.attrs.push({ kind: 'prop', name: '...', expr: '__cl_attrs', start: root.start })
  for (const [i, a] of root.attrs.entries()) {
    if (a.kind !== 'static' || typeof a.value !== 'string' || !ID_LISTS.includes(a.name.toLowerCase())) continue
    const more = `__cl_attrs[${JSON.stringify(a.name)}] == null ? "" : " " + __cl_attrs[${JSON.stringify(a.name)}]`
    root.attrs[i] = { kind: 'interp', name: a.name, parts: [a.value, { expr: more, start: a.start }], start: a.start }
  }
  // style, on an element (a component root gets it in the spread, as a prop): after a static one of the root's own; the
  // root's own [style] wins; else the passed one, since an element's spread skips style.
  if (parsed.imports.some((i) => i.name === root.tag)) return
  // Not with bound styles ([style], [style.x]): those are wired in an island's browser code, without the passed ones.
  if (root.attrs.some((a) => (a.name === 'style' || a.name.startsWith('style.')) && a.kind !== 'event' && a.kind !== 'static')) return
  const style = root.attrs.findIndex((a) => a.name === 'style' && a.kind !== 'event')
  const ownStyle = root.attrs[style]
  if (ownStyle?.kind === 'static' && typeof ownStyle.value === 'string') {
    root.attrs[style] = { kind: 'interp', name: 'style', parts: [ownStyle.value, { expr: '__cl_attrs.style == null ? "" : "; " + __cl_attrs.style', start: ownStyle.start }], start: ownStyle.start }
  } else if (!ownStyle) root.attrs.push({ kind: 'prop', name: 'style', expr: '__cl_attrs.style', start: root.start })
}

function markRoots(nodes: TemplateNode[], cls: string, components: Set<string>, slots = false): void {
  for (const node of nodes) {
    if (node.type === 'element' && !components.has(node.tag) && !UNMARKED.has(node.tag)) {
      const at = node.attrs.findIndex((a) => a.name === 'class' && a.kind !== 'event')
      const own = node.attrs[at]
      const passed = { expr: '__cl_class', start: node.start }
      if (!own) node.attrs.push({ kind: 'interp', name: 'class', parts: [cls, passed], start: node.start })
      else if (own.kind === 'static') node.attrs[at] = { kind: 'interp', name: 'class', parts: [own.value === true || !own.value ? cls : `${own.value} ${cls}`, passed], start: own.start }
      else if (own.kind === 'interp') own.parts.push(` ${cls}`, passed)
      // ponytail: a bound [class] that is null/false still gets the scope class (the class can't go away entirely).
      // classValue: the bound value may be an object or an array (#403), joined here with the scope class as text.
      else if (own.kind === 'prop') node.attrs[at] = { kind: 'interp', name: 'class', parts: [{ expr: own.expr.startsWith('__cl_classValue(') ? own.expr : `__cl_classValue((${own.expr}))`, start: own.start }, ` ${cls}`, passed], start: own.start }
    } else if (node.type === 'element' && components.has(node.tag)) {
      // Content passed to a component (#418: a page's content inside its layout) is this component's own: its
      // top-level elements get the scope class too (not the class passed to this component, which is for its own
      // top-level output), default slot and @slot('name') fills alike.
      if (slots) markSlotContent(node.children, cls, components)
    } else if (node.type === 'if') {
      for (const b of node.branches) markRoots(b.children, cls, components, slots)
    } else if (node.type === 'for') {
      markRoots(node.children, cls, components, slots)
      if (node.empty) markRoots(node.empty, cls, components, slots)
    } else if (node.type === 'await') {
      for (const kids of awaitLists(node)) markRoots(kids, cls, components, slots)
    }
  }
}

/**
 * Wrap a page's template in its layouts (#456): each becomes an imported component (a generated name) around the
 * next, the page's own nodes innermost, so they keep their places and a top-level @slot fill goes to the innermost
 * layout. Each layout gets the route's path and params from the render options.
 */
function wrapInLayouts(parsed: ReturnType<typeof parse>, layouts: string[], file: string, source: string): void {
  // ponytail: not around an island page: the layout would be inside the island (re-rendered in the browser, with its
  // <html>). Lift it by rendering layouts around the island's output instead.
  if (parsed.script || parsed.inputs.some((i) => i.model)) {
    throw new ClarusError('this page is an island (it has a <script> or a @model input), and folder or config layouts can\'t wrap an island yet: move the script into a component the page uses, or add @layout none', file, source, 0)
  }
  let nodes = parsed.nodes
  for (let k = layouts.length - 1; k >= 0; k--) {
    const name = `__cl_layout_${k}`
    parsed.imports.push({ name, from: layouts[k]!, start: 0 })
    const attrs: Attr[] = [
      { kind: 'prop', name: 'path', expr: "__cl_opts?.route?.path ?? ''", start: 0 },
      { kind: 'prop', name: 'params', expr: '__cl_opts?.route?.params ?? {}', start: 0 },
    ]
    nodes = [{ type: 'element', tag: name, attrs, children: nodes, start: 0 }]
  }
  parsed.nodes = nodes
}
