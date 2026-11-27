// @vitest-environment happy-dom
// The content behaviour: a value shown as the editor shows it (marks, code, mentions, links), in the browser, through
// the schema (so nothing it doesn't allow) and with URLs checked; a value that isn't a document shows nothing.
import { afterEach, expect, test } from 'vitest'
import { content } from '../src/behaviours/content.ts'
import { composerExtensions } from '../src/extensions/composer.ts'

afterEach(() => { document.body.innerHTML = '' })
const el = () => { const d = document.createElement('div'); document.body.append(d); return d }
const exts = composerExtensions()

test('a JSON value renders with its formatting; HTML too, through the schema', () => {
  const json = { type: 'doc', content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'bold', marks: [{ type: 'strong' }] }, { type: 'hard_break' }, { type: 'mention', attrs: { id: 'u1', label: 'Mara' } }] },
    { type: 'code_block', content: [{ type: 'text', text: 'a\nb' }] },
  ] }
  const a = el()
  content(a, { value: json, format: 'json', extensions: exts })
  expect(a.innerHTML).toBe('<p><strong>bold</strong><br><span data-mention="u1">@Mara</span></p><pre><code>a\nb</code></pre>')
  const b = el()
  content(b, { value: '<p>x<script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">y</a></p>', format: 'html', extensions: exts })
  expect(b.innerHTML).toBe('<p>xy</p>')
})

test('an unsafe href stored in JSON renders as nothing harmful; a value that is not a document renders nothing', () => {
  const a = el()
  content(a, { value: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'z', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] }, format: 'json', extensions: exts })
  expect(a.textContent).toBe('z')
  expect(a.innerHTML).not.toContain('javascript')
  const b = el()
  const stop = content(b, { value: '{nope', format: 'json', extensions: exts })
  expect(b.innerHTML).toBe('')
  stop()
})
