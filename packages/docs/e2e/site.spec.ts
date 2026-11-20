import { expect, test, type Page } from '@playwright/test'
import { sections } from '../src/nav.ts'

// Every page in the sidebar, in sidebar order, plus the home page.
const docs = sections.flatMap((s) => s.groups.flatMap((g) => g.items.map((i) => ({ path: i.href, title: i.title, section: s.key }))))
const pages = [{ path: '/', title: 'clarusjs' }, ...docs]
const guides = docs
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Collect console errors and script requests while visiting a page. */
async function visit(page: Page, path: string) {
  const errors: string[] = []
  const scripts: string[] = []
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })
  page.on('pageerror', (err) => errors.push(err.message))
  page.on('request', (req) => { if (req.resourceType() === 'script') scripts.push(req.url()) })
  const response = await page.goto(path)
  await page.waitForLoadState('networkidle')
  return { response, errors, scripts }
}

for (const { path, title } of pages) {
  test(`${path} renders with its own title and no console errors`, async ({ page }) => {
    const { response, errors } = await visit(page, path)
    expect(response?.status()).toBe(200)
    await expect(page).toHaveTitle(new RegExp(esc(title)))
    await expect(page).toHaveTitle(/clarusjs/)
    await expect(page.locator('h1')).toHaveCount(1)
    expect(errors).toEqual([])
  })
}

for (const { path } of guides) {
  test(`${path} loads only the loader and the theme toggle`, async ({ page }) => {
    const { response, scripts } = await visit(page, path)
    expect(response?.status()).toBe(200)
    await expect(page.locator('h1')).toHaveCount(1)
    // The page itself, its layout and its text ship nothing; copy buttons load only when used.
    expect(scripts.every((s) => new URL(s).pathname.startsWith('/assets/'))).toBe(true)
    expect(scripts.some((s) => /cl-loader-.+\.js$/.test(s))).toBe(true)
    expect(scripts.some((s) => /theme-toggle-.+\.js$/.test(s))).toBe(true)
    expect(scripts.some((s) => /copy-.+\.js$/.test(s))).toBe(false)
  })
}

test('every header nav link, followed as written, lands on a page', async ({ page }) => {
  await page.goto('/')
  const hrefs = (await page.locator('header nav a').evaluateAll((links) => links.map((a) => a.getAttribute('href')!)))
    .filter((href) => href.startsWith('/')) // the site's own pages; external links are not ours to test
  expect(hrefs).toEqual(sections.map((s) => s.href))
  for (const href of hrefs) {
    const response = await page.goto(href)
    expect(response?.status(), href).toBe(200)
    await expect(page.locator('h1'), href).toHaveCount(1)
  }
})

test('trailing-slash URLs resolve too', async ({ page }) => {
  const response = await page.goto('/guide/islands/')
  expect(response?.status()).toBe(200)
  await expect(page.locator('h1')).toHaveText(/Islands/)
})

