// #259: h(): compose views and elements in server code; the result is HTML a template's {{ }} inserts as is.
import { beforeAll, expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { h, registerViews, render } from '../../src/server/views.ts'
import { importCode } from '../helpers.ts'

const view = (source: string, name: string) => async () => importCode(compile(source, { file: `src/components/${name}.tscl`, target: 'server', clientUrl: `/${name}.js` }).code, `h-${name}`, {}, true)
beforeAll(() => {
  registerViews({
    '/src/components/card.tscl': view('@input title: string\n<section class="card"><h2>{{ title }}</h2><slot /><footer><slot name="foot" /></footer></section>', 'card'),
    '/src/components/pill.tscl': view('@input text: string\n<span class="pill">{{ text }}</span>', 'pill'),
  })
})
const unscoped = (s: string) => s.replace(/ class="cl-c-[\w-]+"/g, '').replace(/ cl-c-[\w-]+/g, '')

test('elements: text children escaped, attributes escaped and URL-checked, void elements, nothing for null/false', async () => {
  const out = await h('p', { class: 'lead', title: 'a "b"', 'data-x': 1 }, ['Text <b>is</b> escaped', null, false, 2, h('br'), h('a', { href: 'javascript:alert(1)' }, ['x'])])
  expect(String(out)).toBe('<p class="lead" title="a &quot;b&quot;" data-x="1">Text &lt;b&gt;is&lt;/b&gt; escaped2<br><a href="about:invalid#unsafe">x</a></p>')
})

test('views: props, children in the default slot, named slots, nesting', async () => {
  const out = await h('components/card', { title: '<Hi>' }, { default: [h('components/pill', { text: 'new' })], foot: 'end' })
  expect(unscoped(String(out))).toBe('<section class="card"><h2>&lt;Hi&gt;</h2><span class="pill">new</span><footer>end</footer></section>')
  const plain = await h('components/card', { title: 'T' }, ['body'])
  expect(unscoped(String(plain))).toContain('<h2>T</h2>body<footer></footer>')
})

test('refused: on* attributes, srcdoc, and tags that load or run things; a bad tag or attribute name', async () => {
  await expect(h('div', { onclick: 'x()' })).rejects.toThrow(/h\(\): "onclick"/)
  await expect(h('div', { srcdoc: 'x' })).rejects.toThrow(/h\(\): "srcdoc"/)
  for (const tag of ['script', 'style', 'iframe', 'object', 'embed', 'base', 'link', 'meta']) await expect(h(tag)).rejects.toThrow(/h\(\): <[a-z]+>/)
  await expect(h('div x', {})).rejects.toThrow(/h\(\): "div x" isn't a tag/)
  await expect(h('div', { 'a"b': 1 })).rejects.toThrow(/h\(\): "a"b" isn't an attribute name/)
  await expect(h('components/missing')).rejects.toThrow(/no view "components\/missing"/)
})

test('a template inserts h() output as HTML; any other value is escaped as before; in an attribute it\'s text', async () => {
  const page = compile('@input block: any\n@input text: string\n<main title="{{ block }}">{{ block }}{{ text }}</main>', { file: 'src/pages/x.tscl', target: 'server' })
  const { render } = await importCode(page.code, 'h-page')
  const block = await h('b', {}, ['bold'])
  expect(render({ block, text: '<b>not bold</b>' })).toBe('<main title="&lt;b&gt;bold&lt;/b&gt;"><b>bold</b>&lt;b&gt;not bold&lt;/b&gt;</main>')
})

test('JSON can\'t forge h() output (an island prop arrives as data, escaped)', async () => {
  const forged = JSON.parse('{"html":"<script>x</script>"}')
  const page = compile('@input block: any\n<main>{{ block }}</main>', { file: 'src/pages/y.tscl', target: 'server' })
  const { render } = await importCode(page.code, 'h-forge')
  expect(render({ block: forged })).toBe('<main>[object Object]</main>')
  expect(render({ block: JSON.parse(JSON.stringify(await h('b', {}, ['x']))) })).not.toContain('<b>')
})

test('#430: a view that awaits in its <script server> (an async render) is awaited, by h() and render()', async () => {
  registerViews({ '/src/components/slow.tscl': async () => ({ render: async (p: { text: string }) => { await new Promise((r) => setTimeout(r, 5)); return `<i>${p.text}</i>` } }) })
  expect(String(await h('components/slow', { text: 'late' }))).toBe('<i>late</i>')
  expect(await render('components/slow' as never, { text: 'late' } as never)).toBe('<i>late</i>')
})

test('review (#653): each handler\'s h() uses its own base, even with two handlers in one process and requests overlapping', async () => {
  const { createHandler } = await import('../../src/server/handler.ts')
  let release!: () => void
  const wait = new Promise<void>((r) => { release = r })
  const site = (base: string, slow: boolean) => createHandler(
    { '/src/pages/index.tscl': async () => ({ render: (p: { link?: unknown } = {}) => `<p>${p.link}</p>` }) },
    { base, data: { '/src/pages/index.load.ts': async () => ({ load: async () => { if (slow) await wait; return { link: await h('a', { href: '/guide' }) } } }) } },
  )
  const a = site('/a/', true)
  const b = site('/b/', false)
  const first = a.fetch(new Request('http://x/'))
  const second = await (await b.fetch(new Request('http://x/'))).text()
  release()
  expect(second).toContain('href="/b/guide"')
  expect(await (await first).text()).toContain('href="/a/guide"')
})
