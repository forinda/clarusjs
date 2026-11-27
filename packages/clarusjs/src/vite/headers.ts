// Response headers (`headers: { '/*': { 'X-Frame-Options': 'DENY' } }`): the build writes them to _headers, which
// Netlify and Cloudflare Pages read as they are, and which `clarusjs serve` and vite preview apply.
// Patterns as those hosts read them: `*` matches anything (slashes too), `:name` one segment.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { posix, resolve } from 'node:path'

export type HeaderRules = Record<string, Record<string, string>>

/** Sent unless `headers: false`: safe for any site. A CSP depends on the site, so there's none by default. */
export const defaultHeaders = (assetsDir: string): HeaderRules => ({
  '/*': { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' },
  // Vite's hashed files: a new build gives them new names, so they never change.
  [`/${assetsDir}/*`]: { 'Cache-Control': 'public, max-age=31536000, immutable' },
})

export function checkHeaders(headers: HeaderRules): void {
  for (const [pattern, set] of Object.entries(headers)) {
    if (!pattern.startsWith('/')) throw new Error(`clarusjs: headers['${pattern}']: patterns start with /`)
    for (const [name, value] of Object.entries(set)) {
      if (/[\r\n]/.test(pattern + name + value) || !name.trim()) throw new Error(`clarusjs: headers['${pattern}']['${name}']: names and values are one line`)
    }
  }
}

/** The default headers, then the site's, as _headers lines under the base prefix ('' or '/docs'), after public/'s. */
export function writeHeaders(out: string, headers: HeaderRules, prefix: string, assetsDir: string): void {
  checkHeaders(headers)
  const rules = [...Object.entries(defaultHeaders(assetsDir)), ...Object.entries(headers)]
  const lines = rules.map(([pattern, set]) => `${prefix}${pattern}\n${Object.entries(set).map(([k, v]) => `  ${k}: ${v}\n`).join('')}`)
  const file = resolve(out, '_headers')
  writeFileSync(file, (existsSync(file) ? readFileSync(file, 'utf8').replace(/\n?$/, '\n') : '') + lines.join(''))
}

export type ParsedRule = { regex: RegExp; headers: [string, string][] }

/** _headers text → rules: a pattern line, then indented `Name: value` lines. Comments (#) and blank lines skipped. */
export function parseHeaders(text: string): ParsedRule[] {
  const rules: ParsedRule[] = []
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    if (!/^\s/.test(line)) {
      const source = line.trim().split('/').map((seg) => seg.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/^:\w+$/, '[^/]+')).join('/')
      // A path and its slash form are the same page (or route): /admin's headers on /admin/ too.
      // Case ignored: a case-insensitive file system serves /ADMIN/x as admin/x, so it gets /admin/*'s headers too.
      rules.push({ regex: new RegExp(`^${source}${source.endsWith('/') ? '' : '/?'}$`, 'i'), headers: [] })
    } else {
      const at = line.indexOf(':')
      if (at > 0 && rules.length) rules.at(-1)!.headers.push([line.slice(0, at).trim(), line.slice(at + 1).trim()])
    }
  }
  return rules
}

/**
 * '/a//b/../c/' → '/a/c/': the path a file lookup resolves to (backslashes too, as Windows reads them). Match rules
 * against this, so a path written another way gets the headers of the file it serves.
 */
export const canonical = (path: string): string => posix.normalize(`/${path}`.replace(/\\/g, '/'))

/** Every matching rule's headers, in order; a name set by several is joined with ', ', as Netlify and Cloudflare do. */
export function headersFor(rules: ParsedRule[], pathname: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const rule of rules) {
    if (!rule.regex.test(pathname)) continue
    for (const [name, value] of rule.headers) {
      const key = name.toLowerCase()
      out.set(key, out.has(key) ? `${out.get(key)}, ${value}` : value)
    }
  }
  return out
}

/** dist/client/_headers, parsed; none when it doesn't exist. */
export function readHeaders(dir: string): ParsedRule[] {
  const file = resolve(dir, '_headers')
  return existsSync(file) ? parseHeaders(readFileSync(file, 'utf8')) : []
}
