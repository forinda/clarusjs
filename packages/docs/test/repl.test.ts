// #243: the playground's pure building blocks.
import { describe, expect, test } from 'vitest'
import { highlightTscl } from '../src/repl/highlight.ts'
import { prepare } from '../src/repl/prepare.ts'
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

  test('time grows linearly with a long line (it was quadratic: 4x the line took 16x the time)', () => {
    const time = (n: number) => {
      const line = '<p class="a">' + 'word '.repeat(n) + '</p>'
      highlightTscl(line) // warm up
      const t = performance.now()
      for (let i = 0; i < 3; i++) highlightTscl(line)
      return performance.now() - t
    }
    expect(time(40_000) / time(10_000)).toBeLessThan(8)
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

describe('prepare (the page, before posting to the frame)', () => {
  const run = async (code: string) => import('data:text/javascript;base64,' + Buffer.from(prepare(code)).toString('base64'))

  test('the server and client imports compile() prints, aliases kept', () => {
    const server = "import { escape as __cl_escape, island as __cl_island } from 'clarusjs/runtime/server'\nexport function render() {}"
    expect(prepare(server)).toBe("const { escape: __cl_escape, island: __cl_island } = globalThis.__cl_repl['clarusjs/runtime/server']\nexport function render() {}")
    const client = "import { state, holes as __cl_holes } from 'clarusjs/runtime'\nexport function attach() {}"
    expect(prepare(client)).toBe("const { state, holes: __cl_holes } = globalThis.__cl_repl['clarusjs/runtime']\nexport function attach() {}")
  })

  test('double quotes and multi-line imports (copied as written from the script)', () => {
    expect(prepare('import { onDispose } from "clarusjs/runtime"\n')).toBe("const { onDispose } = globalThis.__cl_repl['clarusjs/runtime']\n")
    expect(prepare("import {\n  onDispose,\n  effect as fx,\n} from 'clarusjs/runtime'\n")).toBe("const { onDispose, effect: fx } = globalThis.__cl_repl['clarusjs/runtime']\n")
  })

  test('a line inside a string that looks like an import is left alone', () => {
    const code = "export const s = `\nimport { x } from 'lodash'\n`\n"
    expect(prepare(code)).toBe(code)
  })

  test('other imports are refused, naming the module', () => {
    expect(() => prepare("import x from 'lodash'\n")).toThrow("the playground supports imports from clarusjs/runtime only, not 'lodash'")
    expect(() => prepare("import { resource } from 'clarusjs/fetch'\n")).toThrow("not 'clarusjs/fetch'")
    expect(() => prepare("import * as r from 'clarusjs/runtime'\n")).toThrow('import { … } from')
  })

  test('a loop that runs too long throws instead of hanging the page', async () => {
    const mod = await run('export function spin() { let i = 0; while (true) { i++ } }\nexport function bare() { for (;;) void 0 }\nexport function doer() { do {} while (true) }')
    const t = Date.now()
    expect(() => mod.spin()).toThrow(/a loop ran for more than 1 second/)
    expect(() => mod.bare()).toThrow(/a loop ran for more than 1 second/)
    expect(() => mod.doer()).toThrow(/a loop ran for more than 1 second/)
    expect(Date.now() - t).toBeLessThan(5000)
  })

  test('guarded loops still work: labels, continue, break, for-of, nested', async () => {
    const mod = await run('export function f() { let n = 0\n outer: for (let i = 0; i < 3; i++) { for (const j of [1, 2, 3]) { if (j === 2) continue outer; n += j } }\n while (n < 10) n++\n if (n) for (let k = 0; k < 2; k++) n++\n return n }')
    expect(mod.f()).toBe(12)
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

  test('a hash that inflates past 256 KB, or is very long, decodes to undefined (no memory blow-up)', async () => {
    expect(await decode(await encode('x'.repeat(300_000)))).toBeUndefined()
    expect(await decode('A'.repeat(200_001))).toBeUndefined()
    expect(await decode(await encode('x'.repeat(200_000)))).toHaveLength(200_000)
  })

  test('anything unreadable decodes to undefined', async () => {
    expect(await decode('')).toBeUndefined()
    expect(await decode('garbage!!')).toBeUndefined()
    expect(await decode('AAAA')).toBeUndefined()
  })
})

describe('frameDoc', () => {
  test('a whole document, the runtime as one module script from a data: URL', async () => {
    const { frameDoc } = await import('../src/repl/frame.ts')
    const doc = frameDoc('const s = "</script><p>x</p>"; console.log(s)')
    expect(doc.startsWith('<!doctype html>')).toBe(true)
    expect(doc).toContain('<meta charset="utf-8">')
    expect(doc).toContain('<div id="out"></div>')
    // The runtime isn't inlined (no HTML parsing of it at all): it's the module script's data: URL.
    expect(doc).not.toContain('</script><p>x</p>')
    const src = /<script type="module" src="data:text\/javascript;base64,([^"]+)"><\/script>/.exec(doc)![1]!
    expect(new TextDecoder().decode(Uint8Array.from(atob(src), (c) => c.charCodeAt(0)))).toBe('const s = "</script><p>x</p>"; console.log(s)')
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
