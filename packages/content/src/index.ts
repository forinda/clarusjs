// Markdown pages for clarusjs. A page source: each .md file under src/pages becomes .tscl text (its HTML inside
// the layout), then compiles like any page. Build-time only: nothing here reaches the browser.
import { existsSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import MarkdownIt from 'markdown-it'
import { parse as parseYaml } from 'yaml'
import type { LanguageRegistration } from 'shiki/core'
import type { Source } from 'clarusjs/vite'
import { addLanguages, highlight } from './highlight.ts'
import { expand } from './snippets.ts'

/** Shell languages: `lineNumbers` leaves their commands unnumbered (a script, with a title or a #! line, is numbered). */
const SHELL = new Set(['sh', 'bash', 'shell', 'zsh', 'console', 'powershell', 'ps1'])

/**
 * `markdown()`'s options: the layout, components for blocks, code copy and quizzes, and frontmatter schemas.
 * @see https://clarusjs.com/reference/content#markdown
 */
export type MarkdownOptions = {
  /**
   * The layout every page renders in, root-relative (`/src/layouts/docs.tscl`), inside the page's folder and config
   * layouts. Frontmatter `layout` overrides it; `layout: false` there renders the page with no layout at all.
   */
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
  /**
   * Render ```mermaid blocks as diagrams: each becomes its source in `<pre class="mermaid">` (not highlighted) with your
   * diagram component after it, `<tag attach="visible" />`, which draws it in the browser. theme-docs ships one:
   * `{ tag: 'diagram', from: '@clarusjs/theme-docs/mermaid.tscl' }` (install `mermaid` beside it). Without this option
   * a ```mermaid block is code, as any other.
   */
  mermaid?: { tag: string; from: string }
  /**
   * Render `::: quiz` blocks through your quiz component (an island): `<tag [name] [question] [options] [answer]>`
   * with the explanation as its content. Without it they are static HTML that works without JavaScript.
   */
  quiz?: { tag: string; from: string }
  /**
   * Number the lines of every code block except shell commands (sh, bash, shell, zsh, console, powershell, ps1): a
   * command is copied, not referred to by line. A shell script is numbered: a block with a file title
   * (```bash [deploy.sh]) or a `#!` first line. `:no-line-numbers` turns one block off, `:line-numbers` one on.
   * @see https://clarusjs.com/guide/markdown#code
   */
  lineNumbers?: boolean
  /**
   * Every language Shiki has is highlighted already, loaded the first time a page uses it (by name or alias:
   * ```` ```rust ````, ```` ```py ````), from this package's own Shiki (nothing to install). Add grammars of your own
   * here, or names of Shiki's (`markdown({ langs: ['rust'] })`) to load them up front, where a typo is a build error.
   * A language Shiki doesn't have is plain text.
   * @see https://clarusjs.com/guide/markdown#code
   */
  langs?: (string | LanguageRegistration | LanguageRegistration[])[]
  /** `::: quiz` is for lessons (frontmatter `steps: true`); 'everywhere' allows it on any page. */
  quizzes?: 'lessons' | 'everywhere'
  /**
   * Validate each page's frontmatter: one [Standard Schema](https://standardschema.dev) (Zod, Valibot, ArkType…), or
   * one per folder under src/pages (`{ 'guide/**': Guide, 'blog/*.md': Post }`, the first matching glob wins). A
   * page that doesn't match fails the build; the schema's output (defaults, coercions) is what the page gets.
   * Synchronous schemas only.
   * @see https://clarusjs.com/guide/markdown#frontmatter-schemas
   */
  /**
   * Folders of components a page can use by tag without importing them: `'/src/components'` (root-relative), or
   * several, searched in order. `<counter />` imports counter.tscl, `<todoSummary />` todo-summary.tscl. An explicit
   * `@import` wins; an unknown camelCase tag is an error; tags in code stay text.
   */
  components?: string | string[]
  schema?: StandardSchema | Record<string, StandardSchema>
}

/**
 * The Standard Schema interface (https://standardschema.dev), as much of it as validating frontmatter needs.
 * @see https://clarusjs.com/reference/content#markdown
 */
export type StandardSchema<Output = unknown> = {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: string
    validate(value: unknown): StandardResult<Output> | Promise<StandardResult<Output>>
  }
}
type StandardResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: ReadonlyArray<{ readonly message: string; readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> }> }

