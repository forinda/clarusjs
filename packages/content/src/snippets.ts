// <<< code snippets and <!-- @include: --> Markdown includes, expanded before the Markdown is parsed. Lines inside
// code fences are left alone, so documentation can show the syntax itself.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import type { SourceContext } from 'clarusjs/vite'

const SNIPPET = /^[ \t]*<<<[ \t]+(\S+?)(?:#([\w-]+))?(\{[^}]*\})?(?:[ \t]+\[([^\]]+)\])?[ \t]*$/
const INCLUDE = /^[ \t]*<!--[ \t]*@include:[ \t]*(\S+?)(?:#([\w-]+))?[ \t]*-->[ \t]*$/
const posix = (p: string) => p.split(sep).join('/')

// A region marker is a comment line of its own: // #region name, /* #endregion */, <!-- #region name -->, # #region.
const MARKER = /^[ \t]*(?:\/\/|\/\*|<!--|#|--|;)?[ \t]*#(end)?region(?:[ \t]+([A-Za-z0-9_][\w-]*))?[ \t]*(?:\*\/|-->)?[ \t]*$/

/**
 * The lines between `#region name` and its `#endregion`, without markers, dedented. Regions nest: an inner region's
 * unnamed `#endregion` closes the inner one, and the outer selection keeps everything up to its own ending.
 */
function region(text: string, name: string | undefined): string | undefined {
  let lines = text.replace(/\n$/, '').split('\n')
  if (name) {
    const start = lines.findIndex((l) => { const m = MARKER.exec(l); return !!m && !m[1] && m[2] === name })
    if (start === -1) return undefined
    let depth = 0
    let end = -1
    for (let i = start + 1; i < lines.length && end === -1; i++) {
      const m = MARKER.exec(lines[i]!)
      if (!m) continue
      if (!m[1]) depth++
      else if (m[2] === name || (!m[2] && depth === 0)) end = i
      else depth--
    }
    lines = lines.slice(start + 1, end === -1 ? undefined : end)
  }
  lines = lines.filter((l) => !MARKER.test(l))
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => /^[ \t]*/.exec(l)![0].length))
  return lines.map((l) => l.slice(Number.isFinite(indent) ? indent : 0)).join('\n')
}

/**
 * Apply `fn` to every line outside fenced code, so examples stay as written. A fence may open after list markers;
 * a closing fence uses the same character, is at least as long, has nothing after it, and is indented at most three
 * spaces past where the fence opened (more is code).
 */
function outsideFences(text: string, fn: (line: string) => string): string {
  let fence: { marker: string; indent: number } | null = null
  return text.split('\n').map((line) => {
    if (fence) {
      const close = /^([ \t]*)(`{3,}|~{3,})[ \t\r]*$/.exec(line)
      if (close && close[2]![0] === fence.marker[0] && close[2]!.length >= fence.marker.length && close[1]!.length <= fence.indent + 3) fence = null
      return line
    }
    const open = /^([ \t]*(?:(?:[-*+]|\d+[.)])[ \t]+)*)(`{3,}|~{3,})/.exec(line)
    if (open) { fence = { marker: open[2]!, indent: open[1]!.length }; return line }
    return fn(line)
  }).join('\n')
}

/** Expand snippets and includes in `text` (from `file`; `stack` is the include chain, page first). */
export function expand(text: string, file: string, ctx: SourceContext, stack: string[] = [file]): string {
  if (!/<<<|@include:/.test(text)) return text
  const page = posix(relative(ctx.root, stack[0]!))
  const fail = (what: string): never => { throw new Error(`${page}: ${what}`) }
  const locate = (spec: string, directive: string) => {
    const path = spec.startsWith('@/') ? resolve(ctx.root, spec.slice(2)) : resolve(dirname(file), spec)
    if (path !== ctx.root && !path.startsWith(ctx.root + sep)) fail(`${directive} ${spec}: outside the project`)
    if (!existsSync(path)) fail(`${directive} ${spec}: file not found`)
    ctx.addDependency(path)
    return path
  }
  return outsideFences(text, (line) => {
    let m = SNIPPET.exec(line)
    if (m) {
      const [, spec, name, lines, title] = m
      const path = locate(spec!, '<<<')
      const code = region(readFileSync(path, 'utf8'), name) ?? fail(`<<< ${spec}: region "${name}" not found`)
      const ticks = '`'.repeat(Math.max(3, ...(code.match(/`{3,}/g) ?? []).map((t) => t.length + 1)))
      const lang = /\.([\w-]+)$/.exec(path)?.[1] ?? 'text'
      return [`${ticks}${lang}${lines ? ` ${lines}` : ''}${title ? ` [${title}]` : ''}`, code, ticks].join('\n')
    }
    m = INCLUDE.exec(line)
    if (m) {
      const [, spec, name] = m
      const path = locate(spec!, '@include:')
      if (stack.includes(path)) fail(`include cycle: ${[...stack, path].map((p) => posix(relative(ctx.root, p))).join(' → ')}`)
      let included = readFileSync(path, 'utf8').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
      included = region(included, name) ?? fail(`@include: ${spec}: region "${name}" not found`)
      // Relative links (inline and reference definitions) in the included file are rewritten to work from the page
      // that includes it; examples in fences stay as written.
      const rebase = (href: string) => (/^([a-z][\w+.-]*:|\/|#)/i.test(href) ? href : posix(relative(dirname(stack[0]!), resolve(dirname(path), href))))
      included = outsideFences(included, (l) => l
        .replace(/(\]\()([^)\s]+)/g, (_, open: string, href: string) => open + rebase(href))
        .replace(/^([ \t]{0,3}\[[^\]]+\]:[ \t]*)(\S+)/, (_, def: string, href: string) => def + rebase(href)))
      return expand(included, path, ctx, [...stack, path])
    }
    return line
  })
}
