// @vitest-environment happy-dom
// #279: class="…" on a component tag passes through to the component's top-level elements, merged with theirs, so
// a parent's <style scoped> can style it by that class. Islands keep it when they re-render a block in the browser.
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { ClarusError } from '../../src/compiler/errors.ts'
import { parse as parseProps } from '../../src/runtime/serialize.ts'
import { importCode } from '../helpers.ts'

const child = '<section class="card"><slot /></section>\n<p>two</p>\n'
const server = (source: string, file: string, scope: string) => compile(source, { file, target: 'server', clientUrl: '/c.js', scope }).code

test('a static class on a component tag lands on its top-level elements, after their own and the scope class', async () => {
  const parent = "@import card from './card.tscl'\n<card class=\"wide\">x</card><card>y</card>\n"
  const { render } = await importCode(server(parent, 'p.tscl', 'p-1'), 'pass-p', { './card.tscl': server(child, 'card.tscl', 'card-1') }, true)
  expect(render()).toBe('<section class="card cl-c-card-1 wide">x</section><p class="cl-c-card-1 wide">two</p><section class="card cl-c-card-1">y</section><p class="cl-c-card-1">two</p>')
})

test('the class is escaped as an attribute value', async () => {
  const { render } = await importCode(server(child, 'card.tscl', 'card-1'), 'pass-esc', {}, true)
  expect(render({}, { default: '' }, { class: 'a" onclick="x' })).toContain('class="card cl-c-card-1 a&quot; onclick=&quot;x"')
})

test('an island carries the class to the browser, which keeps it when it re-renders a top-level block', async () => {
  const island = '<script>\n  let on = state(true)\n</script>\n@if (on) { <b (click)="on = false">on</b> } @else { <i (click)="on = true">off</i> }\n'
  const s = await importCode(server(island, 'x.tscl', 'x-1'), 'pass-is', {}, true)
  const c = await importCode(compile(island, { file: 'x.tscl', target: 'client', scope: 'x-1' }).code, 'pass-ic')
  document.body.innerHTML = s.render({}, undefined, { class: 'wide' })
  const root = document.querySelector('cl-island')!
  expect(root.querySelector('b')!.className).toBe('cl-c-x-1 wide')
  c.attach(root, parseProps(root.getAttribute('p')!))
  ;(root.querySelector('b') as HTMLElement).click()
  expect(root.querySelector('i')!.className).toBe('cl-c-x-1 wide')
})

test('only a static class: one with {{ }} or a [class] binding on a component tag is a located error', () => {
  for (const tag of ['<card class="a {{ x }}" />', '<card [class]="x" />']) {
    let err: unknown
    try { compile(`@import card from './card.tscl'\n@input x: string\n${tag}\n`, { file: 'p.tscl', target: 'server' }) } catch (e) { err = e }
    expect(err, tag).toBeInstanceOf(ClarusError)
    expect((err as ClarusError).message, tag).toMatch(/^p\.tscl:3:7 a component takes a static class="…" only/)
  }
})
