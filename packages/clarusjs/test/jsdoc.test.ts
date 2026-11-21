// #284: every public export (what package.json `exports` expose) has JSDoc: a description, an @see link to its
// reference on https://clarusjs.com, and for functions and values an @example. Helpers only compiled code calls are
// tagged @internal instead (a description, no example). PENDING lists the exports not done yet; it only shrinks.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { expect, test } from 'vitest'

const pkgDir = resolve(import.meta.dirname, '..')
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
  for (const m of text.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'([^']+)'/g)) {
    const from = resolve(dirname(file), m[2]!)
    for (const part of m[1]!.split(',').map((p) => p.trim().replace(/^type\s+/, '')).filter(Boolean)) {
      const [local, alias] = part.split(/\s+as\s+/)
      out.push({ name: (alias ?? local)!, file: from, local: local! })
    }
  }
  for (const m of text.matchAll(/^export\s+(?:default\s+)?(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm)) {
    out.push({ name: m[1]!, file, local: m[1]! })
  }
  return out
}

const entries = Object.entries(JSON.parse(readFileSync(resolve(pkgDir, 'package.json'), 'utf8')).exports as Record<string, string>)

/** "entry name: problem" for every public export that misses something. */
function problems(): string[] {
  const out: string[] = []
  for (const [entry, path] of entries) {
    for (const ex of exportsOf(resolve(pkgDir, path))) {
      const found = docOf(ex.file, ex.local)
      const id = `${entry} ${ex.name}`
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

// Not done yet (#284): each PR removes what it documents. A name here that's now documented fails too, so the list
// can't outlive the work.
const PENDING: string[] = [
  "./compiler Attr: no JSDoc",
  "./compiler ClarusError: no @example",
  "./compiler ClarusError: no @see https://clarusjs.com/…",
  "./compiler CompileOptions: no @see https://clarusjs.com/…",
  "./compiler CompileResult: no @see https://clarusjs.com/…",
  "./compiler ImportDecl: no JSDoc",
  "./compiler InputDecl: no JSDoc",
  "./compiler ParsedFile: no JSDoc",
  "./compiler TemplateNode: no JSDoc",
  "./compiler compile: no JSDoc",
  "./compiler parse: no JSDoc",
  "./compiler scopeId: no @example",
  "./compiler scopeId: no @see https://clarusjs.com/…",
  "./manifest IslandInfo: no JSDoc",
  "./manifest Manifest: no JSDoc",
  "./manifest RouteInfo: no JSDoc",
  "./manifest readManifest: no @example",
  "./manifest readManifest: no @see https://clarusjs.com/…",
  "./navigation RouteName: no @see https://clarusjs.com/…",
  "./navigation Routes: no JSDoc",
  "./navigation abort: no @example",
  "./navigation afterNavigate: no @example",
  "./navigation afterSwap: no @example",
  "./navigation back: no @example",
  "./navigation back: no @see https://clarusjs.com/…",
  "./navigation beforeNavigate: no @example",
  "./navigation beforeSwap: no @example",
  "./navigation currentUrl: no @example",
  "./navigation href: no @example",
  "./navigation navigate: no @example",
  "./navigation navigating: no @example",
  "./navigation onNavigateError: no @example",
  "./navigation viewTransitions: no @example",
  "./views ViewName: no @see https://clarusjs.com/…",
  "./views ViewProps: no JSDoc",
  "./views Views: no JSDoc",
  "./views registerViews: no @example",
  "./views registerViews: no @see https://clarusjs.com/…",
  "./views render: no @example",
  "./views render: no @see https://clarusjs.com/…",
  "./views viewName: no @example",
  "./views viewName: no @see https://clarusjs.com/…",
]

test('#284: every public export has JSDoc with @see (and @example for values), or is @internal', () => {
  expect(problems().filter((p) => !PENDING.includes(p))).toEqual([])
})

test('#284: the pending list holds only exports still missing something', () => {
  const now = problems()
  expect(PENDING.filter((p) => !now.includes(p))).toEqual([])
})
