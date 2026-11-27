// @vitest-environment happy-dom
// compile(source, { base }): root-relative URL attributes get Vite's base. Static ones at compile time; dynamic ones
// through the shared helper, so islands (and rows they render in the browser) keep it; base '/' changes nothing.
import { afterEach, expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { importCode } from '../helpers.ts'

afterEach(() => { document.body.innerHTML = '' })
const base = '/docs/'
const server = async (src: string, props = {}, id = 'b') => (await importCode(compile(src, { file: 'x.tscl', target: 'server', clientUrl: '/x.js', base }).code, `base-s-${id}`)).render(props)
const urls = (html: string) => [...html.matchAll(/\s(href|src|srcset|action)="([^"]*)"/g)].map((m) => `${m[1]}=${m[2]}`)

test('static URL attributes are written with the base; full URLs, //, #, ?, relative and data-* are not', async () => {
  const html = await server('<p><a href="/guide">a</a><a href="https://x.dev">b</a><a href="//cdn.x/a">c</a><a href="#top">d</a><a href="?q=1">e</a><a href="rel">f</a><img src="/logo.svg" srcset="/a.png 1x, /b.png 2x" alt=""><form action="/search"></form><span data-href="/x">/x</span></p>', {}, 'static')
  expect(urls(html)).toEqual(['href=/docs/guide', 'href=https://x.dev', 'href=//cdn.x/a', 'href=#top', 'href=?q=1', 'href=rel', 'src=/docs/logo.svg', 'srcset=/docs/a.png 1x, /docs/b.png 2x', 'action=/docs/search'])
  expect(html).toContain('data-href="/x">/x</span>')
})

test('an interpolated or bound URL gets the base once; a full URL from data stays as it is', async () => {
  const html = await server('@input slug: string = \'\'\n@input url: string = \'\'\n<p><a href="/p/{{ slug }}">a</a><a [href]="url">b</a></p>', { slug: '7', url: 'https://x.dev/a' }, 'dyn')
  expect(urls(html)).toEqual(['href=/docs/p/7', 'href=https://x.dev/a'])
  const route = await server('@input url: string = \'\'\n<a [href]="url">x</a>', { url: '/guide/intro' }, 'route')
  expect(urls(route)).toEqual(['href=/docs/guide/intro'])
  // a URL already under the base (href() from clarusjs/navigation gives one) is left as it is
  const made = await server('@input url: string = \'\'\n<a [href]="url">x</a><a href="/docs/written">y</a>', { url: '/docs/guide' }, 'made')
  expect(urls(made)).toEqual(['href=/docs/guide', 'href=/docs/written'])
})

test('in an island: the base stays after attach, after a change, and in rows the browser adds', async () => {
  const src = `<script>
  let next = state('/a')
  let rows = state([{ url: '/r1' }])
</script>
<div><a class="n" [href]="next">n</a>
@for (r of rows; track r.url) { <a class="r" [href]="r.url">r</a> }
<button (click)="next = '/b'; rows = [...rows, { url: '/r2' }]">go</button></div>`
  const s = await importCode(compile(src, { file: 'i.tscl', target: 'server', clientUrl: '/i.js', base }).code, 'base-is')
  const c = await importCode(compile(src, { file: 'i.tscl', target: 'client', base }).code, 'base-ic')
  document.body.innerHTML = s.render({})
  c.attach(document.querySelector('cl-island')!, {})
  const hrefs = () => [...document.querySelectorAll('a')].map((a) => a.getAttribute('href'))
  expect(hrefs()).toEqual(['/docs/a', '/docs/r1'])
  document.querySelector('button')!.click()
  await new Promise((r) => setTimeout(r, 0))
  expect(hrefs()).toEqual(['/docs/b', '/docs/r1', '/docs/r2'])
})

test('base / compiles exactly as no base does', () => {
  const src = '@input u: string = \'\'\n<script>let x = state(\'/a\')</script>\n<a href="/g" [title]="x">{{ x }}</a><a [href]="u">u</a>'
  for (const target of ['server', 'client'] as const) {
    expect(compile(src, { file: 'x.tscl', target, clientUrl: '/x.js', base: '/' }).code).toBe(compile(src, { file: 'x.tscl', target, clientUrl: '/x.js' }).code)
  }
})

test('review: attributes a component passes on to its root element (a link component\'s href), and spreads, get the base', async () => {
  // a component that stands for an element (@extends a) passes every attribute on to it
  const btn = '@extends a\n<a class="btn"><slot /></a>'
  const deps = { './btn.tscl': compile(btn, { file: 'btn.tscl', target: 'server', base }).code }
  const page = await importCode(compile('@import linkButton from \'./btn.tscl\'\n<p><linkButton href="/x">go</linkButton><linkButton href="https://away.dev">away</linkButton></p>', { file: 'p.tscl', target: 'server', base }).code, 'base-passed', deps)
  expect(urls(await page.render({}))).toEqual(['href=/docs/x', 'href=https://away.dev'])
  const spread = await server('@input link: any = {}\n<a [...]="link">s</a>', { link: { href: '/y', title: '/not-a-url' } }, 'spread')
  expect(urls(spread)).toEqual(['href=/docs/y'])
  expect(spread).toContain('title="/not-a-url"')
})
