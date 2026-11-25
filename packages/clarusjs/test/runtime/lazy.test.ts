// @vitest-environment happy-dom
// #17: lazy attach (idle / visible / interaction) and replay of events that happen before attach.
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { ClarusError } from '../../src/compiler/errors.ts'
import { attachAll } from '../../src/runtime/loader.ts'
import { importCode } from '../helpers.ts'

const counterSrc = readFileSync(`${import.meta.dirname}/../fixtures/counter.tscl`, 'utf8')
const formSrc = `<script>let sent = state(0)</script>
<form (submit)="$event.preventDefault(); sent++"><input name="q"><button type="submit">go</button></form><p class="sent">{{ sent }}</p>`

async function page(pageSrc: string) {
  const deps = {
    './counter.tscl': compile(counterSrc, { file: 'counter.tscl', target: 'server', clientUrl: '/counter.js' }).code,
    './form.tscl': compile(formSrc, { file: 'form.tscl', target: 'server', clientUrl: '/form.js' }).code,
  }
  const { render } = await importCode(compile(pageSrc, { file: 'page.tscl', target: 'server' }).code, 'lazy-page', deps)
  document.body.innerHTML = render()
  return {
    counter: await importCode(compile(counterSrc, { file: 'counter.tscl', target: 'client' }).code, 'lazy-counter'),
    form: await importCode(compile(formSrc, { file: 'form.tscl', target: 'client' }).code, 'lazy-form'),
  }
}
const flush = () => new Promise((r) => setTimeout(r, 0))
const button = () => document.querySelector('cl-island[c="counter"] button') as HTMLElement

beforeEach(() => { document.body.innerHTML = '' })
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

test('attach="…" is written to the island as a; load is the default and writes nothing', async () => {
  await page(`@import counter from './counter.tscl'\n<counter attach="visible" /><counter />`)
  const [lazy, eager] = document.querySelectorAll('cl-island')
  expect(lazy!.getAttribute('a')).toBe('visible')
  expect(eager!.hasAttribute('a')).toBe(false)
})

test('an invalid attach value is a located build error', () => {
  let err: ClarusError | undefined
  try { compile(`@import counter from './counter.tscl'\n<counter attach="soon" />`, { file: 'x.tscl', target: 'server' }) } catch (e) { err = e as ClarusError }
  expect(err?.message).toMatch(/^x\.tscl:2:10 .*attach must be one of load, idle, visible, interaction/)
})

test('attach on a component without a script fails when rendering', async () => {
  const plain = compile('<p>static</p>', { file: 'plain.tscl', target: 'server' }).code
  const { render } = await importCode(compile(`@import plain from './plain.tscl'\n<plain attach="idle" />`, { file: 'page.tscl', target: 'server' }).code, 'lazy-plain', { './plain.tscl': plain })
  expect(() => render()).toThrow(/<plain> has no <script>, so attach="idle" does nothing/)
})

test('interaction: nothing loads until the island is used, then the first click is replayed once', async () => {
  const mods = await page(`@import counter from './counter.tscl'\n<counter attach="interaction" />`)
  const load = vi.fn(async () => mods.counter)
  await attachAll(document, load)
  expect(load).not.toHaveBeenCalled()
  button().click()
  await flush(); await flush()
  expect(load).toHaveBeenCalledTimes(1)
  expect(button().textContent).toBe('Clicked 1 times (double: 2)')
})

test('a click while the chunk is still loading is replayed after attach (load mode)', async () => {
  const mods = await page(`@import counter from './counter.tscl'\n<counter />`)
  let release!: () => void
  const pending = attachAll(document, () => new Promise((r) => { release = () => r(mods.counter) }))
  button().click()
  button().click()
  release()
  await pending
  await flush()
  expect(button().textContent).toBe('Clicked 2 times (double: 4)')
})

test('a form submitted before attach does not navigate, and its submit handler runs once after attach', async () => {
  const mods = await page(`@import form from './form.tscl'\n<form attach="interaction" />`)
  await attachAll(document, async () => mods.form)
  const formEl = document.querySelector('form')!
  const submit = new Event('submit', { bubbles: true, cancelable: true })
  formEl.dispatchEvent(submit)
  expect(submit.defaultPrevented).toBe(true)
  await flush(); await flush()
  expect(document.querySelector('.sent')!.textContent).toBe('1')
})

test('idle: attaches once the browser is idle', async () => {
  let idle!: () => void
  vi.stubGlobal('requestIdleCallback', (cb: () => void) => { idle = cb; return 1 })
  const mods = await page(`@import counter from './counter.tscl'\n<counter attach="idle" />`)
  const load = vi.fn(async () => mods.counter)
  void attachAll(document, load)
  await flush()
  expect(load).not.toHaveBeenCalled()
  idle()
  await flush(); await flush()
  expect(load).toHaveBeenCalledTimes(1)
})

test('visible: watches what the island holds, not <cl-island> itself (display: contents has no box, so it never intersects)', async () => {
  const watched: Element[] = []
  vi.stubGlobal('IntersectionObserver', class {
    observe(el: Element) { watched.push(el) }
    disconnect() {}
  })
  const mods = await page(`@import counter from './counter.tscl'\n<counter attach="visible" />`)
  void attachAll(document, vi.fn(async () => mods.counter))
  await flush()
  const island = document.querySelector('cl-island')!
  expect(watched.length).toBeGreaterThan(0)
  expect(watched).not.toContain(island)
  expect(watched.every((el) => island.contains(el))).toBe(true)
})

test('visible: attaches when the island scrolls into view', async () => {
  let report!: (entries: { isIntersecting: boolean }[]) => void
  vi.stubGlobal('IntersectionObserver', class {
    constructor(cb: (entries: { isIntersecting: boolean }[]) => void) { report = cb }
    observe() {}
    disconnect() {}
  })
  const mods = await page(`@import counter from './counter.tscl'\n<counter attach="visible" />`)
  const load = vi.fn(async () => mods.counter)
  void attachAll(document, load)
  await flush()
  report([{ isIntersecting: false }])
  expect(load).not.toHaveBeenCalled()
  report([{ isIntersecting: true }])
  await flush(); await flush()
  expect(load).toHaveBeenCalledTimes(1)
})
