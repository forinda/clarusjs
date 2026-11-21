// @vitest-environment happy-dom
// Event bindings are delegated to the island root: events that don't bubble (focus, blur, mouseenter, …) are caught
// in the capture phase, as browsers dispatch them without bubbling.
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { importCode } from '../helpers.ts'

test('(focus), (blur) and (mouseenter) fire though those events don\'t bubble; bubbling events keep their order', async () => {
  const src = "<script>\n  let log = state([])\n  const add = (x) => { log = [...log, x] }\n</script>\n<div (click)=\"add('outer')\"><input class=\"f\" (focus)=\"add('focus')\" (blur)=\"add('blur')\"><span class=\"h\" (mouseenter)=\"add('enter')\" (click)=\"add('inner')\">x</span><p class=\"log\">{{ log.join(',') }}</p></div>\n"
  const s = await importCode(compile(src, { file: 'x.tscl', target: 'server', clientUrl: '/x' }).code, 'ev-s')
  const c = await importCode(compile(src, { file: 'x.tscl', target: 'client' }).code, 'ev-c')
  document.body.innerHTML = s.render({})
  c.attach(document.querySelector('cl-island')!, {})
  const f = document.querySelector('.f')!
  // As a browser dispatches them: not bubbling.
  f.dispatchEvent(new FocusEvent('focus', { bubbles: false }))
  f.dispatchEvent(new FocusEvent('blur', { bubbles: false }))
  const h = document.querySelector('.h') as HTMLElement
  h.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }))
  h.click()
  expect(document.querySelector('.log')!.textContent).toBe('focus,blur,enter,inner,outer')
})
