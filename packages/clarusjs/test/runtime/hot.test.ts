// @vitest-environment happy-dom
// #53: a changed island is swapped in place in dev, with the page's fresh HTML, keeping its state.
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { attachAll } from '../../src/runtime/loader.ts'
import { swap } from '../../src/runtime/hot.ts'
import { parse, stringify } from '../../src/runtime/serialize.ts'

type Call = { src: string; state: unknown; html: string; p: string | null }
let calls: Call[]
let reload: ReturnType<typeof vi.fn>

// A fake island module per src: attach records what it got and exposes its state, as a compiled one does in dev.
const load = async (src: string) => ({
  attach(root: Element, _props: Record<string, unknown>, state?: Record<string, unknown>) {
    if (src.includes('broken')) throw new Error('bad')
    calls.push({ src, state, html: root.innerHTML, p: root.getAttribute('p') })
    let count = (state?.count as number) ?? 0
    root.addEventListener('click', () => count++)
    ;(root as Element & { __cl_hot?: () => object }).__cl_hot = () => ({ count })
  },
})

const page = (inner: string) => `<!doctype html><html><body>${inner}</body></html>`
const serve = (html: string, ok = true) => vi.stubGlobal('fetch', vi.fn(async () => new Response(html, { status: ok ? 200 : 500 })))

beforeEach(async () => {
  calls = []
  reload = vi.fn()
  vi.stubGlobal('location', { href: 'http://localhost/', reload })
  document.body.innerHTML =
    '<cl-island c="counter" src="/src/counter.tscl?import" p="{&quot;start&quot;:1}"><button>old</button></cl-island>' +
    '<cl-island c="other" src="/src/other.tscl?import"><i>other</i></cl-island>'
  await attachAll(document, load)
  const counter = document.querySelector('cl-island[c="counter"]') as HTMLElement
  counter.click()
  counter.click()
  calls = []
})
afterEach(() => { vi.unstubAllGlobals() })

test("the changed island gets the page's new HTML, the new module and its old state; the others are left alone", async () => {
  const other = document.querySelector('cl-island[c="other"]')
  serve(page('<cl-island c="counter" src="/src/counter.tscl?import" p="{&quot;start&quot;:1}" s="{}"><button>new</button></cl-island><cl-island c="other" src="/src/other.tscl?import"><i>changed too</i></cl-island>'))
  await swap('http://localhost/src/counter.tscl?import&t=5')
  expect(calls).toEqual([{ src: '/src/counter.tscl?import&t=5', state: { count: 2 }, html: '<button>new</button>', p: '{"start":1}' }])
  expect(document.querySelector('cl-island[c="other"]')).toBe(other)
  expect(other!.innerHTML).toBe('<i>other</i>')
  expect(reload).not.toHaveBeenCalled()
})

test('props stay the ones on the page (a parent island may have changed them since)', async () => {
  document.querySelector('cl-island[c="counter"]')!.setAttribute('p', stringify({ start: 9 }))
  serve(page('<cl-island c="counter" src="/src/counter.tscl?import" p="{&quot;start&quot;:1}"><b>new</b></cl-island>'))
  await swap('http://localhost/src/counter.tscl?import&t=6')
  expect(parse(calls[0]!.p!)).toEqual({ start: 9 })
})

test('state the server rendered with is kept for names the old version did not have', async () => {
  serve(page(`<cl-island c="counter" src="/src/counter.tscl?import" s="${stringify({ count: 0, open: true }).replaceAll('"', '&quot;')}"><b>new</b></cl-island>`))
  await swap('http://localhost/src/counter.tscl?import&t=7')
  expect(calls[0]!.state).toEqual({ count: 2, open: true })
})

test('islands nested in the changed one keep their state too', async () => {
  document.body.innerHTML = '<cl-island c="outer" src="/src/outer.tscl?import"><cl-island c="counter" src="/src/counter.tscl?import"><b>x</b></cl-island></cl-island>'
  await attachAll(document, load)
  document.querySelector('cl-island[c="counter"]')!.dispatchEvent(new Event('click')) // not bubbling to the outer one
  calls = []
  serve(page('<cl-island c="outer" src="/src/outer.tscl?import"><p>new</p><cl-island c="counter" src="/src/counter.tscl?import"><b>y</b></cl-island></cl-island>'))
  await swap('http://localhost/src/outer.tscl?import&t=8')
  expect(calls.map((c) => [c.src, c.state])).toEqual([
    ['/src/outer.tscl?import&t=8', { count: 0 }],
    ['/src/counter.tscl?import', { count: 1 }],
  ])
})

test('an island that is not on this page: nothing to do', async () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  await swap('http://localhost/src/elsewhere.tscl?import&t=1')
  expect(fetch).not.toHaveBeenCalled()
  expect(reload).not.toHaveBeenCalled()
})

test("when the page's islands no longer line up, or the page fails, or the new version fails to attach: a full reload", async () => {
  serve(page('<p>the island is gone</p>'))
  await swap('http://localhost/src/counter.tscl?import&t=2')
  serve('oops', false)
  await swap('http://localhost/src/counter.tscl?import&t=3')
  serve(page('<cl-island c="counter" src="/src/counter.tscl?import"><b>new</b></cl-island>'))
  await swap('http://localhost/src/counter.tscl?import&broken&t=4')
  expect(reload).toHaveBeenCalledTimes(3)
})
