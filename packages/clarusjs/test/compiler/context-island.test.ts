// @vitest-environment happy-dom
// #465: an island provides context from its state; children it re-renders in the browser read the current values.
import { afterEach, expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { attachAll } from '../../src/runtime/loader.ts'
import { importCode } from '../helpers.ts'

afterEach(() => { document.body.innerHTML = '' })

const show = '@input n: string\n@context pick: { on: string }\n<p class="out">{{ n }}/{{ pick.on }}</p>\n'
const island = "@import show from './show.tscl'\n<script>\n  let on = state('a')\n  provide('pick', { on })\n</script>\n<button (click)=\"on = 'b'\">x</button>\n<show [n]=\"on\" />\n"

test('a child the island re-renders in the browser reads the context the island provides now', async () => {
  const showServer = compile(show, { file: 'show.tscl', target: 'server', clientUrl: '/show.js' }).code
  const s = await importCode(compile(island, { file: 'i.tscl', target: 'server', clientUrl: '/i.js' }).code, 'cxi-s', { './show.tscl': showServer })
  const c = await importCode(compile(island, { file: 'i.tscl', target: 'client' }).code, 'cxi-c', { './show.tscl?render': showServer })
  document.body.innerHTML = s.render({})
  expect(document.querySelector('.out')!.textContent).toBe('a/a')
  await attachAll(document, async () => c)
  ;(document.querySelector('button') as HTMLElement).click()
  expect(document.querySelector('.out')!.textContent).toBe('b/b')
})
