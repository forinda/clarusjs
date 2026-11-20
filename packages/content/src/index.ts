// Markdown pages for clarusjs. A page source: each .md file under src/pages becomes .tscl text (its HTML inside
// the layout), then compiles like any page. Build-time only: nothing here reaches the browser.
import { dirname, relative, resolve, sep } from 'node:path'
import MarkdownIt from 'markdown-it'
import { parse as parseYaml } from 'yaml'
import type { Source } from 'clarusjs/vite'
import { highlight } from './highlight.ts'
import { expand } from './snippets.ts'

export type MarkdownOptions = {
  /** The layout every page renders in, root-relative (`/src/layouts/docs.tscl`). Frontmatter `layout` overrides it; `false` means none. */
  layout?: string | false
  /**
   * Render `::: tip` blocks (and alerts) through your own component: `<tag [type]="'tip'">`, with a custom title in its
   * `title` slot. Without it they are plain HTML: `<div class="custom-block tip">`.
   */
  container?: { tag: string; from: string }
  /** Block titles, to localize them: { tip: 'Astuce', note: 'Remarque', … }. */
  titles?: Partial<Record<string, string>>
  /** Put your copy component in every code block: `<tag attach="interaction" />` (it finds the code itself). */
  copy?: { tag: string; from: string }
}

const TYPES = ['tip', 'info', 'warning', 'danger', 'details', 'code-group'] as const
const TITLES: Record<string, string> = { tip: 'Tip', info: 'Info', warning: 'Warning', danger: 'Danger', details: 'Details', note: 'Note', important: 'Important', caution: 'Caution' }
// GitHub alerts → container type (the alert's name stays its title).
const ALERTS: Record<string, string> = { note: 'info', tip: 'tip', important: 'info', warning: 'warning', caution: 'danger' }
/** Text safe inside generated .tscl markup: HTML escaped, and nothing a template would read ({ } @). */
const inert = (s: string) => escapeHtml(s).replace(/\{/g, '&#123;').replace(/\}/g, '&#125;').replace(/@/g, '&#64;')

/** 'Hello, World!' → 'hello-world'. Shared by heading ids and (later) link checking. */
export function slugify(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-') || 'section'
}

