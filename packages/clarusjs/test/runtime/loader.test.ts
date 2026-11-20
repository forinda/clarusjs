// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest'
import { attachAll } from '../../src/runtime/loader.ts'

test('one failing island does not stop the others, and is logged by name', async () => {
  document.body.innerHTML =
    '<cl-island c="broken" src="/broken.js" p="{}"></cl-island>' +
    '<cl-island c="counter" src="/counter.js" p="{&quot;start&quot;:10}"></cl-island>'
  const attach = vi.fn()
  const load = vi.fn(async (src: string) => {
    if (src === '/broken.js') throw new Error('404')
    return { attach }
  })
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})

  await attachAll(document, load)

  const ok = document.querySelectorAll('cl-island')[1]!
  expect(attach).toHaveBeenCalledWith(ok, { start: 10 }, undefined) // no s attribute: no server state
  expect(ok.hasAttribute('data-cl-ready')).toBe(true)
  expect(String(error.mock.calls[0]?.[0])).toContain('broken')

  await attachAll(document, load)
  expect(attach).toHaveBeenCalledTimes(1)
  error.mockRestore()
})
