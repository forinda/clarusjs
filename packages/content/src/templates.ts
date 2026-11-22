// Code blocks in .tscl templates, highlighted at build time as Markdown's are (#153): the same Shiki setup, themes and
// wrapper, so pages written as templates look like the Markdown ones. A Vite plugin from this package (not clarusjs,
// which never depends on Shiki), run before clarusjs compiles the template.
import type { Plugin } from 'vite'
import { highlight } from './highlight.ts'

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const decode = (s: string) =>
  s.replace(/&(lt|gt|quot|#39|#0*64|#0*123|#0*125|amp);/g, (_, e: string) => ({ lt: '<', gt: '>', quot: '"', '#39': "'", amp: '&' } as Record<string, string>)[e] ?? String.fromCharCode(Number(e.slice(1))))
// The highlighted HTML goes into a template: { } and @ in it become entities, so the compiler reads text, not syntax.
const inert = (html: string) => html.replace(/\{/g, '&#123;').replace(/\}/g, '&#125;').replace(/@/g, '&#64;')
const attr = (attrs: string, name: string) => new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`).exec(attrs)?.slice(1).find((v) => v !== undefined)
const flag = (attrs: string, name: string) => new RegExp(`(?:^|\\s)${name}(?=[\\s/>=]|$)`).test(attrs.replace(/=\s*("[^"]*"|'[^']*'|[^\s>]*)/g, ''))

/** A highlighted block, in Markdown's wrapper (the same CSS applies). */
const block = (code: string, lang: string) =>
  inert(`<div class="code-block language-${escapeHtml(lang)}"><span class="lang">${escapeHtml(lang)}</span>${highlight(code.replace(/^\n/, '').replace(/\n$/, ''), lang, '')}</div>`)

/**
 * `source` with its static code blocks highlighted: `<pre verbatim lang="x">…</pre>` (the content is the code), and
 * `<pre><code lang="x">…</code></pre>` (`verbatim` on the code: as written; without it, template text with entities
 * decoded). A block with `{{ }}` holes, or without a `lang`, is left as written; `warn` hears about holes.
 */
export function highlightBlocks(source: string, warn: (message: string) => void = () => {}): string {
  return source.replace(/<pre\b([^>]*)>([\s\S]*?)<\/pre\s*>/g, (whole, preAttrs: string, inner: string, at: number) => {
    const line = source.slice(0, at).split('\n').length
    let lang = attr(preAttrs, 'lang')
    let code: string
    if (lang && flag(preAttrs, 'verbatim')) code = inner
    else {
      const m = /^\s*<code\b([^>]*)>([\s\S]*)<\/code\s*>\s*$/.exec(inner)
      if (!m) return whole
      lang = attr(m[1]!, 'lang')
      if (!lang) return whole
      if (flag(m[1]!, 'verbatim')) code = m[2]!
      else {
        if (m[2]!.includes('{{')) {
          warn(`line ${line}: a code block with {{ }} holes isn't static, so it's left as written (not highlighted)`)
          return whole
        }
        code = decode(m[2]!)
      }
    }
    return block(code, lang)
  })
}

/**
 * Highlights code blocks in .tscl templates at build, with the same Shiki setup as Markdown pages. Add it before
 * clarusjs: `plugins: [highlightTemplates(), clarusjs(...)]`. Mark a block with its language:
 * `<pre><code verbatim lang="ts">…</code></pre>`.
 * @example
 * ```ts
 * // vite.config.ts
 * import clarusjs from 'clarusjs/vite'
 * import markdown, { highlightTemplates } from '@clarusjs/content'
 *
 * export default defineConfig({ plugins: [highlightTemplates(), clarusjs({ sources: [markdown()] })] })
 * ```
 * @see https://clarusjs.com/guide/markdown#code-in-templates
 */
export function highlightTemplates(): Plugin {
  return {
    name: 'clarusjs-content:highlight-templates',
    enforce: 'pre',
    transform: {
      filter: { id: /\.tscl(\?.*)?$/ },
      handler(code, id) {
        const out = highlightBlocks(code, (message) => this.warn(`${id.replace(/\?.*$/, '')}: ${message}`))
        return out === code ? null : { code: out, map: null }
      },
    },
  }
}
