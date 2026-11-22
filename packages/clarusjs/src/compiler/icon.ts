// <icon name="set:name" />: a built-in tag, drawn at compile time from the icon sets the caller resolves (the compiler
// stays pure: clarusjs/vite, clarusjs check and the editor pass `resolveIcon` from clarusjs/icons).
import type { IconLookup } from '../icons.ts'
import { ClarusError } from './errors.ts'
import type { Attr, ParsedFile, TemplateNode } from './parse.ts'

/**
 * Finds an icon by `set:name` for `<icon>`: `resolveIcon` from clarusjs/icons, bound to the file being compiled.
 * @see https://clarusjs.com/guide/icons
 */
export type IconResolver = (name: string) => IconLookup

type Element = Extract<TemplateNode, { type: 'element' }>
const LABELS = new Set(['aria-label', 'aria-labelledby', 'title'])

/** `<icon>` as the `<svg>` it renders and the body that goes inside it; throws a located error when it can't. */
export function iconElement(node: Element, file: string, source: string, icon: IconResolver | undefined): { svg: Element; body: string } {
  const fail = (text: string): never => { throw new ClarusError(text, file, source, node.start) }
  const name = node.attrs.find((a) => a.name === 'name')
  if (!name) return fail('<icon> needs a name: <icon name="lucide:rocket" />')
  if (name.kind !== 'static' || name.value === true) return fail('a bound name: icons are chosen at build time; use @if between static icons')
  if (node.children.some((c) => c.type !== 'text' || c.value.trim())) return fail('<icon> takes no content')
  if (!icon) return fail('icons are resolved at build time: <icon> needs clarusjs/vite or clarusjs check (the playground has no icon sets)')
  const id = name.value
  // Iconify names: lowercase letters, digits and hyphens, as set:icon (this also keeps a name inside @iconify-json/).
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) return fail(`<icon> name is set:icon, like lucide:rocket (got '${id}')`)
  let found: IconLookup
  try {
    found = icon(id)
  } catch (e) {
    return fail((e as Error).message)
  }
  if ('missing' in found) {
    if (found.missing === 'set') return fail(`no icon set '${found.set}': install it with pnpm add -D @iconify-json/${found.set}`)
    const mean = found.suggestions.length ? ` (did you mean ${found.suggestions.map((s) => `'${s}'`).join(' or ')}?)` : ''
    return fail(`no icon '${id.slice(found.set.length + 1)}' in ${found.set}${mean}`)
  }
  const { data } = found
  const own = node.attrs.filter((a) => a !== name)
  const has = (n: string) => own.some((a) => a.name === n)
  const at = node.start
  const fixed = (n: string, value: string): Attr[] => (has(n) ? [] : [{ kind: 'static', name: n, value, start: at }])
  // ponytail: an icon used twice repeats its ids (gradients in coloured sets); prefix them per use if it bites.
  // What the author sets wins: a generated attribute is left out when the author wrote it (or, for the accessibility
  // pair, either of them).
  const a11y: Attr[] = has('role') || has('aria-hidden') ? [] : own.some((a) => LABELS.has(a.name)) ? fixed('role', 'img') : fixed('aria-hidden', 'true')
  const attrs: Attr[] = [
    ...fixed('xmlns', 'http://www.w3.org/2000/svg'),
    ...fixed('width', `${+(data.width / data.height).toFixed(4)}em`),
    ...fixed('height', '1em'),
    ...fixed('viewBox', `${data.left} ${data.top} ${data.width} ${data.height}`),
    ...a11y,
    ...own,
  ]
  return { svg: { type: 'element', tag: 'svg', attrs, children: [], start: node.start }, body: data.body }
}

/**
 * Every `<icon>` error in a file (lower() stops at the first): `clarusjs check` reports them all.
 * @example
 * checkIcons(parse(source, file), file, source, (name) => resolveIcon(name, file)) // [ClarusError, …]
 * @see https://clarusjs.com/guide/icons
 */
export function checkIcons(parsed: ParsedFile, file: string, source: string, icon: IconResolver | undefined): ClarusError[] {
  const components = new Set(parsed.imports.map((i) => i.name))
  const errors: ClarusError[] = []
  const walk = (nodes: TemplateNode[]): void => {
    for (const node of nodes) {
      if (node.type === 'element') {
        if (node.tag === 'icon' && !components.has('icon')) {
          try {
            iconElement(node, file, source, icon)
          } catch (e) {
            if (!(e instanceof ClarusError)) throw e
            errors.push(e)
          }
          continue
        }
        walk(node.children)
      } else if (node.type === 'if') for (const b of node.branches) walk(b.children)
      else if (node.type === 'for') {
        walk(node.children)
        if (node.empty) walk(node.empty)
      } else if (node.type === 'fill') walk(node.children)
    }
  }
  walk(parsed.nodes)
  return errors
}
