// @vitest-environment happy-dom
// Attaching an island whose @for has many rows: wiring a row looks only inside that row, so the work grows with the
// rows, not with their square. Counted (DOM steps and position checks), not timed.
import { afterEach, expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { attachAll } from '../../src/runtime/loader.ts'
import { importCode } from '../helpers.ts'

afterEach(() => { document.body.innerHTML = '' })

const src = (rows: number) => `<script>
  let rows = state(Array.from({ length: ${rows} }, (_, i) => ({ name: 'r' + i, n: i })))
</script>
<ul>
  @for (row of rows; track $index) {
    <li><input class="name" [(value)]="rows[$index].name"> <b>{{ row.n }}</b> <button (click)="rows = rows.filter((_, i) => i !== $index)">x</button></li>
  }
</ul>
`

/** DOM work during `fn`: sibling and child steps, and compareDocumentPosition calls. */
async function work(fn: () => Promise<void>): Promise<number> {
  // Where the DOM defines them: walk up from a real node (the global Node may be another class).
  const definer = (name: string) => {
    let o: object | null = document.createComment('')
    while (o && !Object.getOwnPropertyDescriptor(o, name)) o = Object.getPrototypeOf(o)
    return o!
  }
  let n = 0
  const undo: (() => void)[] = []
  for (const name of ['nextSibling', 'firstChild', 'compareDocumentPosition']) {
    const o = definer(name)
    const d = Object.getOwnPropertyDescriptor(o, name)!
    Object.defineProperty(o, name, d.get
      ? { ...d, get() { n++; return d.get!.call(this) } }
      : { ...d, value(this: Node, ...args: unknown[]) { n++; return d.value.apply(this, args) } })
    undo.push(() => Object.defineProperty(o, name, d))
  }
  try { await fn() } finally { for (const u of undo) u() }
  return n
}

async function attachCost(rows: number, name: string) {
  const code = src(rows)
  const s = await importCode(compile(code, { file: 'x.tscl', target: 'server', clientUrl: '/x.js' }).code, name + '-s')
  const c = await importCode(compile(code, { file: 'x.tscl', target: 'client' }).code, name + '-c')
  document.body.innerHTML = s.render({})
  return work(() => attachAll(document, async () => c))
}

test('attaching 4 times the rows costs about 4 times the DOM work, not 16', async () => {
  const small = await attachCost(50, 'scale50')
  document.body.innerHTML = ''
  const big = await attachCost(200, 'scale200')
  expect(document.querySelectorAll('li[data-cl-a], li').length).toBe(200)
  expect(big / small).toBeLessThan(6)
}, 60_000)
