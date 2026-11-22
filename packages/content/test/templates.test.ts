// #153: code blocks in .tscl templates highlighted at build, as Markdown's are (highlightTemplates()).
import { parse, type TemplateNode } from 'clarusjs/compiler'
import { expect, test } from 'vitest'
import { highlightBlocks, highlightTemplates } from '../src/templates.ts'

/** Every node of a parsed template, depth first. */
const nodes = (list: TemplateNode[]): TemplateNode[] => list.flatMap((n) => [n, ...('children' in n ? nodes(n.children) : []), ...(n.type === 'if' ? n.branches.flatMap((b) => nodes(b.children)) : []), ...(n.type === 'for' ? nodes(n.empty ?? []) : [])])
/** The output stays plain static HTML for the compiler: no holes, no blocks. */
const inert = (html: string) => {
  const kinds = nodes(parse(html, 'x.tscl').nodes).map((n) => n.type)
  expect(kinds).not.toContain('expr')
  expect(kinds.some((k) => k === 'if' || k === 'for' || k === 'fill')).toBe(false)
}

test('<pre><code lang="ts">: highlighted like Markdown (Shiki, light and dark), entities decoded first', () => {
  const out = highlightBlocks('<p>x</p>\n<pre tabindex="0"><code lang="ts">const a = 1 &lt; 2</code></pre>\n')
  expect(out).toContain('<div class="code-block language-ts"><span class="lang">ts</span><pre class="shiki')
  expect(out).toContain('--shiki-dark')
  expect(out).toMatch(/>const</)
  expect(out).toMatch(/&lt;|&#x3C;/i) // the decoded < is escaped again by the highlighter
  expect(out.startsWith('<p>x</p>\n')).toBe(true)
  inert(out)
})

test('<code verbatim lang="tscl">: the raw code, with its {{ }} and @ kept as text', () => {
  const out = highlightBlocks('<pre tabindex="0"><code verbatim lang="tscl">@input x: string\n<p>{{ x }}</p></code></pre>')
  expect(out).toContain('language-tscl')
  expect(out).not.toContain('{{')
  expect(out).not.toMatch(/@input/)
  expect(out).toContain('&#64;')
  inert(out)
})

test('<pre verbatim lang="tscl">: its whole content is the code (a sample holding </code>)', () => {
  const out = highlightBlocks('<pre verbatim lang="tscl" tabindex="0"><code verbatim>\n  <p>Hello, {{ name }}!</p>\n</code></pre>')
  expect(out).toContain('language-tscl')
  expect(out).toMatch(/code.*verbatim/) // the sample's own tag, highlighted as text
  inert(out)
})

test('a block with {{ }} holes, or without a lang, is left as written; holes are reported', () => {
  const warnings: string[] = []
  const dynamic = '<pre><code lang="ts">{{ commands.join() }}</code></pre>'
  expect(highlightBlocks(dynamic, (w) => warnings.push(w))).toBe(dynamic)
  expect(warnings.join()).toMatch(/\{\{ \}\} holes.*left as written/)
  const plain = '<pre><code>const a = 1</code></pre>'
  expect(highlightBlocks(plain)).toBe(plain)
})

test('the Vite plugin: .tscl files only, before clarusjs, unchanged files untouched', () => {
  const plugin = highlightTemplates() as { enforce?: string; transform: { filter: { id: RegExp }; handler(code: string, id: string): unknown } }
  expect(plugin.enforce).toBe('pre')
  expect(plugin.transform.filter.id.test('/src/pages/index.tscl')).toBe(true)
  expect(plugin.transform.filter.id.test('/src/a.ts')).toBe(false)
  const ctx = { warn: () => {} }
  expect(plugin.transform.handler.call(ctx, '<p>x</p>', '/a.tscl')).toBeNull()
  expect((plugin.transform.handler.call(ctx, '<pre><code lang="ts">1</code></pre>', '/a.tscl') as { code: string }).code).toContain('shiki')
})
