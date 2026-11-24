// @vitest-environment happy-dom
// #465: which island owns a node. Its nearest <cl-island>, except that each slot range (<!--[s-->…<!--]s-->) it sits
// inside moves ownership one island outward: content an island passes to another stays the outer island's.
import { afterEach, expect, test } from 'vitest'
import { holes, owner } from '../../src/runtime/dom.ts'

afterEach(() => { document.body.innerHTML = '' })
const $ = (s: string) => document.querySelector(s)!
const island = (c: string) => $(`cl-island[c="${c}"]`)

test('a node belongs to its nearest island; inside an inner island\'s slot, to the island around it', () => {
  document.body.innerHTML = '<cl-island c="a"><p class="a">x</p><cl-island c="b"><i class="b">own</i><div><!--[s--><b class="in">content</b><!--]s--><u class="after">b again</u></div></cl-island></cl-island>'
  expect(owner($('.a'))).toBe(island('a'))
  expect(owner($('.b'))).toBe(island('b'))
  expect(owner($('.in'))).toBe(island('a'))
  expect(owner($('.after'))).toBe(island('b'))
})

test('an island inside the content: its own nodes are its; its slot\'s content goes back out two islands', () => {
  document.body.innerHTML = '<cl-island c="a"><cl-island c="b"><!--[s--><cl-island c="c"><i class="c">c</i><!--[s--><b class="deep">a</b><!--]s--></cl-island><!--]s--></cl-island></cl-island>'
  expect(owner($('.c'))).toBe(island('c'))
  expect(owner($('.deep'))).toBe(island('a'))
})

test('content in the slot of an island that has no island around it belongs to none', () => {
  document.body.innerHTML = '<cl-island c="b"><!--[s--><b class="in">x</b><!--]s--></cl-island>'
  expect(owner($('.in'))).toBe(null)
})

test('an [s the parser left without its ]s runs to the end of its parent; comments are answered like elements', () => {
  document.body.innerHTML = '<cl-island c="a"><cl-island c="b"><div><!--[s--><b class="in">x</b><!--[0-->1<!--]--></div><i class="b">own</i></cl-island></cl-island>'
  expect(owner($('.in'))).toBe(island('a'))
  expect(owner($('.b'))).toBe(island('b'))
  const hole = [...$('div').childNodes].find((n) => n.nodeType === 8 && (n as Comment).data === '[0')!
  expect(owner(hole)).toBe(island('a'))
})

test('scanning an island with a 2000-row list stays linear (#465 review)', async () => {
  const { holes } = await import('../../src/runtime/dom.ts')
  const rows = Array.from({ length: 2000 }, (_, i) => `<!--[r--><p><!--[0-->${i}<!--]--></p><!--]-->`).join('')
  document.body.innerHTML = `<cl-island c="a"><div><!--[f0-->${rows}<!--]--></div></cl-island>`
  const t = performance.now()
  holes(island('a'))
  expect(performance.now() - t).toBeLessThan(300)
})

test('#465 review: an island\'s holes skip those of an island in its slot content, even at the same index', () => {
  document.body.innerHTML = '<cl-island id="a"><cl-island id="b"><!--[0-->b<!--]--><!--[s--><cl-island id="c"><!--[0-->c<!--]--></cl-island><!--]s--></cl-island></cl-island>'
  const b = document.getElementById('b')!
  expect((holes(b)[0]!.start.nextSibling as Text).data).toBe('b')
})
