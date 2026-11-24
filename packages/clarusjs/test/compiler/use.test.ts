// @vitest-environment happy-dom
// #464: [use]="behaviour" on an element in an island: the browser calls behaviour(element) once the island attaches,
// and the function it returns when the branch, row or island goes. Behaviours (clarusjs/ui-primitives) are DOM
// functions; this is how a template hands them its elements.
import { afterEach, expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { ClarusError } from '../../src/compiler/errors.ts'
import { attachAll } from '../../src/runtime/loader.ts'
import { importCode } from '../helpers.ts'

afterEach(() => { document.body.innerHTML = '' })
const log: string[] = []
;(globalThis as { __useLog?: string[] }).__useLog = log

const src = `<script>
  let open = state(true)
  let items = state(['a', 'b'])
  const tag = (name) => (el) => {
    globalThis.__useLog.push('on ' + name + ' ' + el.tagName)
    return () => globalThis.__useLog.push('off ' + name)
  }
</script>
<div [use]="tag('root')">
  <button class="toggle" (click)="open = !open">t</button>
  @if (open) { <p [use]="[tag('p1'), tag('p2')]">p</p> }
  @for (i of items; track i) { <li [use]="tag('li ' + i)">{{ i }}</li> }
  <button class="drop" (click)="items = ['b']">d</button>
</div>
`

test('the server marks the element only; the browser calls the behaviour with it, and its dispose on removal', async () => {
  const server = compile(src, { file: 'x.tscl', target: 'server', clientUrl: '/x.js' }).code
  expect(server).toContain('data-cl-u=\\"0\\"')
  expect(server).not.toContain('tag(')
  const s = await importCode(server, 'use-s')
  const c = await importCode(compile(src, { file: 'x.tscl', target: 'client' }).code, 'use-c')
  log.length = 0
  document.body.innerHTML = s.render({})
  await attachAll(document, async () => c)
  expect(log).toEqual(['on root DIV', 'on p1 P', 'on p2 P', 'on li a LI', 'on li b LI'])
  log.length = 0
  ;(document.querySelector('.toggle') as HTMLElement).click()
  expect(log).toEqual(['off p2', 'off p1']) // last attached, first disposed
  log.length = 0
  ;(document.querySelector('.toggle') as HTMLElement).click()
  expect(log).toEqual(['on p1 P', 'on p2 P'])
  log.length = 0
  ;(document.querySelector('.drop') as HTMLElement).click()
  expect(log).toEqual(['off li a'])
})

test('[use] needs an island, and is for elements', () => {
  const at = (s: string) => { try { compile(s, { file: 'x.tscl', target: 'client' }); return '' } catch (e) { return (e as ClarusError).message } }
  expect(at('<div [use]="f"></div>\n')).toMatch(/^x\.tscl:1:6 .*\[use\] needs a <script>/)
  expect(at("@import c from './c.tscl'\n<script>\n  let f = () => {}\n</script>\n<c [use]=\"f\" />\n")).toMatch(/^x\.tscl:5:4 .*\[use\] is for elements/)
})
