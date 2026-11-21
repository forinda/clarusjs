// @vitest-environment happy-dom
// #307: collapseWhitespace (on at `vite build`): each run of HTML whitespace in template text becomes one character,
// a newline if it had one. Pages look the same; formatted source doesn't bloat the HTML.
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { importCode } from '../helpers.ts'

const render = async (source: string, collapseWhitespace?: boolean) =>
  (await importCode(compile(source, { file: 'x.tscl', target: 'server', clientUrl: '/x', collapseWhitespace }).code, 'ws')).render({}) as string

test('runs of whitespace in text become one character (a newline if the run had one)', async () => {
  const src = '<section>\n    <p>\n      Hello   there,\n      friend\n    </p>\t\t<b>x</b>\n</section>\n'
  expect(await render(src, true)).toBe('<section>\n<p>\nHello there,\nfriend\n</p> <b>x</b>\n</section>')
})

test('off by default: text as written', async () => {
  expect(await render('<p>\n    a    b\n</p>')).toBe('<p>\n    a    b\n</p>')
})

test('untouched: <pre>, <textarea>, inline <script>, verbatim, a non-breaking space, and {{ }} values', async () => {
  const src = [
    '<pre>\n  keep   this\n    indented</pre>',
    '<textarea>\n  a   b</textarea>',
    '<script inline>\n  if (a)   b()\n</script>',
    '<code verbatim>  {{ raw }}   x</code>',
    '<p>a   b</p>',
    "<p>{{ '  spaced   value  ' }}</p>",
  ].join('\n')
  const out = await render(src, true)
  expect(out).toContain('<pre>\n  keep   this\n    indented</pre>')
  expect(out).toContain('<textarea>\n  a   b</textarea>')
  expect(out).toContain('<script>\n  if (a)   b()\n</script>')
  expect(out).toContain('<code>  {{ raw }}   x</code>')
  expect(out).toContain('<p>a   b</p>')
  expect(out).toContain('  spaced   value  ')
})

test('an island: the browser renders a branch collapsed too, matching the server', async () => {
  const src = '<script>\nlet open = state(false)\n</script>\n<div>\n  <button (click)="open = !open">t</button>\n  @if (open) {\n    <p>\n      shown    now\n    </p>\n  }\n</div>'
  const server = compile(src, { file: 'x.tscl', target: 'server', clientUrl: '/x', collapseWhitespace: true }).code
  const client = compile(src, { file: 'x.tscl', target: 'client', collapseWhitespace: true }).code
  expect(client).not.toMatch(/shown {2,}now/)
  const s = await importCode(server, 'ws-s')
  const c = await importCode(client, 'ws-c')
  document.body.innerHTML = s.render({})
  const island = document.querySelector('cl-island')!
  c.attach(island, {})
  island.querySelector('button')!.click()
  expect(island.querySelector('p')!.textContent).toBe('\nshown now\n')
})
