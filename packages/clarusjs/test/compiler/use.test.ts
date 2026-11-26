// @vitest-environment happy-dom
// #464: [use]="behaviour" on an element in an island: the browser calls behaviour(element) once the island attaches,
// and the function it returns when the branch, row or island goes. Behaviours (clarusjs/ui-primitives) are DOM
// functions; this is how a template hands them its elements.
import { afterEach, expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { ClarusError } from '../../src/compiler/errors.ts'
import { attachAll } from '../../src/runtime/loader.ts'
import { importCode } from '../helpers.ts'

afterEach(() => {
  document.body.innerHTML = ''
})
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
  const at = (s: string) => {
    try {
      compile(s, { file: 'x.tscl', target: 'client' })
      return ''
    } catch (e) {
      return (e as ClarusError).message
    }
  }
  expect(at('<div [use]="f"></div>\n')).toMatch(/^x\.tscl:1:6 .*\[use\] needs a <script>/)
  expect(at('@import c from \'./c.tscl\'\n<script>\n  let f = () => {}\n</script>\n<c [use]="f" />\n')).toMatch(
    /^x\.tscl:5:4 .*\[use\] is for elements/,
  )
})

// #550: a behaviour that changes a @for's list while the island attaches (state from the URL, say). It ran before the
// @for adopted the server's rows, which were then paired with the changed list: a shorter list crashed the attach
// ("reading 'name'" on a missing item), a reordered one silently showed rows against the wrong items.
const changing = (change: string) => `<script>
  let items = state([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }])
  const wire = () => { items = ${change} }
</script>
<ul [use]="wire">
  @for (i of items; track i.id) { <li>{{ i.name }}</li> }
</ul>
`
async function attachChanging(change: string) {
  const source = changing(change)
  const s = await importCode(compile(source, { file: 'w.tscl', target: 'server', clientUrl: '/w.js' }).code, 'use-w-s')
  const c = await importCode(compile(source, { file: 'w.tscl', target: 'client' }).code, 'use-w-c')
  document.body.innerHTML = s.render({})
  await attachAll(document, async () => c)
  return {
    island: document.querySelector('cl-island')!,
    rows: () => [...document.querySelectorAll('li')].map((li) => li.textContent),
  }
}

test("#550: a behaviour that shortens a @for's list during attach: the island attaches and shows the new list", async () => {
  const { island, rows } = await attachChanging("items.filter((i) => i.id !== 'b')")
  expect(island.hasAttribute('data-cl-error')).toBe(false)
  expect(island.hasAttribute('data-cl-ready')).toBe(true)
  expect(rows()).toEqual(['A', 'C'])
})

test('#550: a behaviour that reorders the list during attach: rows follow their items, not their old places', async () => {
  const { rows } = await attachChanging('[...items].reverse()')
  expect(rows()).toEqual(['C', 'B', 'A'])
})
