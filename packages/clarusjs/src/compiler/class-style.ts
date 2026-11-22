// class forms (#403): [class.name]="cond" toggles a class, and a bound [class] may be an object or an array. On an
// element that uses them, every class source (class="…", class="… {{ }}", [class], the toggles) folds into one bound
// class, __cl_classValue([...]) in the order written, toggles last: the existing attribute path then escapes it, merges
// the scope class (markRoots, which runs after) and updates it in islands. An element with only class="…", or only a
// bound [class] (attrValue normalizes an object or an array there), is untouched.
import type { Attr, TemplateNode } from './parse.ts'

/** The expression a class source contributes: a string, the bound value, or a toggle as { name: cond }. */
function part(a: Attr): string {
  if (a.kind === 'static') return JSON.stringify(a.value === true ? '' : a.value)
  if (a.kind === 'interp') return `(${a.parts.map((p) => (typeof p === 'string' ? JSON.stringify(p) : `(${p.expr})`)).join(' + ')})`
  return `(${(a as { expr: string }).expr})`
}

export function foldClass(nodes: TemplateNode[], components: Set<string>): void {
  for (const node of nodes) {
    if (node.type === 'element') {
      if (!components.has(node.tag)) {
        const toggles = node.attrs.filter((a) => a.kind === 'prop' && a.name.startsWith('class.'))
        const sources = node.attrs.filter((a) => a.name === 'class')
        // A lone bound [class] stays as it is (attrValue takes an object or an array): readable output.
        const mixed = sources.length > 1 && sources.some((a) => a.kind === 'prop')
        if (toggles.length || mixed) {
          const exprs = [...sources.map(part), ...toggles.map((t) => `{ ${JSON.stringify(t.name.slice(6))}: (${(t as { expr: string }).expr}) }`)]
          const start = (sources[0] ?? toggles[0])!.start
          node.attrs = [...node.attrs.filter((a) => a.name !== 'class' && !toggles.includes(a)), { kind: 'prop', name: 'class', expr: `__cl_classValue([${exprs.join(', ')}])`, start }]
        }
      }
      foldClass(node.children, components)
    } else if (node.type === 'if') for (const b of node.branches) foldClass(b.children, components)
    else if (node.type === 'for') {
      foldClass(node.children, components)
      if (node.empty) foldClass(node.empty, components)
    } else if (node.type === 'fill') foldClass(node.children, components)
  }
}
