// @vitest-environment happy-dom
// The behaviours, each an (element, options) → dispose function for [use]. Cases from Radix's and Base UI's own tests:
// RTL, disabled items skipped, no loop, typeahead cycling on a repeated key, nested layers, cancelling.
import { afterEach, expect, test } from 'vitest'
import { dismiss, enter, exit, focusReturn, position, rovingFocus, typeahead } from '../src/index.js'

afterEach(() => { document.body.innerHTML = '' })
const html = (s: string) => { document.body.innerHTML = s; return document.body.firstElementChild as HTMLElement }
const key = (el: Element, k: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
const focused = () => (document.activeElement as HTMLElement)?.textContent

test('rovingFocus: one tab stop; arrows move (orientation), Home/End jump, disabled skipped, loop or not', () => {
  const bar = html('<div><button>a</button><button disabled>b</button><button aria-disabled="true">c</button><button>d</button><button>e</button></div>')
  const stop = rovingFocus(bar, { orientation: 'horizontal' })
  const buttons = [...bar.querySelectorAll('button')]
  expect(buttons.map((b) => b.tabIndex)).toEqual([0, -1, -1, -1, -1])
  buttons[0]!.focus()
  key(document.activeElement!, 'ArrowRight')
  expect(focused()).toBe('d') // b and c are disabled
  expect(buttons.map((b) => b.tabIndex)).toEqual([-1, -1, -1, 0, -1])
  key(document.activeElement!, 'ArrowDown') // not this orientation
  expect(focused()).toBe('d')
  key(document.activeElement!, 'End')
  expect(focused()).toBe('e')
  key(document.activeElement!, 'ArrowRight') // loops
  expect(focused()).toBe('a')
  key(document.activeElement!, 'ArrowLeft')
  expect(focused()).toBe('e')
  stop()
  key(document.activeElement!, 'ArrowRight')
  expect(focused()).toBe('e') // disposed: no more
})

test('rovingFocus: no loop stops at the ends; RTL flips left and right; a vertical list uses up and down', () => {
  const list = html('<div dir="rtl"><button>a</button><button>b</button></div>')
  rovingFocus(list, { loop: false })
  list.querySelector('button')!.focus()
  key(document.activeElement!, 'ArrowLeft') // RTL: left is next
  expect(focused()).toBe('b')
  key(document.activeElement!, 'ArrowLeft')
  expect(focused()).toBe('b') // no loop
  const menu = html('<div><a href="#">x</a><a href="#">y</a></div>')
  rovingFocus(menu, { items: 'a', orientation: 'vertical' })
  menu.querySelector('a')!.focus()
  key(document.activeElement!, 'ArrowDown')
  expect(focused()).toBe('y')
})

test('rovingFocus: the item focused or marked current becomes the tab stop', () => {
  const tabs = html('<div><button>a</button><button aria-selected="true">b</button><button>c</button></div>')
  rovingFocus(tabs)
  expect([...tabs.querySelectorAll('button')].map((b) => b.tabIndex)).toEqual([-1, 0, -1])
  ;(tabs.querySelectorAll('button')[2] as HTMLElement).focus()
  expect([...tabs.querySelectorAll('button')].map((b) => b.tabIndex)).toEqual([-1, -1, 0])
})

test('typeahead: typing jumps to the next match; the same key again cycles; a pause starts over', async () => {
  const list = html('<ul><li tabindex="-1">Apple</li><li tabindex="-1">Banana</li><li tabindex="-1">Blueberry</li><li tabindex="-1">Cherry</li></ul>')
  typeahead(list, { items: 'li', timeout: 50 })
  ;(list.firstElementChild as HTMLElement).focus()
  key(document.activeElement!, 'b')
  expect(focused()).toBe('Banana')
  key(document.activeElement!, 'b') // repeated: cycles among b's
  expect(focused()).toBe('Blueberry')
  key(document.activeElement!, 'b')
  expect(focused()).toBe('Banana')
  await new Promise((r) => setTimeout(r, 80))
  key(document.activeElement!, 'c')
  key(document.activeElement!, 'h')
  expect(focused()).toBe('Cherry')
  key(document.activeElement!, 'ArrowDown') // not a character: ignored
  expect(focused()).toBe('Cherry')
})

test('dismiss: Escape and a press outside close it, with the reason; only the topmost layer closes', () => {
  document.body.innerHTML = '<div id="outer"><button id="inner-trigger">t</button><div id="inner">in</div></div><p id="out">x</p>'
  const calls: string[] = []
  const stopOuter = dismiss(document.getElementById('outer')!, { onDismiss: (reason) => calls.push('outer ' + reason) })
  const stopInner = dismiss(document.getElementById('inner')!, { onDismiss: (reason) => calls.push('inner ' + reason) })
  key(document.body, 'Escape')
  expect(calls).toEqual(['inner escape-key']) // the topmost only
  document.getElementById('inner')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  expect(calls).toEqual(['inner escape-key']) // inside: nothing
  document.getElementById('inner-trigger')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  expect(calls).toEqual(['inner escape-key', 'inner outside-press']) // outside inner, inside outer: only inner
  stopInner()
  key(document.body, 'Escape')
  expect(calls.at(-1)).toBe('outer escape-key')
  stopOuter()
})

test('dismiss: a cl:dismiss listener can cancel it; excluded elements (its trigger) don\'t count as outside', () => {
  document.body.innerHTML = '<button id="trigger">t</button><div id="pop">p</div>'
  const pop = document.getElementById('pop')!
  const calls: string[] = []
  dismiss(pop, { onDismiss: (r) => calls.push(r), exclude: () => [document.getElementById('trigger')] })
  document.getElementById('trigger')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  expect(calls).toEqual([])
  pop.addEventListener('cl:dismiss', (e) => e.preventDefault(), { once: true })
  key(document.body, 'Escape')
  expect(calls).toEqual([]) // cancelled
  key(document.body, 'Escape')
  expect(calls).toEqual(['escape-key'])
})

test('enter / exit: data-starting-style for a frame, data-open; then data-ending-style until animations finish', async () => {
  const el = html('<div></div>')
  enter(el)
  expect(el.hasAttribute('data-open')).toBe(true)
  expect(el.hasAttribute('data-starting-style')).toBe(true)
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  expect(el.hasAttribute('data-starting-style')).toBe(false)
  const done = exit(el)
  expect(el.hasAttribute('data-closed')).toBe(true)
  expect(el.hasAttribute('data-open')).toBe(false)
  expect(el.hasAttribute('data-ending-style')).toBe(true)
  await done
  expect(el.hasAttribute('data-ending-style')).toBe(false)
})

test('focusReturn: focus goes back to what had it when the element goes', () => {
  document.body.innerHTML = '<button id="t">t</button><div id="d"><input id="i"></div>'
  const trigger = document.getElementById('t') as HTMLElement
  trigger.focus()
  const back = focusReturn(document.getElementById('d')!)
  ;(document.getElementById('i') as HTMLElement).focus()
  back()
  expect(document.activeElement).toBe(trigger)
})

test('position: below its anchor by default, flipped above when there is no room; sets data-side and the CSS variables', () => {
  document.body.innerHTML = '<button id="a">a</button><div id="f">f</div>'
  const anchor = document.getElementById('a')!
  const floating = document.getElementById('f')!
  const rect = (x: number, y: number, w: number, h: number) => () => ({ x, y, left: x, top: y, width: w, height: h, right: x + w, bottom: y + h, toJSON() {} }) as DOMRect
  Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true })
  Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true })
  anchor.getBoundingClientRect = rect(100, 100, 80, 20)
  floating.getBoundingClientRect = rect(0, 0, 120, 200)
  const stop = position(floating, anchor, { offset: 4 })
  expect(floating.style.top).toBe('124px')
  expect(floating.style.left).toBe('80px') // centered on the anchor
  expect(floating.dataset.side).toBe('bottom')
  expect(floating.style.getPropertyValue('--anchor-width')).toBe('80px')
  expect(floating.style.getPropertyValue('--available-height')).toBe('476px') // 600 − 120 − 4
  stop()
  anchor.getBoundingClientRect = rect(100, 500, 80, 20) // near the bottom: no room below
  position(floating, anchor, { offset: 4 })
  expect(floating.dataset.side).toBe('top')
  expect(floating.style.top).toBe('296px')
})