test('home: only the loader and island code load, and the counter island works', async ({ page }) => {
  const { scripts, errors } = await visit(page, '/')
  expect(scripts.some((s) => /cl-loader-.+\.js$/.test(s))).toBe(true)
  expect(scripts.every((s) => /\/assets\//.test(s))).toBe(true)
  const islands = page.locator('cl-island[c="counter"]')
  await expect(islands).toHaveCount(1)
  await expect(islands).toHaveAttribute('s', '{"count":0}') // the state the server rendered with
  await expect(islands).toHaveAttribute('data-cl-ready', '')
  const button = islands.locator('button')
  const before = await page.locator('main').textContent()
  await button.click()
  await expect(button).toContainText('Clicked 1 time')
  const after = await page.locator('main').textContent()
  expect(after?.replace(/Clicked \d+ times? \(double: \d+\)/, '')).toBe(before?.replace(/Clicked \d+ times? \(double: \d+\)/, ''))
  expect(errors).toEqual([])
})

test('code samples show template syntax literally (verbatim)', async ({ page }) => {
  await page.goto('/')
  const sample = page.locator('pre code').first()
  await expect(sample).toContainText('{{ count }}')
  await expect(sample).toContainText('<script>')
  await expect(sample).toContainText('@input start: number = 0')
  await page.goto('/guide/verbatim')
  await expect(page.locator('pre').filter({ hasText: '<code verbatim>' })).toContainText('<p>Hello, {{ name }}!</p>')
})

test('the sidebar marks the current page, the header its section, and each page has its own description', async ({ page }) => {
  const descriptions = new Set<string>()
  for (const { path, section } of docs) {
    await page.goto(path)
    const current = page.locator('.sidebar a[aria-current="page"]')
    await expect(current, path).toHaveCount(1)
    await expect(current, path).toHaveAttribute('href', path)
    await expect(page.locator('header nav a[aria-current]'), path).toHaveAttribute('href', sections.find((s) => s.key === section)!.href)
    descriptions.add((await page.locator('meta[name="description"]').getAttribute('content'))!)
  }
  expect(descriptions.size).toBe(docs.length)
  await page.goto('/')
  await expect(page.locator('header nav a[aria-current]')).toHaveCount(0)
  await expect(page.locator('.sidebar')).toHaveCount(0)
})

test('every sidebar link lands on a page, and the edit link points at its source', async ({ page }) => {
  await page.goto('/guide/what-is-clarusjs')
  for (const section of sections) {
    await page.goto(section.href)
    const hrefs = await page.locator('.sidebar a').evaluateAll((links) => links.map((a) => a.getAttribute('href')!))
    expect(hrefs).toEqual(section.groups.flatMap((g) => g.items.map((i) => i.href)))
  }
  await page.goto('/guide/lists')
  await expect(page.locator('a.edit')).toHaveAttribute('href', /\/packages\/docs\/src\/pages\/guide\/lists\.clarus$/)
  await expect(page.locator('.crumb')).toHaveText('Guide › Templates')
})

test('home: the "what ships" island switches @if branches in the browser', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  const chunks: string[] = []
  page.on('request', (req) => { if (/what-ships-.+\.js$/.test(req.url())) chunks.push(req.url()) })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const island = page.locator('cl-island[c="what-ships"]')
  await expect(island).toHaveAttribute('a', 'interaction')
  expect(chunks).toEqual([]) // attach="interaction": no code until it's used
  const toggle = island.locator('button.toggle')
  await expect(island.locator('ul.ships')).toHaveCount(0)
  await toggle.click() // loads the island, and this click is replayed once it attaches
  await expect(island).toHaveAttribute('data-cl-ready', '')
  expect(chunks).toHaveLength(1)
  await expect(island.locator('ul.ships li')).toHaveCount(3)
  await expect(toggle).toHaveText('Hide')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await toggle.click()
  await expect(island.locator('ul.ships')).toHaveCount(0)
  await expect(toggle).toHaveText('What ships to the browser?')
  expect(errors).toEqual([])
})

test('a server-side @if in the layout: docs pages get the sidebar and breadcrumb, home does not', async ({ page }) => {
  await page.goto('/guide/islands')
  await expect(page.locator('.crumb')).toHaveText('Guide › Interactivity')
  await page.goto('/')
  await expect(page.locator('.crumb')).toHaveCount(0)
  await expect(page.locator('main.home')).toHaveCount(1)
})

test('home: the list island adds and removes rows by key, with @empty', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  await page.goto('/')
  const todo = page.locator('cl-island[c="todo"]')
  await expect(todo).toHaveAttribute('data-cl-ready', '')
  const rows = todo.locator('.todo-list li:not(.empty)')
  await expect(rows).toHaveText(['Read the islands guide ×'])
  const input = todo.locator('input[name="item"]')
  await input.fill('Write a component')
  await input.press('Enter')
  await input.fill('Ship it')
  await todo.locator('button[type="submit"]').click()
  await expect(rows.locator('span')).toHaveText(['Read the islands guide', 'Write a component', 'Ship it'])
  await expect(input).toHaveValue('')
  await expect(todo.locator('.pill')).toHaveText('3 items') // a stateless child whose props read the island's state
  const kept = await rows.nth(2).elementHandle()
  await todo.getByRole('button', { name: 'Remove Write a component' }).click()
  await expect(rows.locator('span')).toHaveText(['Read the islands guide', 'Ship it'])
  expect(await kept!.evaluate((el) => el.isConnected)).toBe(true)
  await todo.getByRole('button', { name: 'Remove Read the islands guide' }).click()
  await todo.getByRole('button', { name: 'Remove Ship it' }).click()
  await expect(todo.locator('.todo-list .empty')).toHaveText('Nothing yet.')
  await expect(todo.locator('.pill')).toHaveText('0 items')
  expect(errors).toEqual([])
})

test('previous and next follow sidebar order within each section', async ({ page }) => {
  for (const section of sections) {
    const items = section.groups.flatMap((g) => g.items)
    for (const [i, item] of items.entries()) {
      await page.goto(item.href)
      const prev = page.locator('.pager a.prev')
      const next = page.locator('.pager a.next')
      if (i === 0) await expect(prev, item.href).toHaveCount(0)
      else await expect(prev, item.href).toHaveAttribute('href', items[i - 1]!.href)
      if (i === items.length - 1) await expect(next, item.href).toHaveCount(0)
      else await expect(next, item.href).toHaveAttribute('href', items[i + 1]!.href)
    }
  }
})

