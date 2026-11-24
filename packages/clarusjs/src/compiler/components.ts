// Automatic component imports (#458): the names of the components in an app's component folders, and the imports a
// template needs from them. Pure: paths in, names out; the plugin, `clarusjs check` and the language server find the
// files and share these, so they agree on what a tag means.
import { ClarusError } from './errors.ts'
import { awaitLists, type ParsedFile, type TemplateNode } from './parse.ts'

/**
 * Tag name → the component's root path ('/src/components/forms/text-field.tscl'), or every candidate when ambiguous.
 * @see https://clarusjs.com/guide/components#automatic-imports
 */
export type ComponentNames = Record<string, string | string[]>

/**
 * Where automatic components live, by default (root-relative).
 * @example
 * componentIndex(files, COMPONENT_DIRS)
 * @see https://clarusjs.com/guide/components#automatic-imports
 */
export const COMPONENT_DIRS = ['src/components', 'src/layouts']

const KEBAB = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

/**
 * Name every `.tscl` file under `dirs` (root-relative, posix): its full name is its folders and file joined with
 * hyphens (`forms/text-field.tscl` → `forms-text-field`), its short name the file alone (`text-field`) when no other
 * component has that name; a full name wins over a short one. Only names with a hyphen count, like custom elements,
 * so a component never takes an HTML element's name. `skipped`: files that aren't kebab-case (never named).
 * @example
 * componentIndex(['src/components/forms/text-field.tscl'], ['src/components']).names
 * // { 'forms-text-field': '/src/components/forms/text-field.tscl', 'text-field': '/src/components/forms/text-field.tscl' }
 * @see https://clarusjs.com/guide/components#automatic-imports
 */
export function componentIndex(files: string[], dirs: string[]): { names: ComponentNames; skipped: string[] } {
  const full = new Map<string, string[]>()
  const short = new Map<string, string[]>()
  const skipped: string[] = []
  const add = (map: Map<string, string[]>, name: string, path: string) => map.set(name, [...(map.get(name) ?? []), path])
  for (const file of [...files].sort()) {
    const dir = dirs.find((d) => file.startsWith(`${d.replace(/\/+$/, '')}/`))
    if (!dir || !file.endsWith('.tscl')) continue
    const segments = file.slice(dir.replace(/\/+$/, '').length + 1, -'.tscl'.length).split('/')
    if (!segments.every((s) => KEBAB.test(s))) {
      skipped.push(file)
      continue
    }
    add(full, segments.join('-'), `/${file}`)
    if (segments.length > 1) add(short, segments.at(-1)!, `/${file}`)
  }
  const names: ComponentNames = {}
  for (const [name, paths] of short) if (name.includes('-') && !full.has(name)) names[name] = paths.length === 1 ? paths[0]! : paths
  for (const [name, paths] of full) if (name.includes('-')) names[name] = paths.length === 1 ? paths[0]! : paths
  return { names, skipped }
}

/**
 * Add an import for each component tag the template uses that `names` knows and the file doesn't import itself (only
 * those). A tag that names two components is a located error. Other hyphenated tags stay HTML (web components).
 */
export function autoImport(parsed: ParsedFile, names: ComponentNames, file: string, source: string): void {
  const imported = new Set(parsed.imports.map((i) => i.name))
  const walk = (nodes: TemplateNode[]): void => {
    for (const node of nodes) {
      if (node.type === 'element') {
        const found = node.tag.includes('-') && !imported.has(node.tag) ? names[node.tag] : undefined
        if (Array.isArray(found)) {
          throw new ClarusError(`<${node.tag}> could be ${found.join(' or ')}: use its full name, or @import the one you mean`, file, source, node.start)
        }
        if (found) {
          parsed.imports.push({ name: node.tag, from: found, start: 0 })
          imported.add(node.tag)
        }
        walk(node.children)
      } else if (node.type === 'if') for (const b of node.branches) walk(b.children)
      else if (node.type === 'for') {
        walk(node.children)
        if (node.empty) walk(node.empty)
      } else if (node.type === 'fill') walk(node.children)
      else if (node.type === 'await') for (const kids of awaitLists(node)) walk(kids)
    }
  }
  walk(parsed.nodes)
}
