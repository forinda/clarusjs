// #243: the playground's pure building blocks.
import { describe, expect, test } from 'vitest'
import { highlightTscl } from '../src/repl/highlight.ts'
import { rewriteImports } from '../src/repl/rewrite.ts'
import { decode, encode } from '../src/repl/share.ts'

const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')

const sample = `@input title: string = 'Hi'
{{-- a note --}}
<script>
  let open = state(false)
  const s = "</p> & <b>"
</script>
<section class="card" [title]="title" (click)="open = !open">
  @if (open) {
    <ul>@for (x of [1, 2]; track x) {<li>{{ x }} & more</li>}</ul>
  } @else {<p>Closed</p>}
</section>
<style scoped>p { color: red }</style>`

describe('highlightTscl', () => {
  test('its text is the source plus one newline (so the overlay lines up with the textarea)', () => {
    expect(text(highlightTscl(sample))).toBe(sample + '\n')
    expect(text(highlightTscl(''))).toBe('\n')
    expect(text(highlightTscl('a\n\n\t b\n'))).toBe('a\n\n\t b\n\n')
  })

  test('escapes <, & and quotes', () => {
    const html = highlightTscl('<p title="a">a & b</p>')
    expect(html).not.toMatch(/<p[ >]/)
    expect(html).toContain('&amp;')
    expect(html).toContain('&lt;')
  })

  test('marks the parts', () => {
    const html = highlightTscl(sample)
    expect(html).toMatch(/<span class="t-bind">\[title\]<\/span>/)
    expect(html).toMatch(/<span class="t-bind">\(click\)<\/span>/)
    expect(html).toMatch(/<span class="t-hole">\{\{ x \}\}<\/span>/)
    expect(html).toMatch(/<span class="t-block">@if<\/span>/)
    expect(html).toMatch(/<span class="t-block">@for<\/span>/)
    expect(html).toMatch(/<span class="t-dir">@input<\/span>/)
    expect(html).toMatch(/<span class="t-comment">\{\{-- a note --\}\}<\/span>/)
    expect(html).toMatch(/<span class="t-tag">&lt;section<\/span>/)
    expect(html).toMatch(/<span class="t-string">&quot;card&quot;<\/span>/)
    // Script and style bodies are plain text in step 1.
    expect(html).toContain('const s = &quot;&lt;/p&gt; &amp; &lt;b&gt;&quot;')
  })
})

describe('rewriteImports', () => {
  test('the server and client imports compile() prints, aliases kept', () => {
    const server = "import { escape as __cl_escape, island as __cl_island } from 'clarusjs/runtime/server'\nexport function render() {}"
    expect(rewriteImports(server)).toBe("const { escape: __cl_escape, island: __cl_island } = globalThis.__cl_repl['clarusjs/runtime/server']\nexport function render() {}")
    const client = "import { state, holes as __cl_holes } from 'clarusjs/runtime'\nexport function attach() {}"
    expect(rewriteImports(client)).toBe("const { state, holes: __cl_holes } = globalThis.__cl_repl['clarusjs/runtime']\nexport function attach() {}")
  })

  test('other imports are refused', () => {
    expect(() => rewriteImports("import x from 'lodash'\n")).toThrow('the playground supports imports from clarusjs/runtime only')
    expect(() => rewriteImports("import { resource } from 'clarusjs/fetch'\n")).toThrow('the playground supports imports from clarusjs/runtime only')
  })
})

describe('share links', () => {
  test('round trip, unicode and a 10 KB source', async () => {
    for (const source of ['<p>héllo ✓ 你好</p>', '<p>x</p>\n'.repeat(1000)]) {
      const hash = await encode(source)
      expect(hash).toMatch(/^[A-Za-z0-9_-]+$/)
      expect(await decode(hash)).toBe(source)
    }
  })

  test('a source that compresses past 32 KB still round-trips', async () => {
    let n = 1
    const random = Array.from({ length: 60_000 }, () => String.fromCharCode(33 + ((n = (n * 48271) % 2147483647) % 90))).join('')
    expect(await decode(await encode(random))).toBe(random)
  })

  test('anything unreadable decodes to undefined', async () => {
    expect(await decode('')).toBeUndefined()
    expect(await decode('garbage!!')).toBeUndefined()
    expect(await decode('AAAA')).toBeUndefined()
  })
})

describe('frameDoc', () => {
  test('a whole document, the runtime in one module script, </script> in it escaped', async () => {
    const { frameDoc } = await import('../src/repl/frame.ts')
    const doc = frameDoc('const s = "</script><p>x</p>"; console.log(s)')
    expect(doc.startsWith('<!doctype html>')).toBe(true)
    expect(doc).toContain('<meta charset="utf-8">')
    expect(doc).toContain('<div id="out"></div>')
    expect(doc.match(/<\/script>/g)).toHaveLength(1) // only the one closing its own script
    expect(doc).toContain('const s = "<\\/script><p>x</p>"')
  })
})

describe('starters', () => {
  test('counter, todo, form and conditional; each compiles for server and client without warnings', async () => {
    const { starters } = await import('../src/repl/starters.ts')
    const { compile } = await import('clarusjs/compiler')
    expect(starters.map((s) => s.name)).toEqual(['Counter', 'Todo list', 'Form', 'Conditional'])
    for (const s of starters) {
      const server = compile(s.source, { file: 'App.tscl', target: 'server', clientUrl: '/app.js' })
      const client = compile(s.source, { file: 'App.tscl', target: 'client' })
      expect(server.warnings, s.name).toEqual([])
      expect(client.stateful, s.name).toBe(true)
    }
  })
})