/** 'guide/**' and 'blog/*.md' as a regex over a page's path under src/pages: ** any depth, * within one segment. */
function globToRegex(glob: string): RegExp {
  const pattern = glob
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '\0A').replace(/\/\*\*$/, '\0B').replace(/\*\*/g, '\0C') // ** first, so * below is one segment
    .replace(/\*/g, '[^/]*')
    .replace(/\0A/g, '(?:.*/)?').replace(/\0B/g, '(?:/.*)?').replace(/\0C/g, '.*')
  return new RegExp(`^${pattern}$`)
}

/** The page's frontmatter after its schema (if any): its output, or an error listing each issue. */
function validateFrontmatter(data: Record<string, unknown>, schema: MarkdownOptions['schema'], file: string, root: string): Record<string, unknown> {
  if (!schema) return data
  const rel = relative(root, file).split(sep).join('/')
  const underPages = rel.replace(/^src\/pages\//, '')
  const pick = '~standard' in schema ? schema : Object.entries(schema as Record<string, StandardSchema>).find(([glob]) => globToRegex(glob).test(underPages))?.[1]
  if (!pick) return data
  const result = (pick as StandardSchema)['~standard'].validate(data)
  if (result instanceof Promise) throw new Error(`${rel}: the frontmatter schema validated asynchronously; markdown({ schema }) needs a synchronous schema`)
  if (result.issues) {
    throw new Error(result.issues.map((issue) => {
      const path = (issue.path ?? []).map((p) => String(typeof p === 'object' ? p.key : p)).join('.')
      return `${rel}: frontmatter${path ? `.${path}` : ''}: ${issue.message}`
    }).join('\n'))
  }
  return result.value as Record<string, unknown>
}

const TYPES = ['tip', 'info', 'warning', 'danger', 'details', 'code-group', 'quiz'] as const
const TITLES: Record<string, string> = { tip: 'Tip', info: 'Info', warning: 'Warning', danger: 'Danger', details: 'Details', note: 'Note', important: 'Important', caution: 'Caution' }
// GitHub alerts → container type (the alert's name stays its title).
const ALERTS: Record<string, string> = { note: 'info', tip: 'tip', important: 'info', warning: 'warning', caution: 'danger' }
/** Text safe inside generated .tscl markup: HTML escaped, and nothing a template would read ({ } @). */
const inert = (s: string) => escapeHtml(s).replace(/\{/g, '&#123;').replace(/\}/g, '&#125;').replace(/@/g, '&#64;')

export { highlightTemplates } from './templates.ts'

/**
 * 'Hello, World!' → 'hello-world'. Shared by heading ids and (later) link checking.
 * @example
 * ```ts
 * slugify('Getting started!') // 'getting-started'
 * ```
 * @see https://clarusjs.com/reference/content#slugify
 */
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
    // The closing ::: is the first one outside fenced code (an example may show ::: itself).
    let close = startLine + 1
    let fence = ''
    for (; close < endLine; close++) {
      const text = state.src.slice(state.bMarks[close]! + state.tShift[close]!, state.eMarks[close]).trim()
      const marker = /^(`{3,}|~{3,})/.exec(text)?.[1]
      if (fence) { if (marker && marker[0] === fence[0] && marker.length >= fence.length && text === marker) fence = ''; continue }
      if (marker) { fence = marker; continue }
      if (text === m[1]) break
    }
    const open = state.push(m[2] === 'code-group' ? 'cl_group_open' : 'cl_container_open', 'div', 1)
    open.info = m[2]!
    open.meta = { title: m[3]?.trim() || titles[m[2]!]! }
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
      Object.assign(t[i]!, { type: 'cl_container_open', tag: 'div', info: ALERTS[name], meta: { title: titles[name]! } })
      // The marker's own paragraph is gone if nothing else was on its line.
      if (!t[i + 2]!.content.trim()) t.splice(i + 1, 3)
    }
  })

  // ::: quiz Question: its task list (- [ ] / - [x]) is the options, the rest the explanation. The list becomes one
  // cl_quiz token (rendered as the options and the start of the answer); the question and options are plain text.
  // Inline Markdown as plain text (`code` and **bold** keep their words).
  const plain = (src: string) => (md.parseInline(src, {})[0]?.children ?? []).filter((c) => c.type === 'text' || c.type === 'code_inline').map((c) => c.content).join('')
  md.core.ruler.after('cl_alerts', 'cl_quiz', (state) => {
    const t = state.tokens
    const env = state.env as { file: string; quizzes: number; quizAllowed: boolean }
    for (let i = 0; i < t.length; i++) {
      if (t[i]!.type !== 'cl_container_open' || t[i]!.info !== 'quiz') continue
      if (!env.quizAllowed) throw new Error(`${env.file}: ::: quiz is for lessons (frontmatter steps: true); markdown({ quizzes: 'everywhere' }) allows it on any page`)
      // Only a list inside this block counts.
      let close = i + 1
      for (let depth = 1; close < t.length; close++) {
        if (t[close]!.type === 'cl_container_open') depth++
        else if (t[close]!.type === 'cl_container_close' && --depth === 0) break
      }
      const start = t.findIndex((tok, j) => j > i && j < close && tok.type === 'bullet_list_open')
      if (start === -1) throw new Error(`${env.file}: a quiz needs exactly one right answer (- [x]) in its list of options`)
      let end = start
      for (let depth = 0; end < t.length; end++) {
        if (t[end]!.type === 'bullet_list_open') depth++
        else if (t[end]!.type === 'bullet_list_close' && --depth === 0) break
      }
      const options: string[] = []
      let answer = -1
      let right = 0
      for (let j = start; j < end; j++) {
        if (t[j]!.type !== 'inline' || t[j]!.level !== t[start]!.level + 3) continue
        const m = /^\[([ xX])\]\s+/.exec(t[j]!.content)
        if (m && m[1] !== ' ') { answer = options.length; right++ }
        options.push(plain(t[j]!.content.replace(/^\[[ xX]\]\s+/, '')))
      }
      if (right !== 1) throw new Error(`${env.file}: a quiz needs exactly one right answer (- [x]) in its list of options`)
      const question = (t[i]!.meta as { title: string }).title
      t[i]!.meta = { title: plain(question), name: `quiz-${env.quizzes++}`, options, answer, html: md.renderInline(question) }
      const token = new state.Token('cl_quiz', '', 0)
      token.meta = t[i]!.meta
      t.splice(start, end - start + 1, token)
    }
  })

  // env carries the page's placeholder list (see protectTags).
  md.renderer.rules.cl_container_open = (tokens, i, _o, env) => {
    const tags = (env as { tags: string[] }).tags
    const { info: type, meta } = tokens[i]!
    const { title } = meta as { title: string }
    if (type === 'details') return `<details class="custom-block details"><summary>${escapeHtml(title)}</summary>\n`
    if (type === 'quiz') {
      const q = meta as { name: string; html: string; options: string[]; answer: number }
      if (!options.quiz) return `<div class="quiz" data-quiz="${q.name}">`
      // Binding values are JavaScript, not HTML: quote() makes the text a string literal safe inside "…" (no HTML
      // escaping, which the template's {{ }} would show as &lt;…).
      tags.push(`<${options.quiz.tag} [name]="${quote(q.name)}" [question]="${quote(title)}" [options]="[${q.options.map(quote).join(', ')}]" [answer]="${q.answer}">`)
      return `<!--cl-tag-${tags.length - 1}-->`
    }
    if (options.container) {
      tags.push(`<${options.container.tag} [type]="'${type}'">@slot('title') {${inert(title)}}`)
      return `<!--cl-tag-${tags.length - 1}-->\n`
    }
    return `<div class="custom-block ${type}"><p class="custom-block-title">${escapeHtml(title)}</p>\n`
  }
  // A quiz's options and the start of its answer (static HTML; with a quiz component, nothing: it has them as props).
  md.renderer.rules.cl_quiz = (tokens, i) => {
    if (options.quiz) return ''
    const { name, html, options: choices, answer } = tokens[i]!.meta as { name: string; html: string; options: string[]; answer: number }
    const labels = choices.map((text, n) => `<label><input type="radio" name="${name}" value="${n}"> ${escapeHtml(text)}</label>`).join('')
    return `<p class="quiz-question" id="${name}-q">${html}</p><div class="quiz-options" role="radiogroup" aria-labelledby="${name}-q">${labels}</div>`
      + `<details class="quiz-answer"><summary>Show the answer</summary><p class="quiz-correct">Answer: ${escapeHtml(choices[answer]!)}</p>\n`
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

  // A table can take focus: when it scrolls sideways on a small screen, keyboard users can scroll it (WCAG 2.1.1).
  md.renderer.rules.table_open = (tokens, i, options, _env, self) => {
    tokens[i]!.attrSet('tabindex', '0')
    return self.renderToken(tokens, i, options)
  }

  // ```lang {1,3} [title] :line-numbers (or :no-line-numbers, with lineNumbers on)
  md.renderer.rules.fence = (tokens, i, _o, env) => {
    const e = env as { tags: string[]; group?: { id: number; n: number } }
    const info = tokens[i]!.info.trim()
    const lang = /^[^\s{[:]+/.exec(info)?.[0] ?? 'text'
    if (options.mermaid && lang === 'mermaid' && !e.group) {
      e.tags.push(`<${options.mermaid.tag} attach="visible" />`)
      return `<div class="mermaid-diagram"><pre class="mermaid" tabindex="0">${inert(tokens[i]!.content.replace(/\n$/, ''))}</pre><!--cl-tag-${e.tags.length - 1}--></div>\n`
    }
    const title = /\[([^\]]+)\]/.exec(info)?.[1]
    const code = tokens[i]!.content
    // Shell commands aren't numbered; a shell script (a file title, or a #! line) is.
    const command = SHELL.has(lang.toLowerCase()) && !title && !code.startsWith('#!')
    const lineNumbers =
      /(^|\s):line-numbers\b/.test(info) ||
      (!!options.lineNumbers && !command && !/(^|\s):no-line-numbers\b/.test(info))
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
    if (tokens[i]!.info === 'quiz') {
      if (!options.quiz) return '</details></div>\n'
      tags.push(`</${options.quiz.tag}>`)
      return `<!--cl-tag-${tags.length - 1}-->\n`
    }
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

  // {since=0.16.0}, {deprecated=0.17.0 removed=0.18.0}: when a feature came and when it goes, as a badge (in a
  // heading, a table cell or text). Not part of a heading's id or anchor text. Anything else in braces stays text.
  const VERSION = /\{((?:since|deprecated|removed)=\d+\.\d+\.\d+(?:\s+(?:since|deprecated|removed)=\d+\.\d+\.\d+)*)\}/g
  md.core.ruler.after('inline', 'cl_versions', (state) => {
    for (const block of state.tokens) {
      if (block.type !== 'inline' || !block.children) continue
      block.children = block.children.flatMap((t) => {
        if (t.type !== 'text' || !VERSION.test(t.content)) return [t]
        VERSION.lastIndex = 0
        const out: (typeof t)[] = []
        let at = 0
        for (const m of t.content.matchAll(VERSION)) {
          out.push(Object.assign(new state.Token('text', '', 0), { content: t.content.slice(at, m.index) }))
          const v = Object.fromEntries(m[1]!.split(/\s+/).map((kv) => kv.split('=') as [string, string]))
          const label = v.since ? `Since ${v.since}` : v.deprecated ? `Deprecated in ${v.deprecated}${v.removed ? `, removed in ${v.removed}` : ''}` : `Removed in ${v.removed}`
          const kind = v.since ? 'since' : v.deprecated ? 'deprecated' : 'removed'
          out.push(Object.assign(new state.Token('html_inline', '', 0), { content: `<span class="version" data-version="${kind}">${escapeHtml(label)}</span>` }))
          at = m.index! + m[0].length
        }
        out.push(Object.assign(new state.Token('text', '', 0), { content: t.content.slice(at) }))
        return out.filter((x) => x.type !== 'text' || x.content)
      })
    }
  })

  // Headings get an id and an anchor link; ids are unique within the page.
  md.core.ruler.push('cl_anchors', (state) => {
    const used = new Set<string>()
    state.tokens.forEach((token, i) => {
      if (token.type !== 'heading_open') return
      const inline = state.tokens[i + 1]!
      const text = (inline.children ?? []).filter((t: Tok) => t.type === 'text' || t.type === 'code_inline').map((t: Tok) => t.content).join('').trim()
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

/**
 * Frontmatter `image` (the social card), `lastmod` (the sitemap's date for the page), `jsonLd` (an object or a list), `head: [[tag, attrs, content?]]` and `titleTemplate: false` (the title as written), and with no layout to pass them to (`bare`) the title and description, as <cl-head>, which
 * the server moves into the page's <head>.
 */
function pageHead(data: Record<string, unknown>, title: string | undefined, bare = false): string {
  const tags: string[] = []
  if (data.titleTemplate === false && title !== undefined) tags.push(`<title>${escapeHtml(title)}</title>`)
  // No layout receives the title and description (layout: false, or only folder layouts): they go in the head
  // here, the title with the site's template (data-cl-template), as a layout's own <title> would get it.
  else if (bare && title !== undefined) tags.push(`<title data-cl-template>${escapeHtml(title)}</title>`)
  if (bare && typeof data.description === 'string') tags.push(`<meta name="description" content="${escapeHtml(data.description)}">`)
  if (data.sitemap === false) tags.push('<meta name="sitemap" content="false">')
  // lastmod: the page's date in the sitemap (over git's). YAML may read a bare date as a Date.
  const lastmod = data.lastmod instanceof Date ? data.lastmod.toISOString().slice(0, 10) : typeof data.lastmod === 'string' ? data.lastmod : undefined
  if (lastmod !== undefined) tags.push(`<meta name="sitemap:lastmod" content="${escapeHtml(lastmod)}">`)
  if (typeof data.image === 'string') tags.push(`<meta property="og:image" content="${escapeHtml(data.image)}">`)
  const raws: string[] = [] // scripts: raw text, kept out of staticHtml
  for (const entry of Array.isArray(data.head) ? data.head : []) {
    const [tag, attrs = {}, content] = entry as [string, Record<string, unknown>, string?]
    if (typeof tag !== 'string' || !/^[a-z]+$/.test(tag)) continue
    const a = staticHtml(Object.entries(attrs).map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${escapeHtml(String(v))}"`)).join(''))
    if (tag === 'script') {
      // A script's content is raw text: never HTML-escaped (browsers don't decode it). JSON-LD stays static JSON ({{
      // only occurs inside its strings, where \u007b keeps it from reading as a hole); any other script is an inline
      // script, which the template compiler writes out exactly.
      const raw = content ?? ''
      raws.push(attrs.type === 'application/ld+json' ? `<script${a}>${raw.replace(/\{\{/g, '{\\u007b')}</script>` : `<script inline${a}>${raw}</script>`)
      continue
    }
    tags.push(['meta', 'link', 'base'].includes(tag) && content === undefined ? `<${tag}${a}>` : `<${tag}${a}>${escapeHtml(content ?? '')}</${tag}>`)
  }
  // JSON-LD isn't HTML: it skips staticHtml (entities aren't decoded in a script). {{ only occurs inside JSON strings,
  // where \u007b keeps the template compiler from reading it as a hole.
  const ld = [data.jsonLd ?? []].flat().map((value) => `<script type="application/ld+json">${JSON.stringify(value)
    .replace(/[<>&\u2028\u2029]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`).replace(/\{\{/g, '{\\u007b')}</script>`)
  return tags.length || raws.length || ld.length ? `<cl-head>${staticHtml(tags.join(''))}${raws.join('')}${ld.join('')}</cl-head>` : ''
}

/** Markdown output is static HTML: anything a .tscl template would read as syntax ({{ }}, @if …) is escaped. */
function staticHtml(html: string): string {
  const inertText = (s: string) => s.replace(/\{\{/g, '&#123;&#123;').replace(/@/g, '&#64;')
  // A verbatim element's content is already shown as text by the compiler: escaping it here would show the entities.
  // Its opening tag is still escaped (attributes can hold holes), and only an attribute named verbatim counts
  // (values are dropped before looking). The content ends at the first </tag>, as in the compiler.
  let out = ''
  let at = 0
  for (const m of html.matchAll(/<([\w-]+)(\s[^>]*)?>/g)) {
    const names = (m[2] ?? '').replace(/=\s*("[^"]*"|'[^']*'|[^\s>]*)/g, '')
    if (m.index < at || !/(^|\s)verbatim(?=[\s/]|$)/.test(names)) continue
    const start = m.index + m[0].length
    const close = html.indexOf(`</${m[1]}>`, start)
    if (close === -1) continue
    out += inertText(html.slice(at, start)) + html.slice(start, close)
    at = close
  }
  return out + inertText(html.slice(at))
}

// Code in Markdown: fences, then inline spans. What's inside stays text (a tag in an example is no component).
const CODE = /(?:^|\n)[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:\n[ \t]*\1[`~]*[ \t\r]*(?=\n|$)|$)|(`+)[\s\S]*?[^`]\2(?!`)/

// HTML's own elements: never taken for a component, even if a file has the name.
const HTML_TAGS = new Set('a abbr address area article aside audio b base bdi bdo blockquote body br button canvas caption cite code col colgroup data datalist dd del details dfn dialog div dl dt em embed fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe img input ins kbd label legend li link main map mark menu meta meter nav noscript object ol optgroup option output p picture pre progress q rp rt ruby s samp script search section select slot small source span strong style sub summary sup table tbody td template textarea tfoot th thead time title tr track u ul var video wbr svg math'.split(' '))

/**
 * Imports for the components a page uses by tag (`markdown({ components })`): a tag naming `<dir>/<tag>.tscl` (or the
 * kebab-case file of a camelCase tag), in the first folder that has it. Tags already imported, HTML's own and those in
 * code are skipped; an unknown camelCase tag (no HTML element has capitals) is an error naming the page.
 */
function autoImports(body: string, dirs: string[], root: string, file: string, imported: Set<string>): string[] {
  const out: string[] = []
  const seen = new Set(imported)
  const text = body.replace(new RegExp(CODE.source, 'g'), '')
  for (const [, name] of text.matchAll(/<([A-Za-z][\w-]*)/g)) {
    if (seen.has(name!) || HTML_TAGS.has(name!)) continue
    seen.add(name!)
    const kebab = name!.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())
    const found = dirs.flatMap((dir) => [name!, kebab].map((f) => `${dir.replace(/\/$/, '')}/${f}.tscl`)).find((f) => existsSync(resolve(root, '.' + f)))
    if (found) out.push(`@import ${name} from '${found}'`)
    else if (/[A-Z]/.test(name!)) throw new Error(`${file}: <${name}> is not a component in ${dirs.join(', ')} (check the name, or @import it)`)
  }
  return out
}

/**
 * Component tags (and any tag with [prop] or (event) bindings) aren't valid CommonMark HTML, so markdown-it would
 * escape them. They are swapped for HTML comments, which it passes through, and put back after rendering.
 */
function protectTags(body: string, components: Set<string>, saved: string[]): { body: string; restore(html: string): string } {
  // Code (fences, then inline spans) is matched first and kept as written: a tag in an example stays text.
  // ponytail: indented code blocks aren't recognised; use a fence to show a component tag in code.
  const code = CODE
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

/**
 * Markdown pages as a page source: `src/pages/**\/*.md` become pages, rendered in your layout, with frontmatter, headings
 * with anchors, highlighted code, `::: tip` blocks, components imported at the top, and (in lessons) quizzes.
 * Build-time only: nothing of it reaches the browser.
 * @example
 * ```ts
 * // vite.config.ts
 * import clarusjs from 'clarusjs/vite'
 * import markdown from '@clarusjs/content'
 *
 * export default defineConfig({
 *   plugins: [clarusjs({ sources: [markdown({ layout: '/src/layouts/docs.tscl' })] })],
 * })
 * ```
 * @see https://clarusjs.com/reference/content#markdown
 */
export default function markdown(options: MarkdownOptions = {}): Source {
  if (options.langs?.length) addLanguages(options.langs)
  const md = renderer(options)
  return {
    extension: '.md',
    toTscl(code, file, context) {
      const { route } = context
      // ---\nyaml\n---: the page's frontmatter.
      const front = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(code)
      const data = validateFrontmatter((front ? parseYaml(front[1]!) : null) ?? {}, options.schema, file, context.root)
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
      // Components used by tag, from the configured folders (explicit imports win).
      if (options.components) {
        const explicit = new Set(imports.map((line) => /^@import\s+([A-Za-z_$][\w-]*)\s+from/.exec(line)?.[1]).filter((n): n is string => !!n))
        imports.push(...autoImports(body, [options.components].flat(), context.root, file, explicit))
      }
      // Blocks rendered through a component need it imported.
      if (options.container && !imports.some((line) => new RegExp(`^@import\\s+${options.container!.tag}\\s+from`).test(line))) {
        imports.unshift(`@import ${options.container.tag} from '${options.container.from}'`)
      }
      const components = new Set(imports.map((line) => /^@import\s+([A-Za-z_$][\w-]*)\s+from/.exec(line)?.[1]).filter((n): n is string => !!n))
      // cl-layout names the generated layout import (tag names must start with a letter, so not __cl_).
      if (components.has('cl-layout')) throw new Error(`${file}: cl-layout is reserved for the page's layout; import the component under another name`)
      if (options.quiz && /^\s*:{3,}\s*quiz\b/m.test(body) && !imports.some((line) => new RegExp(`^@import\\s+${options.quiz!.tag}\\s+from`).test(line))) {
        imports.unshift(`@import ${options.quiz.tag} from '${options.quiz.from}'`)
      }
      if (options.mermaid && /^\s*(`{3,}|~{3,})\s*mermaid\b/m.test(body) && !imports.some((line) => new RegExp(`^@import\\s+${options.mermaid!.tag}\\s+from`).test(line))) {
        imports.unshift(`@import ${options.mermaid.tag} from '${options.mermaid.from}'`)
      }
      if (options.copy && !imports.some((line) => new RegExp(`^@import\\s+${options.copy!.tag}\\s+from`).test(line))) {
        imports.unshift(`@import ${options.copy.tag} from '${options.copy.from}'`)
      }
      const env = { tags: [] as string[], groups: 0, file, root: context.root, quizzes: 0, quizAllowed: data.steps === true || options.quizzes === 'everywhere' }
      const tags = protectTags(body, components, env.tags)
      let tokens = md.parse(tags.body, env)
      // steps: true (lessons): each h2 and what follows it, up to the next h2, is a <section class="step">; the
      // layout can show one at a time, and without JavaScript it is a plain page.
      if (data.steps === true && tokens.length) {
        const Token = tokens[0]!.constructor as new (type: string, tag: string, nesting: number) => (typeof tokens)[number]
        const html = (content: string) => Object.assign(new Token('html_block', '', 0), { content })
        let open = false
        tokens = tokens.flatMap((t) => {
          if (t.type !== 'heading_open' || t.tag !== 'h2' || t.level !== 0) return [t]
          const before = open ? [html('</section>\n')] : []
          open = true
          return [...before, html(`<section class="step" aria-labelledby="${escapeHtml(String(t.attrGet('id') ?? ''))}">\n`), t]
        })
        if (open) tokens.push(html('</section>\n'))
      }
      const headings = tokens.flatMap((t, i) => {
        // Top-level only, like the lesson steps: a heading inside a blockquote or list isn't a section of the page.
        if (t.type !== 'heading_open' || (t.tag !== 'h2' && t.tag !== 'h3') || t.level !== 0) return []
        const text = (tokens[i + 1]!.children ?? []).filter((c: Tok) => c.type === 'text' || c.type === 'code_inline').map((c: Tok) => c.content).join('').trim()
        return [{ id: String(t.attrGet('id') ?? ''), text, level: t.tag === 'h2' ? 2 : 3 }]
      })
      const h1 = tokens.findIndex((t: Tok & { tag: string }) => t.type === 'heading_open' && t.tag === 'h1')
      const firstHeading = h1 === -1 ? undefined : (tokens[h1 + 1]!.children ?? []).filter((t: Tok) => t.type === 'text' || t.type === 'code_inline').map((t: Tok) => t.content).join('')
      const title = typeof data.title === 'string' ? data.title : firstHeading
      const layout = data.layout === false ? undefined : typeof data.layout === 'string' ? data.layout : options.layout
      const html = pageHead(data, title, !layout) + tags.restore(staticHtml(md.renderer.render(tokens, md.options, env)))

      // layout: false in frontmatter: no layout at all, not even the folder's (#472). No layout of its own: the folder
      // and config layouts wrap it, as they do a .tscl page.
      if (data.layout === false) return ['@layout none', ...imports, html].join('\n')
      if (!layout) return [...imports, html].join('\n')
      const props = [
        title !== undefined ? `[title]="${quote(title)}"` : '',
        typeof data.description === 'string' ? `[description]="${quote(data.description)}"` : '',
        `[path]="${quote(route)}"`,
        // The page's h2 and h3, for the layout's "On this page" (ids as the heading anchors have them).
        headings.length ? `[headings]="[${headings.map((h) => `{ id: ${quote(h.id)}, text: ${quote(h.text)}, level: ${h.level} }`).join(', ')}]"` : '',
      ].filter(Boolean).join(' ')
      return [`@import cl-layout from '${layout}'`, ...imports, `<cl-layout ${props}>${html}</cl-layout>`, ''].join('\n')
    },
  }
}
