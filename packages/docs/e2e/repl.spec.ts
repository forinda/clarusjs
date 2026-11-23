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
import { prepare } from '../src/repl/prepare.ts'
import { frameDoc } from '../src/repl/frame.ts'

const counter = '<script>\nlet n = state(0)\n</script>\n<button (click)="n++">Clicked {{ n }}</button>\n@if (n > 1) {<p class="big">big</p>}\n'
const thrower = '<script>\nthrow new Error("boom in the script")\n</script>\n<p>x</p>\n'
// What the page posts: compiled, then prepared (imports rewritten, loops guarded).
const both = (source: string) => ({
  server: prepare(compile(source, { file: 'App.tscl', target: 'server', clientUrl: '/app.js' }).code),
  client: compile(source, { file: 'App.tscl', target: 'client' }).stateful ? prepare(compile(source, { file: 'App.tscl', target: 'client' }).code) : null,
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
    expect(await post({ id: 1, ...both(counter) })).toMatchObject({ id: 1, ok: true })
    const frame = page.frameLocator('iframe')
    await expect(frame.locator('button')).toHaveText('Clicked 0')
    await frame.locator('button').click()
    await frame.locator('button').click()
    await expect(frame.locator('button')).toHaveText('Clicked 2')
    await expect(frame.locator('.big')).toHaveText('big')
    // One run per frame (the page makes a fresh frame for the next): a second post is ignored.
    await page.evaluate((m) => document.querySelector('iframe')!.contentWindow!.postMessage(m, '*'), { id: 2, ...both(counter.replace('Clicked', 'Pressed')) })
    await page.waitForTimeout(300)
    await expect(frame.locator('button')).toHaveText('Clicked 2')
  })

  test('ignores code posted by any window but its parent', async ({ page }) => {
    const post = await open(page)
    expect(await post({ id: 1, ...both(counter) })).toMatchObject({ id: 1, ok: true })
    // A sibling frame (as the visitor's own code could be) posts other code to the preview.
    await page.evaluate((evil) => {
      const other = document.createElement('iframe')
      other.setAttribute('sandbox', 'allow-scripts')
      other.srcdoc = `<script>parent.frames[0].postMessage(${JSON.stringify(evil)}, '*')<\/script>`
      document.body.append(other)
    }, { id: 2, ...both('<p id="evil">replaced</p>') })
    await page.waitForTimeout(500)
    await expect(page.frameLocator('iframe').first().locator('#evil')).toHaveCount(0)
    await expect(page.frameLocator('iframe').first().locator('button')).toHaveText('Clicked 0')
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
  // The frame on screen (a run still rendering waits in a hidden one).
  const preview = (page: import('@playwright/test').Page) => page.frameLocator('#repl-preview iframe:not([hidden])')
  const type = (page: import('@playwright/test').Page, source: string) => code(page).fill(source)
  /** Open the playground and wait until it's attached (its compiler chunk is large; under load that takes a while). */
  const open = async (page: import('@playwright/test').Page, url = '/repl') => {
    await page.goto(url)
    await expect(page.locator('.repl[data-ready]')).toBeAttached({ timeout: 20_000 })
  }

  test('an app layout like other playgrounds: the full width, no sidebar, the panes filling the window', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page)
    await expect(page.locator('#sidebar')).toHaveCount(0)
    const box = await page.locator('.repl-panes').boundingBox()
    expect(box!.width).toBeGreaterThan(1400)
    expect(box!.y + box!.height).toBeGreaterThan(880) // down to the bottom of the window
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(900) // no page scroll
  })

  test('line numbers follow the code, and scroll with it', async ({ page }) => {
    await open(page)
    await type(page, 'a\nb\nc\n')
    await expect(page.locator('#repl-lines')).toHaveText(['1', '2', '3', '4'].join('\n'))
    await type(page, Array.from({ length: 200 }, (_, i) => `<p>${i}</p>`).join('\n'))
    await code(page).evaluate((area) => { area.scrollTop = 1000; area.dispatchEvent(new Event('scroll')) })
    expect(await page.locator('#repl-lines').evaluate((lines) => lines.scrollTop)).toBe(await code(page).evaluate((a) => a.scrollTop))
  })

  test('the divider resizes the panes, by mouse and by keyboard', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page)
    const divider = page.getByRole('separator', { name: 'Resize the editor and the output' })
    const width = () => page.locator('.repl-editor-pane').evaluate((e) => e.getBoundingClientRect().width)
    const before = await width()
    const at = (await divider.boundingBox())!
    await page.mouse.move(at.x + at.width / 2, at.y + 100)
    await page.mouse.down()
    await page.mouse.move(at.x - 300, at.y + 100, { steps: 5 })
    await page.mouse.up()
    expect(await width()).toBeLessThan(before - 200)
    const dragged = await width()
    await divider.focus()
    await page.keyboard.press('ArrowRight')
    expect(await width()).toBeGreaterThan(dragged)
    await expect(divider).toHaveAttribute('aria-valuenow', /\d+/)
  })

  test('on a phone the panes stack', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await open(page)
    const editor = (await page.locator('.repl-editor-pane').boundingBox())!
    const output = (await page.locator('.repl-output').boundingBox())!
    expect(output.y).toBeGreaterThanOrEqual(editor.y + editor.height - 1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })

  test('the Todo list example adds an item: a form in the preview submits to its handler', async ({ page }) => {
    await open(page)
    await page.getByLabel('Example').selectOption('Todo list')
    await expect(preview(page).locator('li')).toHaveCount(2)
    await preview(page).getByLabel('New item').fill('Milk')
    await preview(page).getByRole('button', { name: 'Add' }).click()
    await expect(preview(page).locator('li')).toHaveCount(3)
    await expect(preview(page).locator('li').last()).toContainText('Milk')
    await preview(page).getByLabel('New item').press('Enter') // empty: nothing added
    await expect(preview(page).locator('li')).toHaveCount(3)
  })

  test("a form without preventDefault doesn't take the preview away", async ({ page }) => {
    await open(page)
    await type(page, '<script>\n  let n = state(0)\n</script>\n<form (submit)="n++"><button>Go</button></form>\n<p>{{ n }}</p>\n')
    await preview(page).getByRole('button', { name: 'Go' }).click()
    await expect(preview(page).locator('p')).toHaveText('1')
  })

  test("a component's <style> applies in the preview", async ({ page }) => {
    await open(page)
    // Scoped rules apply inside the component's top-level elements (a top-level one is styled with :scope).
    await type(page, '<div><p class="big">Hi</p></div>\n<style scoped>\n  .big { font-size: 40px; }\n</style>\n')
    await expect(preview(page).locator('.big')).toHaveCSS('font-size', '40px')
  })

  test('the Checkout example: steps, the schema\'s errors on their fields, a summary on submit, and the order placed', async ({ page }) => {
    await open(page)
    await page.getByLabel('Example').selectOption('Checkout')
    const frame = preview(page)
    // Step 1, shipping: Next checks this step only, and stays with the field's error shown.
    await expect(frame.getByRole('heading', { name: 'Shipping' })).toBeVisible()
    await frame.getByRole('button', { name: 'Next' }).click()
    await expect(frame.getByLabel('Full name')).toBeFocused()
    await frame.getByLabel('Full name').fill('Ada Lovelace')
    await frame.getByLabel('Email').fill('ada@example.com')
    await frame.getByLabel('Postal code').fill('12')
    await frame.getByRole('button', { name: 'Next' }).click()
    await expect(frame.getByText('A postal code has 5 digits.')).toBeVisible() // the schema's message, on its field
    await frame.getByLabel('Postal code').fill('12345')
    await frame.getByRole('button', { name: 'Next' }).click()
    // Step 2, payment: the card number fails the schema's checksum, the expiry is in the past.
    await expect(frame.getByRole('heading', { name: 'Payment' })).toBeVisible()
    await frame.getByLabel('Card number').fill('4242 4242 4242 4241')
    await frame.getByLabel('Expiry (MM/YY)').fill('01/20')
    await frame.getByRole('button', { name: 'Next' }).click()
    await expect(frame.getByText("That card number isn't valid.")).toBeVisible()
    await expect(frame.getByText('That card has expired.')).toBeVisible()
    await frame.getByLabel('Card number').fill('4242 4242 4242 4242')
    await frame.getByLabel('Expiry (MM/YY)').fill('12/39')
    await frame.getByRole('button', { name: 'Next' }).click()
    // Step 3, review: what was entered, and the order placed.
    await expect(frame.getByRole('heading', { name: 'Review' })).toBeVisible()
    await expect(frame.getByText('Ada Lovelace, 12345')).toBeVisible()
    await expect(frame.getByText('•••• 4242')).toBeVisible()
    await frame.getByRole('button', { name: 'Place order' }).click()
    await expect(frame.getByRole('status')).toContainText('Thanks, Ada! Your order is placed.')
  })

  test('the Combobox example is the site\'s combobox file: search and pick in the preview', async ({ page }) => {
    await open(page)
    await page.getByLabel('Example').selectOption('Combobox')
    const frame = preview(page)
    const input = frame.getByRole('combobox', { name: 'Fruit' })
    await input.fill('ap')
    await expect(frame.getByRole('option')).toHaveText(['Apple', 'Apricot', 'Grape'])
    await input.press('Enter')
    await expect(input).toHaveValue('Apple')
  })

  test('the Attributes example: toggles, objects, a style property and a spread, all following state', async ({ page }) => {
    await open(page)
    await page.getByLabel('Example').selectOption('Attributes')
    const frame = preview(page)
    const card = frame.locator('.card')
    const classes = () => card.evaluate((el) => [...el.classList].filter((c) => !c.startsWith('cl-c-')).join(' '))
    await expect.poll(classes).toBe('card')
    await expect(card).toHaveAttribute('style', '--hue: 200;')
    await expect(card).toHaveAttribute('aria-pressed', 'false')
    await frame.getByRole('button', { name: 'Select' }).click()
    await expect.poll(classes).toBe('card selected')
    await expect(card).toHaveAttribute('aria-pressed', 'true')
    await frame.getByLabel('Big').check()
    await expect.poll(classes).toBe('card big selected') // written, the [class] object, then the toggle
    await expect(frame.locator('.title')).toHaveAttribute('style', /font-size: 1\.5em;/)
    await frame.getByLabel('Hue').fill('20')
    await expect(card).toHaveAttribute('style', '--hue: 20;')
    // A link from data: the javascript: URL never reaches the page.
    await expect(frame.locator('.unsafe')).toHaveAttribute('href', 'about:invalid#unsafe')
  })

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

  test('the caret and the borders are visible', async ({ page }) => {
    await open(page)
    await expect(preview(page).locator('button')).toBeVisible()
    const look = await page.evaluate(() => {
      const area = getComputedStyle(document.querySelector('#repl-code')!)
      const editor = getComputedStyle(document.querySelector('.repl-editor')!)
      const frame = getComputedStyle(document.querySelector('#repl-preview iframe:not([hidden])')!)
      const layer = getComputedStyle(document.querySelector('#repl-highlight')!)
      return { caret: area.caretColor, editor: editor.borderTopWidth, frame: frame.borderTopWidth, layer: layer.backgroundColor }
    })
    expect(look.layer).toBe('rgba(0, 0, 0, 0)') // the gutter's line numbers show through it
    expect(look.caret).not.toBe('rgba(0, 0, 0, 0)')
    expect(look.editor).not.toBe('0px')
    expect(look.frame).not.toBe('0px')
  })

  test('an endless loop is stopped with a message; the page stays usable', async ({ page }) => {
    await open(page)
    await type(page, '<script>\nlet n = state(0)\nwhile (true) { n++ }\n</script>\n<p>{{ n }}</p>\n')
    await expect(page.locator('.repl-errors')).toContainText('a loop ran for more than 1 second', { timeout: 10_000 })
    await type(page, counter)
    await expect(preview(page).locator('button')).toHaveText('Clicked 0')
  })

  test("edits don't pile up: one preview frame, and an old run's timers stop with it", async ({ page }) => {
    await open(page)
    const ticking = (label: string) => `<script>\nlet shown = state(0)\nsetInterval(() => { globalThis.n = (globalThis.n ?? 0) + 1; shown = globalThis.n }, 50)\n</script>\n<p id="t">${label} {{ shown }}</p>\n`
    for (let i = 1; i <= 6; i++) {
      await type(page, ticking(`run ${i}`))
      await expect(preview(page).locator('#t')).toContainText(`run ${i}`)
    }
    await expect(page.locator('#repl-preview iframe')).toHaveCount(1) // no frame left behind
    const read = async () => Number((await preview(page).locator('#t').textContent())!.split(' ').pop())
    const a = await read()
    await page.waitForTimeout(1000)
    expect((await read()) - a).toBeLessThan(60) // this run's own interval(s) only, not every earlier run's
  })

  test('an error thrown later, by an event handler, shows too', async ({ page }) => {
    await open(page)
    await type(page, '<script>\nfunction boom() { throw new Error("thrown on click") }\nlet n = state(0)\n</script>\n<button (click)="boom()">go {{ n }}</button>\n')
    await expect(preview(page).locator('button')).toHaveText('go 0') // this run's preview, not the example's
    await preview(page).locator('button').click()
    await expect(page.locator('.repl-errors')).toContainText('thrown on click')
  })

  test('errors are announced politely (a live region), not as alerts', async ({ page }) => {
    await open(page)
    await type(page, counter + '<p>\n')
    await expect(page.locator('[aria-live="polite"] .repl-errors')).toBeVisible()
    await expect(page.locator('[role="alert"]')).toHaveCount(0)
  })

  test('keyboard: Tab indents, Esc then Tab leaves the editor', async ({ page }) => {
    await open(page)
    await type(page, '')
    await code(page).focus()
    await page.keyboard.press('Tab')
    await page.keyboard.type('x')
    await expect(code(page)).toHaveValue('  x')
    await type(page, '')
    await code(page).focus()
    await page.keyboard.press('Tab')
    await page.keyboard.press('ControlOrMeta+z') // the indent is undone (not the edit before it)
    await expect(code(page)).toHaveValue('')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Escape')
    await page.keyboard.press('Tab')
    await expect(code(page)).not.toBeFocused()
  })

  test('the starter picker switches examples; over your own code it asks first', async ({ page }) => {
    await open(page)
    await page.getByLabel('Example').selectOption('Todo list')
    await expect(code(page)).toHaveValue(/@for/)
    await expect(preview(page).locator('li').first()).toBeVisible()
    await type(page, '<p>mine</p>\n')
    page.once('dialog', (d) => d.dismiss())
    await page.getByLabel('Example').selectOption('Counter')
    await expect(code(page)).toHaveValue('<p>mine</p>\n')
    page.once('dialog', (d) => d.accept())
    await page.getByLabel('Example').selectOption('Counter')
    await expect(code(page)).toHaveValue(/count/)
    // Picking the same example again works too (nothing to confirm: the code is the example's).
    await page.getByLabel('Example').selectOption('Counter')
    await expect(code(page)).toHaveValue(/count/)
  })

  test('the compiler runs in a worker: no page, /repl included, has it on its main thread', async () => {
    const { readdirSync, readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const dist = resolve(import.meta.dirname, '../dist')
    const manifest = JSON.parse(readFileSync(resolve(dist, 'clarusjs-manifest.json'), 'utf8'))
    expect(manifest.routes['/repl'].islands.map((i: { component: string }) => i.component)).toContain('repl')
    const marker = 'unexpected closing tag' // a compiler error message
    for (const [route, info] of Object.entries<{ js: { files: string[] } }>(manifest.routes)) {
      for (const file of info.js.files) expect(readFileSync(resolve(dist, 'client', file.replace(/^\//, '')), 'utf8'), `${route}: ${file}`).not.toContain(marker)
    }
    // It is in the site, in the worker's own file (else the check above proves nothing).
    const assets = readdirSync(resolve(dist, 'client/assets'), { recursive: true }) as string[]
    const holders = assets.filter((f) => f.endsWith('.js') && readFileSync(resolve(dist, 'client/assets', f), 'utf8').includes(marker))
    expect(holders.length).toBeGreaterThan(0)
    expect(holders.every((f) => /worker/i.test(f))).toBe(true)
  })

  test('the output tabs: server code, client code and the rendered HTML', async ({ page }) => {
    await open(page)
    await type(page, counter)
    await expect(preview(page).locator('button')).toHaveText('Clicked 0')
    await page.getByRole('tab', { name: 'Server code' }).click()
    await expect(page.getByRole('tabpanel')).toContainText('export function render')
    await page.getByRole('tab', { name: 'Client code' }).click()
    await expect(page.getByRole('tabpanel')).toContainText('export function attach')
    await page.getByRole('tab', { name: 'HTML' }).click()
    await expect(page.getByRole('tabpanel')).toContainText('<button')
    await expect(page.getByRole('tabpanel')).toContainText('Clicked <!--[0-->0<!--]-->')
    // A static component ships no client code, and says so.
    await type(page, '<p>static</p>\n')
    await page.getByRole('tab', { name: 'Client code' }).click()
    await expect(page.getByRole('tabpanel')).toContainText('ships no JavaScript')
    await page.getByRole('tab', { name: 'Preview' }).click()
    await expect(preview(page).locator('p')).toHaveText('static')
  })

  test('the tabs follow the keyboard: arrows move between them', async ({ page }) => {
    await open(page)
    await page.getByRole('tab', { name: 'Preview' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('tab', { name: 'Server code' })).toBeFocused()
    await expect(page.getByRole('tab', { name: 'Server code' })).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByRole('tab', { name: 'Preview' })).toHaveAttribute('aria-selected', 'true')
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
