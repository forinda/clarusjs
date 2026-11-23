// Public compiler entry. Pure: string in, string out.
import { emitClient } from './emit-client.ts'
import { ClarusError } from './errors.ts'
import { emitServer } from './emit-server.ts'
import { lower } from './ir.ts'
import { parse, type TemplateNode } from './parse.ts'

export { ClarusError } from './errors.ts'
export { parse } from './parse.ts'
import { foldClass } from './class-style.ts'
export { checkIcons, type IconResolver } from './icon.ts'
import type { IconResolver } from './icon.ts'
export { lint, lintRules, type LintRule, type LintLevel, type LintConfig, type LintMessage, type LintRuleDef, type LintContext, type LintElement } from './lint.ts'
export type { ParsedFile, InputDecl, ImportDecl, TemplateNode, Attr } from './parse.ts'

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
  const warnings: ClarusError[] = []
  // Every component's top-level elements carry its scope class, styled or not: a parent's scope then takes in a
  // child's top-level element and stops inside it.
  const id = options.scope ?? scopeId(options.file)
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
    } else if (node.type === 'element' && components.has(node.tag)) markSlotContent(node.children, cls, components)
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
    }
  }
}
