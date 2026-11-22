// #243: the playground (/repl) and its sandboxed preview frame.
import { expect, test } from '@playwright/test'

test('a sandboxed srcdoc frame runs an inline module and imports a blob (what the preview is built on)', async ({ page }) => {
  await page.setContent('<p>parent</p>')
  const got = await page.evaluate(() => new Promise((resolve, reject) => {
    addEventListener('message', (e) => resolve(e.data))
    setTimeout(() => reject(new Error('no message from the frame')), 5000)
    const frame = document.createElement('iframe')
    frame.setAttribute('sandbox', 'allow-scripts')
    frame.srcdoc = `<!doctype html><script type="module">
      const url = URL.createObjectURL(new Blob(['export const one = 1'], { type: 'text/javascript' }))
      const { one } = await import(url)
      let storage = 'blocked'
      try { localStorage.getItem('x'); storage = 'open' } catch {}
      parent.postMessage({ one, origin: location.origin, storage }, '*')
    <\/script>`
    document.body.append(frame)
  }))
  expect(got).toEqual({ one: 1, origin: 'null', storage: 'blocked' })
})

// The preview frame on its own: the runtime bundled as the docs build bundles it, components compiled as the page does.
import { compile } from 'clarusjs/compiler'
import { bundleReplRuntime } from '../src/repl/bundle.ts'
import { frameDoc } from '../src/repl/frame.ts'

const counter = '<script>\nlet n = state(0)\n</script>\n<button (click)="n++">Clicked {{ n }}</button>\n@if (n > 1) {<p class="big">big</p>}\n'
const thrower = '<script>\nthrow new Error("boom in the script")\n</script>\n<p>x</p>\n'
const both = (source: string) => ({
  server: compile(source, { file: 'App.tscl', target: 'server', clientUrl: '/app.js' }).code,
  client: compile(source, { file: 'App.tscl', target: 'client' }).stateful ? compile(source, { file: 'App.tscl', target: 'client' }).code : null,
})

test.describe('the preview frame', () => {
  let runtime = ''
  test.beforeAll(async () => { runtime = await bundleReplRuntime() })

  /** A page holding the frame; post(code) resolves with the frame's reply. */
  const open = async (page: import('@playwright/test').Page) => {
    await page.setContent('<p>parent</p>')
    await page.evaluate((doc) => {
      const frame = document.createElement('iframe')
      frame.setAttribute('sandbox', 'allow-scripts')
      frame.srcdoc = doc
      document.body.append(frame)
      return new Promise((r) => frame.addEventListener('load', r))
    }, frameDoc(runtime))
    return (message: object) => page.evaluate((m) => new Promise((resolve) => {
      addEventListener('message', function on(e) { if (e.data?.id === (m as { id: number }).id) { removeEventListener('message', on); resolve(e.data) } })
      document.querySelector('iframe')!.contentWindow!.postMessage(m, '*')
    }), message)
  }

  test('renders posted code and attaches its island', async ({ page }) => {
    const post = await open(page)
    expect(await post({ id: 1, ...both(counter) })).toEqual({ id: 1, ok: true })
    const frame = page.frameLocator('iframe')
    await expect(frame.locator('button')).toHaveText('Clicked 0')
    await frame.locator('button').click()
    await frame.locator('button').click()
    await expect(frame.locator('button')).toHaveText('Clicked 2')
    await expect(frame.locator('.big')).toHaveText('big')
    // A second post replaces the first, fresh.
    expect(await post({ id: 2, ...both(counter.replace('Clicked', 'Pressed')) })).toEqual({ id: 2, ok: true })
    await expect(frame.locator('button')).toHaveText('Pressed 0')
  })

  test('reports an error thrown while rendering, and shows it', async ({ page }) => {
    const post = await open(page)
    const reply = await post({ id: 7, ...both(thrower) }) as { id: number; error?: string }
    expect(reply.id).toBe(7)
    expect(reply.error).toContain('boom in the script')
    await expect(page.frameLocator('iframe').locator('#out')).toContainText('boom in the script')
  })
})
