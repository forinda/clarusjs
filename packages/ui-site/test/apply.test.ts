// @vitest-environment happy-dom
import { afterEach, expect, test, vi } from 'vitest'
import { APPLY_SCRIPT, STORAGE_KEY } from '../src/theme/apply.ts'

const run = () => new Function(APPLY_SCRIPT)()
afterEach(() => { document.head.innerHTML = ''; localStorage.clear(); vi.restoreAllMocks() })

test('a saved theme is added to <head> as <style id="ui-theme">', () => {
  localStorage.setItem(STORAGE_KEY, '.demo { --ui-accent: #ff0000; }')
  run()
  expect(document.getElementById('ui-theme')?.textContent).toBe('.demo { --ui-accent: #ff0000; }')
})

test('storage that throws (private mode, blocked) leaves the page alone, without an error', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
  expect(run).not.toThrow()
  expect(document.getElementById('ui-theme')).toBeNull()
})

test('a stored value with < in it, or a huge one, is ignored', () => {
  localStorage.setItem(STORAGE_KEY, '</style><script>alert(1)</script>')
  run()
  expect(document.getElementById('ui-theme')).toBeNull()
  localStorage.setItem(STORAGE_KEY, 'x'.repeat(20_001))
  run()
  expect(document.getElementById('ui-theme')).toBeNull()
})