/** A JavaScript string literal that is safe inside a double-quoted .tscl attribute. */
const quote = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\u0022').replace(/\n/g, '\\n')}'`
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

type Md = InstanceType<typeof MarkdownIt>
type Tok = { type: string; content: string }

function renderer(options: MarkdownOptions): Md {
  const md = new MarkdownIt({ html: true, linkify: true })
  const titles = { ...TITLES, ...options.titles }

  // ::: type [title] … ::: (a longer fence, such as ::::, nests around a shorter one).
  md.block.ruler.before('fence', 'cl_container', (state, startLine, endLine, silent) => {
    const line = state.src.slice(state.bMarks[startLine]! + state.tShift[startLine]!, state.eMarks[startLine]).trim()
    const m = /^(:{3,})\s*([a-z-]+)(?:\s+(.*))?$/.exec(line)
    if (!m || !(TYPES as readonly string[]).includes(m[2]!)) return false
    if (silent) return true
    let close = startLine + 1
    while (close < endLine && state.src.slice(state.bMarks[close]! + state.tShift[close]!, state.eMarks[close]).trim() !== m[1]) close++
    const open = state.push(m[2] === 'code-group' ? 'cl_group_open' : 'cl_container_open', 'div', 1)
    open.info = m[2]!
    open.meta = { title: m[3]?.trim() || titles[m[2]!]!, custom: Boolean(m[3]?.trim()) }
    const oldMax = state.lineMax
    state.lineMax = close
    state.md.block.tokenize(state, startLine + 1, close)
    state.lineMax = oldMax
    state.push(m[2] === 'code-group' ? 'cl_group_close' : 'cl_container_close', 'div', -1).info = m[2]!
    state.line = Math.min(close + 1, endLine)
    return true
  })

  // > [!NOTE] … becomes the same block as ::: info, titled with the alert's name.
  md.core.ruler.after('block', 'cl_alerts', (state) => {
    const t = state.tokens
    for (let i = 0; i < t.length - 2; i++) {
      if (t[i]!.type !== 'blockquote_open' || t[i + 1]!.type !== 'paragraph_open' || t[i + 2]!.type !== 'inline') continue
      const m = /^\[!(note|tip|important|warning|caution)\][ \t]*(?:\n|$)/i.exec(t[i + 2]!.content)
      if (!m) continue
      const name = m[1]!.toLowerCase()
      t[i + 2]!.content = t[i + 2]!.content.slice(m[0].length)
      let depth = 0
      for (let j = i; j < t.length; j++) {
        if (t[j]!.type === 'blockquote_open') depth++
        else if (t[j]!.type === 'blockquote_close' && --depth === 0) {
          Object.assign(t[j]!, { type: 'cl_container_close', tag: 'div', info: ALERTS[name] })
          break
        }
      }
      Object.assign(t[i]!, { type: 'cl_container_open', tag: 'div', info: ALERTS[name], meta: { title: titles[name]!, custom: false } })
      // The marker's own paragraph is gone if nothing else was on its line.
      if (!t[i + 2]!.content.trim()) t.splice(i + 1, 3)
    }
  })

  // env carries the page's placeholder list (see protectTags).
  md.renderer.rules.cl_container_open = (tokens, i, _o, env) => {
    const tags = (env as { tags: string[] }).tags
    const { info: type, meta } = tokens[i]!
    const { title, custom } = meta as { title: string; custom: boolean }
    if (type === 'details') return `<details class="custom-block details"><summary>${escapeHtml(title)}</summary>\n`
    if (options.container) {
      tags.push(`<${options.container.tag} [type]="'${type}'">${custom ? `@slot('title') {${inert(title)}}` : ''}`)
      return `<!--cl-tag-${tags.length - 1}-->\n`
    }
    return `<div class="custom-block ${type}"><p class="custom-block-title">${escapeHtml(title)}</p>\n`
  }
  // ::: code-group: radio inputs and labels, each followed by its block. CSS shows the checked one's block, so the
  // tabs work without JavaScript.
  md.renderer.rules.cl_group_open = (_t, _i, _o, env) => {
    const e = env as { groups: number; group?: { id: number; n: number } }
    e.group = { id: e.groups++, n: 0 }
    return '<div class="code-group">'
  }
  md.renderer.rules.cl_group_close = (_t, _i, _o, env) => {
    delete (env as { group?: unknown }).group
    return '</div>\n'
  }

  // ```lang {1,3} [title] :line-numbers
  md.renderer.rules.fence = (tokens, i, _o, env) => {
    const e = env as { tags: string[]; group?: { id: number; n: number } }
    const info = tokens[i]!.info.trim()
    const lang = /^[^\s{[:]+/.exec(info)?.[0] ?? 'text'
    const title = /\[([^\]]+)\]/.exec(info)?.[1]
    const lineNumbers = /(^|\s):line-numbers\b/.test(info)
    const code = tokens[i]!.content
    let out = ''
    if (e.group) {
      const id = `cl-group-${e.group.id}-${e.group.n}`
      out += `<input type="radio" name="cl-group-${e.group.id}" id="${id}"${e.group.n === 0 ? ' checked' : ''}><label for="${id}">${escapeHtml(title ?? lang)}</label>`
      e.group.n++
    }
    out += `<div class="code-block language-${escapeHtml(lang)}${lineNumbers ? ' line-numbers' : ''}">`
    if (title && !e.group) out += `<p class="code-title">${escapeHtml(title)}</p>`
    out += `<span class="lang">${escapeHtml(lang)}</span>${highlight(code.replace(/\n$/, ''), lang, info.slice(lang.length))}`
    if (lineNumbers) {
      const count = code.replace(/\n$/, '').split('\n').length
      out += `<div class="line-numbers-column" aria-hidden="true">${Array.from({ length: count }, (_, n) => `<span>${n + 1}</span>`).join('')}</div>`
    }
    if (options.copy) {
      e.tags.push(`<${options.copy.tag} attach="interaction" />`)
      out += `<!--cl-tag-${e.tags.length - 1}-->`
    }
    return `${out}</div>${e.group ? '' : '\n'}`
  }

  md.renderer.rules.cl_container_close = (tokens, i, _o, env) => {
    const tags = (env as { tags: string[] }).tags
    if (tokens[i]!.info === 'details') return '</details>\n'
    if (options.container) {
      tags.push(`</${options.container.tag}>`)
      return `<!--cl-tag-${tags.length - 1}-->\n`
    }
    return '</div>\n'
  }
  // [text](./other.md): relative links to page source files become their routes, so authors link by file.
  md.core.ruler.push('cl_page_links', (state) => {
    const { file, root } = state.env as { file?: string; root?: string }
    if (!file || !root) return
    const pages = resolve(root, 'src/pages') + sep
    for (const block of state.tokens) {
      for (const token of block.children ?? []) {
        if (token.type !== 'link_open') continue
        const m = /^(?![a-z][\w+.-]*:|\/|#)([^?#]+\.(?:md|tscl))([?#].*)?$/i.exec(String(token.attrGet('href') ?? ''))
        if (!m) continue
        const target = resolve(dirname(file), m[1]!)
        if (!target.startsWith(pages)) continue // not a page: left for the link checker
        const route = `/${relative(pages, target).split(sep).join('/').replace(/\.(md|tscl)$/i, '').replace(/(^|\/)index$/, '')}`
        token.attrSet('href', (route.length > 1 ? route.replace(/\/$/, '') : route) + (m[2] ?? ''))
      }
    }
  })

  // Headings get an id and an anchor link; ids are unique within the page.
  md.core.ruler.push('cl_anchors', (state) => {
    const used = new Set<string>()
    state.tokens.forEach((token, i) => {
      if (token.type !== 'heading_open') return
      const inline = state.tokens[i + 1]!
      const text = (inline.children ?? []).filter((t: Tok) => t.type === 'text' || t.type === 'code_inline').map((t: Tok) => t.content).join('')
      const base = slugify(text)
      let id = base
      for (let n = 1; used.has(id); n++) id = `${base}-${n}`
      used.add(id)
      token.attrSet('id', id)
      token.attrSet('tabindex', '-1')
      // The page title keeps its id, but no anchor link: it would only repeat the heading for screen readers.
      if (token.tag === 'h1') return
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
function protectTags(body: string, components: Set<string>, saved: string[]): { body: string; restore(html: string): string } {
  // Code (fences, then inline spans) is matched first and kept as written: a tag in an example stays text.
  // ponytail: indented code blocks aren't recognised; use a fence to show a component tag in code.
  const code = /(?:^|\n)[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:\n[ \t]*\1[`~]*[ \t]*(?=\n|$)|$)|(`+)[\s\S]*?[^`]\2(?!`)/
  const tag = /<\/?([A-Za-z][\w-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>/
  const out = body.replace(new RegExp(`${code.source}|${tag.source}`, 'g'), (match, _fence, _ticks, name: string | undefined, attrs: string) => {
    if (name === undefined) return match
    const tag = match
    if (!components.has(name) && !/\s[[(]/.test(attrs)) return tag
    saved.push(tag)
    return `<!--cl-tag-${saved.length - 1}-->`
  })
  return { body: out, restore: (html) => html.replace(/<!--cl-tag-(\d+)-->/g, (_, i: string) => saved[Number(i)]!) }
}

export default function markdown(options: MarkdownOptions = {}): Source {
  const md = renderer(options)
  return {
    extension: '.md',
    toTscl(code, file, context) {
      const { route } = context
      // ---\nyaml\n---: the page's frontmatter.
      const front = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(code)
      const data = (front ? parseYaml(front[1]!) : null) ?? {}
      // Snippets and includes first: what they bring in is Markdown like the rest of the page.
      let body = expand(front ? code.slice(front[0].length) : code, file, context)
      // @import lines at the top pass through, so components can be used in the Markdown.
      const imports: string[] = []
      for (;;) {
        const line = /^[ \t]*(@import\b[^\n]*)\n|^[ \t]*\n/.exec(body)
        if (!line) break
        if (line[1]) imports.push(line[1].trim())
        body = body.slice(line[0].length)
      }
      // Blocks rendered through a component need it imported.
      if (options.container && !imports.some((line) => new RegExp(`^@import\\s+${options.container!.tag}\\s+from`).test(line))) {
        imports.unshift(`@import ${options.container.tag} from '${options.container.from}'`)
      }
      const components = new Set(imports.map((line) => /^@import\s+([A-Za-z_$][\w-]*)\s+from/.exec(line)?.[1]).filter((n): n is string => !!n))
      // cl-layout names the generated layout import (tag names must start with a letter, so not __cl_).
      if (components.has('cl-layout')) throw new Error(`${file}: cl-layout is reserved for the page's layout; import the component under another name`)
      if (options.copy && !imports.some((line) => new RegExp(`^@import\\s+${options.copy!.tag}\\s+from`).test(line))) {
        imports.unshift(`@import ${options.copy.tag} from '${options.copy.from}'`)
      }
      const env = { tags: [] as string[], groups: 0, file, root: context.root }
      const tags = protectTags(body, components, env.tags)
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
