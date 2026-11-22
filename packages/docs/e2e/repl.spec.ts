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

// The page.
test.describe('/repl', () => {
  const code = (page: import('@playwright/test').Page) => page.locator('#repl-code')
  const preview = (page: import('@playwright/test').Page) => page.frameLocator('#repl-preview iframe')
  const type = (page: import('@playwright/test').Page, source: string) => code(page).fill(source)
  /** Open the playground and wait until it's attached (its compiler chunk is large; under load that takes a while). */
  const open = async (page: import('@playwright/test').Page, url = '/repl') => {
    await page.goto(url)
    await expect(page.locator('.repl[data-ready]')).toBeAttached({ timeout: 20_000 })
  }

  test('opens with the first starter running', async ({ page }) => {
    await open(page)
    await expect(page).toHaveTitle(/Playground/)
    await expect(preview(page).locator('button')).toBeVisible()
  })

  test('type a component: the preview shows it, its button works', async ({ page }) => {
    await open(page)
    await type(page, counter)
    await expect(preview(page).locator('button')).toHaveText('Clicked 0')
    await preview(page).locator('button').click()
    await expect(preview(page).locator('button')).toHaveText('Clicked 1')
    // The highlighting behind the textarea follows the source.
    await expect(page.locator('#repl-highlight')).toContainText('let n = state(0)')
  })

  test('a syntax error shows line:col and keeps the last preview', async ({ page }) => {
    await open(page)
    await type(page, counter)
    await expect(preview(page).locator('button')).toHaveText('Clicked 0')
    await type(page, counter + '<p>\n')
    await expect(page.locator('.repl-errors')).toContainText(/\d+:\d+ /)
    await expect(preview(page).locator('button')).toHaveText('Clicked 0')
    await type(page, counter)
    await expect(page.locator('.repl-errors')).toHaveCount(0)
  })

  test('typing fast: the preview matches the last source', async ({ page }) => {
    await open(page)
    for (let i = 1; i <= 10; i++) await type(page, counter.replace('Clicked', `Version ${i}`))
    await expect(preview(page).locator('button')).toHaveText('Version 10 0')
  })

  test('a script that throws: the error shows; the next good edit recovers', async ({ page }) => {
    await open(page)
    await type(page, thrower)
    await expect(page.locator('.repl-errors')).toContainText('boom in the script')
    await type(page, counter)
    await expect(preview(page).locator('button')).toHaveText('Clicked 0')
    await expect(page.locator('.repl-errors')).toHaveCount(0)
  })

  test("the preview can't read the site's storage", async ({ page }) => {
    await open(page)
    await page.evaluate(() => localStorage.setItem('secret', 'site data'))
    await type(page, "<script>\nlet v = state('')\ntry { v = String(localStorage.getItem('secret')) } catch { v = 'blocked' }\n</script>\n<p id=\"v\">{{ v }}</p>\n")
    await expect(preview(page).locator('#v')).toHaveText('blocked')
  })

  test('a share link reopens the code; a broken hash opens the first starter', async ({ page }) => {
    await open(page)
    await type(page, counter.replace('Clicked', 'Shared'))
    await page.getByRole('button', { name: 'Share' }).click()
    await expect(page.locator('.repl-status')).toContainText('link')
    const url = page.url()
    expect(url).toMatch(/#[A-Za-z0-9_-]+$/)
    await page.goto('/')
    await open(page, url)
    await expect(code(page)).toHaveValue(counter.replace('Clicked', 'Shared'))
    await expect(preview(page).locator('button')).toHaveText('Shared 0')
    await open(page, '/repl#not-a-valid-share-link')
    await expect(preview(page).locator('button')).toBeVisible()
    await expect(page.locator('.repl-errors')).toHaveCount(0)
  })

  test('keyboard: Tab indents, Esc then Tab leaves the editor', async ({ page }) => {
    await open(page)
    await type(page, '')
    await code(page).focus()
    await page.keyboard.press('Tab')
    await page.keyboard.type('x')
    await expect(code(page)).toHaveValue('  x')
    await page.keyboard.press('Escape')
    await page.keyboard.press('Tab')
    await expect(code(page)).not.toBeFocused()
  })

  test('the starter picker switches examples', async ({ page }) => {
    await open(page)
    await page.getByLabel('Example').selectOption('Todo list')
    await expect(code(page)).toHaveValue(/@for/)
    await expect(preview(page).locator('li').first()).toBeVisible()
  })

  test('only /repl loads the compiler', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const dist = resolve(import.meta.dirname, '../dist')
    const manifest = JSON.parse(readFileSync(resolve(dist, 'clarusjs-manifest.json'), 'utf8'))
    expect(manifest.routes['/repl'].islands.map((i: { component: string }) => i.component)).toContain('repl')
    for (const [route, info] of Object.entries<{ js: { files: string[] } }>(manifest.routes)) {
      if (route === '/repl') continue
      for (const file of info.js.files) expect(readFileSync(resolve(dist, 'client', file.replace(/^\//, '')), 'utf8'), `${route}: ${file}`).not.toContain('unexpected closing tag')
    }
  })
})

test('text typed before the playground attaches is kept', async ({ page }) => {
  // Hold the island's script back, type, then let it load.
  let release = () => {}
  const held = new Promise<void>((r) => (release = r))
  await page.route(/\/assets\/.*\.js$/, async (route) => { await held; await route.continue() })
  await page.goto('/repl', { waitUntil: 'commit' }) // the held script holds DOMContentLoaded back too
  await page.locator('#repl-code').fill('<p id="early">typed early</p>\n')
  release()
  await expect(page.locator('.repl[data-ready]')).toBeAttached({ timeout: 20_000 })
  await expect(page.locator('#repl-code')).toHaveValue('<p id="early">typed early</p>\n')
  await expect(page.frameLocator('#repl-preview iframe').locator('#early')).toHaveText('typed early')
})
