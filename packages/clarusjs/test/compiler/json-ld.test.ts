// JSON-LD: <script type="application/ld+json">{{ value }}</script> writes the value as JSON, safe inside the script.
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { ClarusError } from '../../src/compiler/errors.ts'
import { importCode } from '../helpers.ts'

const err = (src: string) => { try { compile(src, { file: 'x.tscl', target: 'server' }) } catch (e) { return e as ClarusError } throw new Error('expected an error') }

test('one {{ }} hole holding the whole value is written as JSON that cannot end the script', async () => {
  const src = "@input title: string\n<cl-head><script type=\"application/ld+json\">{{ { '@context': 'https://schema.org', '@type': 'Article', headline: title } }}</script></cl-head>\n<p>{{ title }}</p>"
  const { render } = await importCode(compile(src, { file: 'x.tscl', target: 'server' }).code, 'jsonld-1')
  expect(render({ title: 'A </script> & "B"' })).toBe(
    '<cl-head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"A \\u003c/script\\u003e \\u0026 \\"B\\""}</script></cl-head><p>A &lt;/script&gt; &amp; &quot;B&quot;</p>',
  )
})

test('static JSON-LD is written as is; it works anywhere in markup, not only in <cl-head>', async () => {
  const src = '<head><script type="application/ld+json">{"@type": "WebSite", "name": "x"}</script></head>'
  const { render } = await importCode(compile(src, { file: 'x.tscl', target: 'server' }).code, 'jsonld-2')
  expect(render()).toBe('<head><script type="application/ld+json">{"@type": "WebSite", "name": "x"}</script></head>')
})

test('errors: mixed text and holes, bound attributes, and island state', () => {
  expect(err('<script type="application/ld+json">{"name": "{{ x }}"}</script>').message).toMatch(/^x\.tscl:1:\d+ .*JSON-LD.*one \{\{ \}\} hole/)
  expect(err('<script type="application/ld+json" [id]="i">{{ x }}</script>').message).toMatch(/JSON-LD.*static attributes/)
  expect(err('<script>\n  let n = state(0)\n</script>\n<cl-head><script type="application/ld+json">{{ { n } }}</script></cl-head>').message).toMatch(/JSON-LD.*server/)
})
