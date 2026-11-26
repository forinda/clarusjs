// @vitest-environment happy-dom
// A @for whose list in the browser isn't the one the server rendered (it reads something the server can't see: the
// URL, storage). Attaching renders the browser's list instead of adopting rows that don't match it.
import { afterEach, expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { attachAll } from '../../src/runtime/loader.ts'
import { importCode } from '../helpers.ts'

afterEach(() => { document.body.innerHTML = '' })

const src = `<script>
  const all = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]
  let only = state('')
  // The server renders all four; the browser starts from what it knows (here: two), as with ?q= in the URL.
  const shown = derived(() => all.slice(0, globalThis.__seen).filter((x) => !only || x.id === only))
</script>
<ul>@for (x of shown; track x.id) {<li>{{ x.id }}</li>} @empty {<li class="none">none</li>}</ul>
<button (click)="only = 'zz'">none</button>
`
let n = 0
async function mount() {
  const s = await importCode(compile(src, { file: 'x.tscl', target: 'server', clientUrl: '/x.js' }).code, `fad-s-${n}`)
  const c = await importCode(compile(src, { file: 'x.tscl', target: 'client' }).code, `fad-c-${n++}`)
  ;(globalThis as { __seen?: number }).__seen = 4 // what the server sees
  document.body.innerHTML = s.render({})
  ;(globalThis as { __seen?: number }).__seen = 2 // what the browser sees
  const errors: unknown[] = []
  const log = console.error
  console.error = (...a: unknown[]) => { errors.push(a) }
  try { await attachAll(document, async () => c) } finally { console.error = log }
  return errors
}
const items = () => [...document.querySelectorAll('li')].map((l) => l.textContent)

test('fewer items in the browser than the server rendered: attaches, and shows the browser\'s list', async () => {
  expect(await mount()).toEqual([])
  expect(document.querySelector('cl-island')!.hasAttribute('data-cl-ready')).toBe(true)
  expect(items()).toEqual(['a', 'b'])
  ;(document.querySelector('button') as HTMLButtonElement).click()
  expect(items()).toEqual(['none']) // and it keeps working
})
