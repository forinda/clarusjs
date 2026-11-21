// #284: every public export of the published packages (what each package.json `exports` expose) has JSDoc: a
// description, an @see link to its reference on https://clarusjs.com, and for functions and values an @example.
// Helpers only clarusjs's own code calls are tagged @internal instead (a description, no example).
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { expect, test } from 'vitest'

const packages = ['clarusjs', 'content'].map((name) => resolve(import.meta.dirname, '../..', name))
const DECL = (name: string) => new RegExp(`^(export\\s+)?(default\\s+)?(declare\\s+)?(async\\s+)?(function\\*?|const|let|class|type|interface|enum)\\s+${name.replace(/\$/g, '\\$')}\\b`, 'm')

/** The JSDoc block right above `name`'s declaration in `file`, and whether it's a value (function/const/class). */
function docOf(file: string, name: string): { doc: string | undefined; value: boolean } | undefined {
  const text = readFileSync(file, 'utf8')
  const m = DECL(name).exec(text)
  if (!m) return undefined
  const before = text.slice(0, m.index).trimEnd()
  const doc = before.endsWith('*/') ? before.slice(before.lastIndexOf('/**')) : undefined
  return { doc, value: !/^(type|interface)$/.test(m[5]!) }
}

/** Every public export of an entry file: its public name and where it's declared (following re-exports). */
function exportsOf(file: string): { name: string; file: string; local: string }[] {
  const text = readFileSync(file, 'utf8')
  const out: { name: string; file: string; local: string }[] = []
  for (const m of text.matchAll(/^export\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'([^']+)'/gm)) {
    const from = resolve(dirname(file), m[2]!)
    for (const part of m[1]!.split(',').map((p) => p.trim().replace(/^type\s+/, '')).filter(Boolean)) {
      const [local, alias] = part.split(/\s+as\s+/)
      out.push({ name: (alias ?? local)!, file: from, local: local! })
    }
  }
  // `export { a, type B }` without `from`: names declared here, or imported (then declared where they come from).
  for (const m of text.matchAll(/^export\s+(?:type\s+)?\{([^}]*)\}(?!\s*from)/gm)) { // at a line start: not in generated code's strings
    for (const part of m[1]!.split(',').map((p) => p.trim().replace(/^type\s+/, '')).filter(Boolean)) {
      const [local, alias] = part.split(/\s+as\s+/)
      const imported = new RegExp(`import\\s+(?:type\\s+)?\\{[^}]*\\b${local}\\b[^}]*\\}\\s+from\\s+'([^']+)'`).exec(text)
      out.push({ name: (alias ?? local)!, file: imported ? resolve(dirname(file), imported[1]!) : file, local: local! })
    }
  }
  for (const m of text.matchAll(/^export\s+(?:default\s+)?(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm)) {
    out.push({ name: m[1]!, file, local: m[1]! })
  }
  return out
}


/** "entry name: problem" for every public export that misses something. */
function problems(): string[] {
  const out: string[] = []
  for (const dir of packages) {
    const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8'))
    for (const [entry, path] of Object.entries(pkg.exports as Record<string, string>)) for (const ex of exportsOf(resolve(dir, path))) {
      const found = docOf(ex.file, ex.local)
      const id = `${pkg.name}${entry.slice(1)} ${ex.name}`
      if (!found) { out.push(`${id}: declaration not found`); continue }
      const { doc, value } = found
      if (!doc) { out.push(`${id}: no JSDoc`); continue }
      if (/@internal\b/.test(doc)) continue
      if (!/@see https:\/\/clarusjs\.com\//.test(doc)) out.push(`${id}: no @see https://clarusjs.com/…`)
      if (value && !/@example\b/.test(doc)) out.push(`${id}: no @example`)
    }
  }
  return [...new Set(out)].sort()
}

test('#284: every public export has JSDoc with @see (and @example for values), or is @internal', () => {
  expect(problems()).toEqual([])
})

