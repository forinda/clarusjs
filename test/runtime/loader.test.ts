// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest'
import { attachAll } from '../../src/runtime/loader.ts'

test('one failing island does not stop the others, and is logged by name', async () => {
  document.body.innerHTML =
    '<kv-island c="broken" src="/broken.js" p="{}"></kv-island>' +
    '<kv-island c="counter" src="/counter.js" p="{&quot;start&quot;:10}"></kv-island>'
  const attach = vi.fn()
  const load = vi.fn(async (src: string) => {
    if (src === '/broken.js') throw new Error('404')
    return { attach }
  })
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})

  await attachAll(document, load)

  const ok = document.querySelectorAll('kv-island')[1]!
  expect(attach).toHaveBeenCalledWith(ok, { start: 10 })
  expect(ok.hasAttribute('data-kv-ready')).toBe(true)
  expect(String(error.mock.calls[0]?.[0])).toContain('broken')

  await attachAll(document, load)
  expect(attach).toHaveBeenCalledTimes(1)
  error.mockRestore()
})
