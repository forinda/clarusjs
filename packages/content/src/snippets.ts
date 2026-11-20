// <<< code snippets and <!-- @include: --> Markdown includes, expanded before the Markdown is parsed. Lines inside
// code fences are left alone, so documentation can show the syntax itself.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import type { SourceContext } from 'clarusjs/vite'

const SNIPPET = /^[ \t]*<<<[ \t]+(\S+?)(?:#([\w-]+))?(\{[^}]*\})?(?:[ \t]+\[([^\]]+)\])?[ \t]*$/
const INCLUDE = /^[ \t]*<!--[ \t]*@include:[ \t]*(\S+?)(?:#([\w-]+))?[ \t]*-->[ \t]*$/
const posix = (p: string) => p.split(sep).join('/')

/** The lines between `#region name` and `#endregion` (in any comment style), without markers, dedented. */
function region(text: string, name: string | undefined): string | undefined {
  let lines = text.replace(/\n$/, '').split('\n')
  if (name) {
    const start = lines.findIndex((l) => new RegExp(`#region\\s+${name}\\b`).test(l))
    if (start === -1) return undefined
    const end = lines.findIndex((l, i) => i > start && /#endregion\b/.test(l) && (!/#endregion\s+\S/.test(l) || new RegExp(`#endregion\\s+${name}\\b`).test(l)))
    lines = lines.slice(start + 1, end === -1 ? undefined : end)
  }
  lines = lines.filter((l) => !/#(end)?region\b/.test(l))
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => /^[ \t]*/.exec(l)![0].length))
  return lines.map((l) => l.slice(Number.isFinite(indent) ? indent : 0)).join('\n')
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
  let fence: string | null = null
  const out: string[] = []
  for (const line of text.split('\n')) {
    const marker = /^[ \t]*(`{3,}|~{3,})/.exec(line)?.[1]
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length && !line.trim().slice(marker.length).trim()) fence = null
      out.push(line)
      continue
    }
    if (marker) { fence = marker; out.push(line); continue }

    let m = SNIPPET.exec(line)
    if (m) {
      const [, spec, name, lines, title] = m
      const path = locate(spec!, '<<<')
      const code = region(readFileSync(path, 'utf8'), name) ?? fail(`<<< ${spec}: region "${name}" not found`)
      const ticks = '`'.repeat(Math.max(3, ...(code.match(/`{3,}/g) ?? []).map((t) => t.length + 1)))
      const lang = /\.([\w-]+)$/.exec(path)?.[1] ?? 'text'
      out.push(`${ticks}${lang}${lines ? ` ${lines}` : ''}${title ? ` [${title}]` : ''}`, code, ticks)
      continue
    }
    m = INCLUDE.exec(line)
    if (m) {
      const [, spec, name] = m
      const path = locate(spec!, '@include:')
      if (stack.includes(path)) fail(`include cycle: ${[...stack, path].map((p) => posix(relative(ctx.root, p))).join(' → ')}`)
      let included = readFileSync(path, 'utf8').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
      included = region(included, name) ?? fail(`@include: ${spec}: region "${name}" not found`)
      // Relative links in the included file are rewritten to work from the page that includes it.
      included = included.replace(/(\]\()([^)\s]+)/g, (all, open: string, href: string) => {
        if (/^([a-z][\w+.-]*:|\/|#)/i.test(href)) return all
        return open + posix(relative(dirname(stack[0]!), resolve(dirname(path), href)))
      })
      out.push(expand(included, path, ctx, [...stack, path]))
      continue
    }
    out.push(line)
  }
  return out.join('\n')
}
