// Markdown pages for clarusjs. A page source: each .md file under src/pages becomes .tscl text (its HTML inside
// the layout), then compiles like any page. Build-time only: nothing here reaches the browser.
import MarkdownIt from 'markdown-it'
import { parse as parseYaml } from 'yaml'
import type { Source } from 'clarusjs/vite'

export type MarkdownOptions = {
  /** The layout every page renders in, root-relative (`/src/layouts/docs.tscl`). Frontmatter `layout` overrides it; `false` means none. */
  layout?: string
}

/** 'Hello, World!' → 'hello-world'. Shared by heading ids and (later) link checking. */
export function slugify(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-') || 'section'
}

/** A JavaScript string literal that is safe inside a double-quoted .tscl attribute. */
const quote = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\u0022').replace(/\n/g, '\\n')}'`
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

type Md = InstanceType<typeof MarkdownIt>
type Tok = { type: string; content: string }

function renderer(): Md {
  const md = new MarkdownIt({ html: true, linkify: true })
  // Headings get an id and an anchor link; ids are unique within the page.
  md.core.ruler.push('cl_anchors', (state) => {
    const used = new Map<string, number>()
    state.tokens.forEach((token, i) => {
      if (token.type !== 'heading_open') return
      const inline = state.tokens[i + 1]!
      const text = (inline.children ?? []).filter((t: Tok) => t.type === 'text' || t.type === 'code_inline').map((t: Tok) => t.content).join('')
      const base = slugify(text)
      const n = used.get(base) ?? 0
      used.set(base, n + 1)
      const id = n ? `${base}-${n}` : base
      token.attrSet('id', id)
      token.attrSet('tabindex', '-1')
      const anchor = new state.Token('html_inline', '', 0)
      anchor.content = ` <a class="header-anchor" href="#${id}" aria-label="Permalink to ${escapeHtml(text)}">#</a>`
      inline.children = [...(inline.children ?? []), anchor]
    })
  })
  return md
}

/** Markdown output is static HTML: anything a .tscl template would read as syntax ({{ }}, @if …) is escaped. */
function staticHtml(html: string): string {
  return html.replace(/\{\{/g, '&#123;&#123;').replace(/@/g, '&#64;')
}

/**
 * Component tags (and any tag with [prop] or (event) bindings) aren't valid CommonMark HTML, so markdown-it would
 * escape them. They are swapped for HTML comments, which it passes through, and put back after rendering.
 */
function protectTags(body: string, components: Set<string>): { body: string; restore(html: string): string } {
  const saved: string[] = []
  const out = body.replace(/<\/?([A-Za-z][\w-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>/g, (tag, name: string, attrs: string) => {
    if (!components.has(name) && !/\s[[(]/.test(attrs)) return tag
    saved.push(tag)
    return `<!--cl-tag-${saved.length - 1}-->`
  })
  return { body: out, restore: (html) => html.replace(/<!--cl-tag-(\d+)-->/g, (_, i: string) => saved[Number(i)]!) }
}

export default function markdown(options: MarkdownOptions = {}): Source {
  const md = renderer()
  return {
    extension: '.md',
    toTscl(code, _file, { route }) {
      // ---\nyaml\n---: the page's frontmatter.
      const front = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(code)
      const data = (front ? parseYaml(front[1]!) : null) ?? {}
      let body = front ? code.slice(front[0].length) : code
      // @import lines at the top pass through, so components can be used in the Markdown.
      const imports: string[] = []
      for (;;) {
        const line = /^[ \t]*(@import\b[^\n]*)\n|^[ \t]*\n/.exec(body)
        if (!line) break
        if (line[1]) imports.push(line[1].trim())
        body = body.slice(line[0].length)
      }
      const components = new Set(imports.map((line) => /^@import\s+([A-Za-z_$][\w-]*)\s+from/.exec(line)?.[1]).filter((n): n is string => !!n))
      const tags = protectTags(body, components)
      const env: Record<string, unknown> = {}
      const tokens = md.parse(tags.body, env)
      const h1 = tokens.findIndex((t: Tok & { tag: string }) => t.type === 'heading_open' && t.tag === 'h1')
      const firstHeading = h1 === -1 ? undefined : (tokens[h1 + 1]!.children ?? []).filter((t: Tok) => t.type === 'text' || t.type === 'code_inline').map((t: Tok) => t.content).join('')
      const html = tags.restore(staticHtml(md.renderer.render(tokens, md.options, env)))

      const layout = data.layout === false ? undefined : (typeof data.layout === 'string' ? data.layout : options.layout)
      if (!layout) return [...imports, html].join('\n')
      const title = typeof data.title === 'string' ? data.title : firstHeading
      const props = [
        title !== undefined ? `[title]="${quote(title)}"` : '',
        typeof data.description === 'string' ? `[description]="${quote(data.description)}"` : '',
        `[path]="${quote(route)}"`,
      ].filter(Boolean).join(' ')
      return [`@import cl-layout from '${layout}'`, ...imports, `<cl-layout ${props}>${html}</cl-layout>`, ''].join('\n')
    },
  }
}