test('named slot: a callout shows its filled title, or the fallback from its type', async ({ page }) => {
  await page.goto('/guide/state')
  await expect(page.locator('.callout.warning .callout-title')).toHaveText('Island props and state are public')
  await page.goto('/guide/attributes')
  await expect(page.locator('.callout.tip .callout-title')).toHaveText('Tip')
})

test('phone width: the page list opens from the Menu button without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 800 }, javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/guide/lists')
  const sidebar = page.locator('.sidebar')
  await expect(sidebar).toBeHidden()
  await page.getByText('Menu', { exact: true }).click()
  await expect(sidebar).toBeVisible()
  await expect(sidebar.locator('a[aria-current="page"]')).toHaveText('Lists')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await context.close()
})

test('home: two islands share the to-do store', async ({ page }) => {
  await page.goto('/')
  const summary = page.locator('cl-island[c="todo-summary"]')
  await expect(summary).toHaveAttribute('data-cl-ready', '')
  await expect(summary.locator('strong')).toHaveText('1')
  const todo = page.locator('cl-island[c="todo"]')
  await expect(todo).toHaveAttribute('data-cl-ready', '')
  await todo.locator('input[name="item"]').fill('Shared')
  await todo.locator('input[name="item"]').press('Enter')
  await expect(summary.locator('strong')).toHaveText('2')
  await expect(summary).toContainText('2 items')
})

test('theme toggle cycles system → light → dark and is remembered across pages', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/guide/islands')
  const toggle = page.locator('cl-island[c="theme-toggle"] button')
  await expect(page.locator('cl-island[c="theme-toggle"]')).toHaveAttribute('data-cl-ready', '')
  await expect(toggle).toHaveAttribute('aria-label', /system/)
  await toggle.click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await toggle.click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(bg).not.toBe('rgb(251, 252, 252)') // dark tokens apply even though the system is light
  await page.goto('/guide/build')
  await expect(page.locator('cl-island[c="theme-toggle"]')).toHaveAttribute('data-cl-ready', '')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await toggle.click()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
})

test('copy buttons load on first click and copy their sample', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const chunks: string[] = []
  page.on('request', (req) => { if (/copy-.+\.js$/.test(req.url())) chunks.push(req.url()) })
  await page.goto('/guide/getting-started')
  await page.waitForLoadState('networkidle')
  expect(chunks).toEqual([])
  const sample = page.locator('.sample').first()
  const button = sample.locator('button.copy')
  await button.click() // loads the island; the click is replayed once it attaches
  await expect(button).toHaveText('Copied')
  expect(chunks).toHaveLength(1)
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toBe(await sample.locator('code').textContent())
})

test('the route manifest matches what the browser loads', async ({ page }) => {
  const { readFileSync } = await import('node:fs')
  const manifest = JSON.parse(readFileSync(new URL('../dist/clarusjs-manifest.json', import.meta.url), 'utf8'))
  expect(Object.keys(manifest.routes).sort()).toEqual(pages.map((p) => p.path).sort())
  for (const path of ['/', '/guide/state']) {
    const route = manifest.routes[path]
    const { scripts } = await visit(page, path)
    const loaded = [...new Set(scripts.map((s) => new URL(s).pathname.slice(1)))].sort()
    const initial = route.js.files.filter((f: string) => !route.islands.some((i: { src: string; attach: string }) => i.src === f && i.attach !== 'load'))
    expect(loaded, path).toEqual([...initial].sort())
    page.removeAllListeners()
  }
})

test('clarusjs explain names the islands the page really has', async ({ page }) => {
  const { spawnSync } = await import('node:child_process')
  const { fileURLToPath } = await import('node:url')
  const cli = fileURLToPath(new URL('../../clarusjs/src/cli/index.ts', import.meta.url))
  const root = fileURLToPath(new URL('..', import.meta.url))
  const run = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', cli, 'explain', '/guide/state', '--root', root, '--json'], { encoding: 'utf8' })
  expect(run.status, run.stderr).toBe(0)
  const explained = JSON.parse(run.stdout).islands.map((i: { component: string; count: number }) => [i.component, i.count])
  await page.goto('/guide/state')
  const names = await page.locator('cl-island').evaluateAll((els) => els.map((e) => e.getAttribute('c')!))
  const found = [...new Set(names)].map((n) => [n, names.filter((x) => x === n).length])
  expect(explained).toEqual(found)
})
