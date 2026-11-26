// @vitest-environment happy-dom
// #444: (submit.prevent)="…" and the other event modifiers, and $values (a form's fields as an object) in a handler.
// Without JavaScript the form still posts: .prevent is the island's, so it only applies once the handler is wired.
import { afterEach, expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { ClarusError } from '../../src/compiler/errors.ts'
import { attachAll } from '../../src/runtime/loader.ts'
import { importCode } from '../helpers.ts'

afterEach(() => { document.body.innerHTML = '' })

async function mount(src: string, name: string) {
  const s = await importCode(compile(src, { file: 'x.tscl', target: 'server', clientUrl: '/x.js' }).code, name + '-s')
  const c = await importCode(compile(src, { file: 'x.tscl', target: 'client' }).code, name + '-c')
  document.body.innerHTML = s.render({})
  await attachAll(document, async () => c)
  const log = () => document.querySelector('output')!.textContent
  return { log }
}

const submit = (form: HTMLFormElement, submitter?: HTMLElement) => {
  const e = new (globalThis.SubmitEvent ?? Event)('submit', { bubbles: true, cancelable: true, submitter } as SubmitEventInit)
  form.dispatchEvent(e)
  return e
}

test('.prevent stops the submit, and $values has the fields: repeated names as a list, the submitter too', async () => {
  const { log } = await mount(`<script>
  let got = state('')
</script>
<form (submit.prevent)="got = JSON.stringify($values)">
  <input name="email" value="a@b.c">
  <input type="checkbox" name="tag" value="x" checked>
  <input type="checkbox" name="tag" value="y" checked>
  <input type="checkbox" name="tag" value="z">
  <button name="intent" value="save">Save</button>
</form>
<output>{{ got }}</output>
`, 'prevent')
  const form = document.querySelector('form')!
  const e = submit(form, form.querySelector('button')!)
  expect(e.defaultPrevented).toBe(true)
  expect(JSON.parse(log()!)).toEqual({ email: 'a@b.c', tag: ['x', 'y'], intent: 'save' })
})

test('$values from a field inside a form is that form\'s; without .prevent the default is left alone', async () => {
  const { log } = await mount(`<script>
  let got = state('')
</script>
<form>
  <input name="q" value="cats" (input)="got = $values.q">
</form>
<output>{{ got }}</output>
`, 'field')
  const input = document.querySelector('input')!
  const e = new Event('input', { bubbles: true, cancelable: true })
  input.dispatchEvent(e)
  expect(e.defaultPrevented).toBe(false)
  expect(log()).toBe('cats')
})

test('.stop, .self and .once', async () => {
  const { log } = await mount(`<script>
  let n = state('')
</script>
<div class="outer" (click)="n += 'o'">
  <div class="self" (click.self)="n += 's'"><span class="in">in</span></div>
  <button class="stop" (click.stop)="n += 't'">t</button>
  <button class="once" (click.once)="n += '1'">1</button>
</div>
<output>{{ n }}</output>
`, 'mods')
  const click = (sel: string) => (document.querySelector(sel) as HTMLElement).click()
  click('.in') // .self: not from the div itself, so only the outer handler
  expect(log()).toBe('o')
  click('.self')
  expect(log()).toBe('os' + 'o')
  click('.stop') // runs, and the outer handler doesn't
  expect(log()).toBe('oso' + 't')
  click('.once')
  click('.once')
  expect(log()).toBe('osot' + '1o' + 'o')
})

test('keys and system keys: (keydown.enter), (keydown.ctrl.s)', async () => {
  const { log } = await mount(`<script>
  let n = state('')
</script>
<input (keydown.enter)="n += 'e'" (keydown.ctrl.s.prevent)="n += 's'" (keydown.esc)="n += 'x'">
<output>{{ n }}</output>
`, 'keys')
  const input = document.querySelector('input')!
  const key = (key: string, init: KeyboardEventInit = {}) => {
    const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
    input.dispatchEvent(e)
    return e
  }
  key('a')
  key('Enter')
  expect(key('s').defaultPrevented).toBe(false) // without ctrl: neither runs nor prevents
  expect(key('s', { ctrlKey: true }).defaultPrevented).toBe(true)
  key('Escape')
  expect(log()).toBe('esx')
})

test('a modifier that isn\'t one, a key on an event without keys, and modifiers on a component, are located errors', () => {
  const at = (s: string) => { try { compile(s, { file: 'x.tscl', target: 'client' }); return '' } catch (e) { return (e as ClarusError).message } }
  const island = (t: string) => `<script>\n  let n = state(0)\n</script>\n${t}\n`
  expect(at(island('<form (submit.prevnt)="n++"></form>'))).toMatch(/^x\.tscl:4:7 .*unknown modifier \.prevnt.*prevent, stop, self, once/)
  expect(at(island('<button (click.enter)="n++"></button>'))).toMatch(/^x\.tscl:4:9 .*\.enter is a key: for \(keydown\) and \(keyup\)/)
  expect(at("@import c from './c.tscl'\n" + island('<c (rate.prevent)="n++" />'))).toMatch(/^x\.tscl:5:4 .*modifiers are for elements' DOM events/)
})

test('the modifiers stay out of the event type the server marks and the browser listens for', () => {
  const client = compile(island('<form (submit.prevent)="n++"></form>'), { file: 'x.tscl', target: 'client' }).code
  expect(client).toContain('"submit"')
  expect(client).not.toContain('submit.prevent')
  function island(t: string) { return `<script>\n  let n = state(0)\n</script>\n${t}\n` }
})
