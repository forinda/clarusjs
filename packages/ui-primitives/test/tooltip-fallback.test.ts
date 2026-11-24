// @vitest-environment happy-dom
// #465: where the browser has no interest invokers (interestfor), the tooltip trigger island shows and hides its
// tooltip itself: focus and blur at once, hover after a delay, Escape closes.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { compile } from 'clarusjs/compiler'
import { expect, test, vi } from 'vitest'

const clarus = (path: string) => pathToFileURL(resolve(import.meta.dirname, '../node_modules/clarusjs/src', path)).href

test('the trigger shows its tooltip on focus and hover, and hides it on blur and Escape', async () => {
  const source = readFileSync(resolve(import.meta.dirname, '../src/tooltip-trigger.tscl'), 'utf8')
  const code = compile(source, { file: 'tooltip-trigger.tscl', target: 'client' }).code.replaceAll("'clarusjs/runtime'", `'${clarus('runtime/index.ts')}'`)
  mkdirSync(resolve(import.meta.dirname, '.tmp'), { recursive: true })
  const dir = mkdtempSync(resolve(import.meta.dirname, '.tmp/tip-'))
  writeFileSync(resolve(dir, 'trigger.mjs'), code)
  const { attach } = await import(pathToFileURL(resolve(dir, 'trigger.mjs')).href)
  document.body.innerHTML = '<cl-island c="tooltip-trigger"><button type="button" data-cl-u="0">Copy</button></cl-island><div id="tip" popover="hint" role="tooltip"></div>'
  const tip = document.getElementById('tip')! as HTMLElement & { showPopover(): void; hidePopover(): void }
  let open = false
  tip.showPopover = vi.fn(() => { open = true })
  tip.hidePopover = vi.fn(() => { open = false })
  tip.matches = ((s: string) => (s === ':popover-open' ? open : false)) as typeof tip.matches
  const button = document.querySelector('button')!
  expect('interestForElement' in button).toBe(false)
  attach(document.querySelector('cl-island'), { target: 'tip' })
  button.dispatchEvent(new FocusEvent('focus'))
  expect(open).toBe(true)
  button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  expect(open).toBe(false)
  vi.useFakeTimers()
  button.dispatchEvent(new PointerEvent('pointerenter'))
  expect(open).toBe(false)
  vi.advanceTimersByTime(300)
  expect(open).toBe(true)
  button.dispatchEvent(new PointerEvent('pointerleave'))
  vi.advanceTimersByTime(100)
  expect(open).toBe(false)
  vi.useRealTimers()
})
