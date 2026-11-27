// The server side: validate a submitted value against the schema (the safety boundary), and render it to HTML, with
// no DOM view. An 'html' value is parsed with ProseMirror's own parser over linkedom.
import { expect, test } from 'vitest'
import { base } from '../src/extensions/base.ts'
import { defineExtension } from '../src/core/extension.ts'
import { length, renderHTML, validate } from '../src/server.ts'

const doc = (...paragraphs: unknown[][]) => ({ type: 'doc', content: paragraphs.map((content) => ({ type: 'paragraph', content })) })
const text = (t: string, marks?: unknown[]) => ({ type: 'text', text: t, ...(marks ? { marks } : {}) })
// A link mark, enough to test URL checks here (the real one comes with the composer's extensions).
const link = defineExtension({ name: 'link', marks: { link: { attrs: { href: {} }, inclusive: false, parseDOM: [{ tag: 'a[href]', getAttrs: (el) => ({ href: (el as HTMLElement).getAttribute('href') }) }], render: (m) => ['a', { href: m.attrs.href }, 0] } } })

test('a valid JSON document passes, as its checked JSON', () => {
  const result = validate(doc([text('Hi')]), [base])
  expect(result).toEqual({ ok: true, doc: doc([text('Hi')]) })
})

test('a node the schema lacks, or content where it isn\'t allowed, fails', () => {
  expect(validate({ type: 'doc', content: [{ type: 'heading', content: [] }] }, [base])).toEqual({ ok: false, error: expect.stringMatching(/unknown node type: heading/i) })
  expect(validate({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'paragraph' }] }] }, [base]).ok).toBe(false)
  expect(validate('not json', [base]).ok).toBe(false)
})

test('an html value is parsed into the schema: what it allows stays, a script is gone', () => {
  const result = validate('<p>Hi <script>alert(1)</script><b>there</b></p>', [base], { format: 'html' })
  expect(result).toEqual({ ok: true, doc: doc([text('Hi there')]) }) // no bold in base: the b is dropped, its text kept
})

test('length counts graphemes, the server as the browser does: a family emoji is one', () => {
  expect(length(doc([text('👨‍👩‍👧ab')]))).toBe(3)
  expect(validate(doc([text('👨‍👩‍👧ab')]), [base], { maxLength: 3 }).ok).toBe(true)
  expect(validate(doc([text('👨‍👩‍👧abc')]), [base], { maxLength: 3 })).toEqual({ ok: false, error: 'too long: 4 of 3' })
  expect(length(doc([text('ab')], [text('c')]))).toBe(4) // a new paragraph counts as one line break
})

test('a URL that isn\'t safe is rejected, from JSON or HTML', () => {
  const bad = doc([text('x', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }])])
  expect(validate(bad, [base, link])).toEqual({ ok: false, error: 'unsafe URL: javascript:alert(1)' })
  expect(validate('<p><a href="javascript:alert(1)">x</a></p>', [base, link], { format: 'html' }).ok).toBe(false)
  expect(validate(doc([text('x', [{ type: 'link', attrs: { href: '/ok' } }])]), [base, link]).ok).toBe(true)
})

test('renderHTML escapes text and attributes, and renders marks and breaks', () => {
  expect(renderHTML(doc([text('<b>&')]), [base])).toBe('<p>&lt;b&gt;&amp;</p>')
  expect(renderHTML(doc([text('go', [{ type: 'link', attrs: { href: '/a?x="1"&y' } }]), { type: 'hard_break' }, text('on')]), [base, link])).toBe('<p><a href="/a?x=&quot;1&quot;&amp;y">go</a><br>on</p>')
  expect(renderHTML('<p>From <i>html</i></p>', [base], { format: 'html' })).toBe('<p>From html</p>')
})

test('URL checks follow what is rendered: any attribute name, the real tag, and values that aren\'t strings', () => {
  // an attribute not called href, rendered as an image's src
  const picture = defineExtension({ name: 'picture', nodes: { picture: { attrs: { url: {} }, inline: true, group: 'inline', render: (n) => ['img', { src: n.attrs.url }] } } })
  const pic = (url: unknown) => doc([{ type: 'picture', attrs: { url } }])
  expect(validate(pic('javascript:alert(1)'), [base, picture])).toEqual({ ok: false, error: 'unsafe URL: javascript:alert(1)' })
  expect(validate(pic('/a.png'), [base, picture]).ok).toBe(true)
  // an href that is an array or an object (type confusion), never a string
  const bad = (href: unknown) => doc([text('x', [{ type: 'link', attrs: { href } }])])
  expect(validate(bad(['javascript:alert(1)']), [base, link])).toEqual({ ok: false, error: 'invalid attribute: href' })
  expect(validate(bad({ toString: () => 'javascript:alert(1)' }), [base, link])).toEqual({ ok: false, error: 'invalid attribute: href' })
})

test("format 'text': plain text, as a textarea posts it (blank lines make paragraphs, a line break a hard break)", () => {
  expect(validate('a\n\nb\nc', [base], { format: 'text' })).toEqual({ ok: true, doc: doc([text('a')], [text('b'), { type: 'hard_break' }, text('c')]) })
  expect(renderHTML('<b>x</b>', [base], { format: 'text' })).toBe('<p>&lt;b&gt;x&lt;/b&gt;</p>')
  expect(validate('abcd', [base], { format: 'text', maxLength: 3 }).ok).toBe(false)
})
