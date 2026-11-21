import { expect, test, type Page } from '@playwright/test'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pagesNav } from '@clarusjs/theme-docs/nav.ts'
import { readPages } from '@clarusjs/theme-docs/vite.js'
import { sidebar } from '../src/sidebar.ts'
import AxeBuilder from '@axe-core/playwright'

// The site's sidebar, built the way themeDocs() and nav.ts build it.
const sections = pagesNav(sidebar, readPages(resolve(import.meta.dirname, '../src/pages')))

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
    const hrefs = await page.locator('.sidebar ul a').evaluateAll((links) => links.map((a) => a.getAttribute('href')!))
    expect(hrefs).toEqual(section.groups.flatMap((g) => g.items.map((i) => i.href)))
  }
  await page.goto('/guide/lists')
  await expect(page.locator('a.edit')).toHaveAttribute('href', /\/packages\/docs\/src\/pages\/guide\/lists\.md$/) // a Markdown page
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

test('the sidebar is generated from the pages: each Markdown page sits in its frontmatter group, in its order', async ({ page }) => {
  const dir = resolve(import.meta.dirname, '../src/pages/guide')
  const templates = readdirSync(dir).filter((f) => f.endsWith('.md'))
    .map((f) => readFileSync(resolve(dir, f), 'utf8'))
    .filter((text) => /^group: "Templates"$/m.test(text))
    .map((text) => ({ title: /^title: "?(.*?)"?$/m.exec(text)![1]!, order: Number(/^order: (\d+)$/m.exec(text)![1]) }))
    .sort((a, b) => a.order - b.order)
    .map((p) => p.title)
  await page.goto('/guide/holes')
  const group = page.locator('.sidebar p.group', { hasText: /^Templates$/ }).locator('xpath=following-sibling::ul[1]')
  const shown = await group.locator('a').allTextContents()
  // Verbatim is a .tscl page, placed by nav.ts.
  expect(shown.filter((t) => t !== 'Verbatim')).toEqual(templates)
  expect(shown).toContain('Verbatim')
})

test('named slot: a callout shows its filled title, or the fallback from its type', async ({ page }) => {
  await page.goto('/guide/state')
  await expect(page.locator('.callout.warning .callout-title')).toHaveText('Island props and state are public')
  await page.goto('/guide/attributes')
  await expect(page.locator('.callout.tip .callout-title')).toHaveText('Tip')
})

test('phone width: the page list is a drawer from ☰ that works without JavaScript (native popover)', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 800 }, javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/guide/lists')
  const sidebar = page.locator('.sidebar')
  await expect(sidebar).toBeHidden()
  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(sidebar).toBeVisible()
  await expect(sidebar.locator('a[aria-current="page"]')).toHaveText('Lists')
  await expect(sidebar.locator('.sidebar-links')).toContainText('GitHub') // the header's links live in the drawer
  await page.keyboard.press('Escape')
  await expect(sidebar).toBeHidden()
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
  // Every sidebar page, plus the pages dynamic routes generate (release notes per version, the client tour) and 404.
  const routes = Object.keys(manifest.routes)
  const generated = (r: string) => r.startsWith('/releases/') || r.startsWith('/tour/') || r === '/404'
  expect(routes.filter((r) => !generated(r)).sort()).toEqual(pages.map((p) => p.path).sort())
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

test('this site, explained: the table is generated from the manifest at build time', async ({ page }) => {
  const { readFileSync } = await import('node:fs')
  const manifest = JSON.parse(readFileSync(new URL('../dist/clarusjs-manifest.json', import.meta.url), 'utf8'))
  await page.goto('/guide/explained')
  const rows = page.locator('table.explained tbody tr')
  await expect(rows).toHaveCount(Object.keys(manifest.routes).length)
  const home = rows.filter({ has: page.locator('a[href="/"]') })
  for (const island of manifest.routes['/'].islands) await expect(home).toContainText(island.component)
  // The page lists itself, so it was rendered after the manifest existed.
  await expect(rows.filter({ has: page.locator('a[href="/guide/explained"]') })).toContainText('copy (interaction)')
})

test('release notes: one prerendered page per version in the changelog (a dynamic route)', async ({ page }) => {
  const { readFileSync } = await import('node:fs')
  const changelog = readFileSync(new URL('../../clarusjs/CHANGELOG.md', import.meta.url), 'utf8')
  const versions = [...changelog.matchAll(/^## (.+)$/gm)].map((m) => m[1]!.trim())
  expect(versions.length).toBeGreaterThan(0)
  await page.goto('/releases')
  await expect(page.locator('ul.releases a')).toHaveText(versions.map((v) => `clarusjs ${v}`))
  for (const v of versions) {
    const response = await page.goto(`/releases/${v}`)
    expect(response?.status(), v).toBe(200)
    await expect(page.locator('h1')).toHaveText(`clarusjs ${v}`)
    await expect(page.locator('.changes li').first()).toBeVisible()
  }
  // Inline code from the changelog is real <code>, and changes link to their pull requests.
  await page.goto(`/releases/${versions[0]}`)
  await expect(page.locator('.changes code').first()).toBeVisible()
  await expect(page.locator('.changes a[href*="/pull/"]').first()).toBeVisible()
  // Its edit link opens the version page's own source, not the index's.
  await expect(page.locator('a.edit')).toHaveAttribute('href', /\/src\/pages\/releases\/\[version\]\.tscl$/)
  expect((await page.goto('/releases/9.9.9'))?.status()).toBe(404)
})

test('release pages get their data from load() at build, and the manifest records it', async () => {
  const { readFileSync } = await import('node:fs')
  const manifest = JSON.parse(readFileSync(new URL('../dist/clarusjs-manifest.json', import.meta.url), 'utf8'))
  const releasePages = Object.keys(manifest.routes).filter((r) => r.startsWith('/releases/'))
  expect(releasePages.length).toBeGreaterThan(0)
  for (const r of releasePages) expect(manifest.routes[r].loader, r).toBe('build')
  expect(manifest.routes['/releases'].loader).toBeNull()
})

test('package-manager commands are spelled the way each manager spells them', async () => {
  const { command } = await import('../src/pm.ts')
  const table: Record<string, Record<string, string>> = {
    'add clarusjs': { pnpm: 'pnpm add clarusjs', npm: 'npm install clarusjs', yarn: 'yarn add clarusjs', bun: 'bun add clarusjs' },
    'add -D vite': { pnpm: 'pnpm add -D vite', npm: 'npm install -D vite', yarn: 'yarn add -D vite', bun: 'bun add -d vite' },
    'run check': { pnpm: 'pnpm run check', npm: 'npm run check', yarn: 'yarn check', bun: 'bun run check' },
    'exec vite build  # out': { pnpm: 'pnpm exec vite build  # out', npm: 'npx vite build  # out', yarn: 'yarn vite build  # out', bun: 'bunx vite build  # out' },
  }
  for (const [neutral, want] of Object.entries(table)) {
    for (const [manager, line] of Object.entries(want)) expect(command(manager as 'pnpm', neutral), `${manager}: ${neutral}`).toBe(line)
  }
})

test('package-manager tabs: one choice switches every group and is remembered across pages', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/guide/getting-started')
  const groups = page.locator('cl-island[c="pm"]')
  await expect(groups).toHaveCount(2)
  await expect(groups.first()).toHaveAttribute('data-cl-ready', '')
  await expect(groups.first().locator('code')).toHaveText('pnpm add clarusjs\npnpm add -D vite')
  await groups.first().getByRole('tab', { name: 'npm', exact: true }).click()
  await expect(groups.first().locator('code')).toHaveText('npm install clarusjs\nnpm install -D vite')
  await expect(groups.nth(1).locator('code')).toHaveText(/^npx vite /) // the other group followed
  await expect(groups.nth(1).getByRole('tab', { name: 'npm', exact: true })).toHaveAttribute('aria-selected', 'true')
  // The copy button copies what is shown.
  await groups.first().locator('button.copy').click()
  await expect(groups.first().locator('button.copy')).toHaveText('Copied')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('npm install clarusjs\nnpm install -D vite')
  // Remembered on the next page.
  await page.goto('/guide/type-checking')
  const next = page.locator('cl-island[c="pm"]').first()
  await expect(next).toHaveAttribute('data-cl-ready', '')
  await expect(next.locator('code')).toHaveText('npm install -D typescript')
})

test('package-manager tabs without JavaScript show the pnpm commands', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/guide/getting-started')
  await expect(page.locator('cl-island[c="pm"] code').first()).toHaveText('pnpm add clarusjs\npnpm add -D vite')
  await context.close()
})

test('server playground: rendered on every request, reading the request; escaped; not a static file', async ({ page }) => {
  const { existsSync, readFileSync } = await import('node:fs')
  expect(existsSync(new URL('../dist/client/playground', import.meta.url))).toBe(false)
  const manifest = JSON.parse(readFileSync(new URL('../dist/clarusjs-manifest.json', import.meta.url), 'utf8'))
  expect(manifest.routes['/playground']).toMatchObject({ mode: 'server', html: null, loader: 'request' })

  await page.goto('/playground')
  const first = await page.locator('#rendered-at time').getAttribute('datetime')
  await page.waitForTimeout(20)
  await page.reload()
  expect(await page.locator('#rendered-at time').getAttribute('datetime')).not.toBe(first) // a new render
  await expect(page.locator('#agent')).toContainText(await page.evaluate(() => navigator.userAgent.slice(0, 20)))

  // The form is a plain GET: the server renders the name, escaped.
  await page.fill('#name', '<img src=x onerror=alert(1)>')
  await page.click('form.playground button')
  await expect(page).toHaveURL(/\?name=/)
  await expect(page.locator('#greeting')).toHaveText('Hello, <img src=x onerror=alert(1)>!')
  await expect(page.locator('#greeting img')).toHaveCount(0)
  // The loader rendered a component by name with render(); its HTML is shown as text, escaped like any value.
  await expect(page.locator('#pill-html')).toHaveText(/^<span class="pill" data-cl-c="pill-[a-z0-9]+">&lt;img src=x onerror=alert\(1\)&gt;<\/span>$/)
})

test('the generated Netlify function serves only the server routes', async () => {
  const { readFileSync } = await import('node:fs')
  const fn = readFileSync(new URL('../.netlify/v1/functions/clarusjs-server.mjs', import.meta.url), 'utf8')
  expect(fn).toContain('import handler from "../../../dist/server/index.mjs"')
  // The page, and its fragment for fragment navigation.
  expect(fn).toContain('export const config = {"path":["/playground","/playground/","/playground/index.frag.html"],"preferStatic":true}')
})

test('client tour: rendered in the browser, navigated without reloads, islands attached', async ({ page }) => {
  const documents: string[] = []
  page.on('request', (req) => { if (req.resourceType() === 'document') documents.push(new URL(req.url()).pathname) })
  await page.goto('/tour/1')
  await expect(page.locator('h1')).toHaveText('A shell arrives')
  await expect(page).toHaveTitle('Client tour, step 1 · clarusjs')
  await expect(page.locator('cl-island[c="theme-toggle"]')).toHaveAttribute('data-cl-ready', '')
  await page.evaluate(() => { (window as { __tour?: boolean }).__tour = true })

  await page.click('nav.tour a.next')
  await expect(page).toHaveURL(/\/tour\/2$/)
  await expect(page.locator('h1')).toHaveText('The router renders')
  await page.click('nav.tour a.next')
  await expect(page.locator('h1')).toHaveText('No reload')
  await page.goBack()
  await expect(page.locator('h1')).toHaveText('The router renders')
  expect(await page.evaluate(() => (window as { __tour?: boolean }).__tour)).toBe(true) // same document all along
  expect(documents).toEqual(['/tour/1']) // one document request: the first shell
  await expect(page.locator('cl-island[c="theme-toggle"]')).toHaveAttribute('data-cl-ready', '')

  // Leaving the client routes is a normal page load: step 3's last link goes back to the guide.
  await page.click('nav.tour a.next')
  await expect(page.locator('h1')).toHaveText('No reload')
  await page.click('nav.tour a.next')
  await expect(page).toHaveURL(/\/guide\/client-routes\/?$/)
  await expect(page.locator('h1')).toHaveText('Client routes')
  expect(documents).toEqual(['/tour/1', '/guide/client-routes'])
  // A step that doesn't exist is a 404, as on any static host.
  expect((await page.goto('/tour/4'))?.status()).toBe(404)
})

test('client tour without JavaScript shows the shell message', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/tour/1')
  // Playwright's text locators skip <noscript>; innerText is what the visitor sees with scripting off.
  expect(await page.evaluate(() => document.body.innerText)).toContain('This page is rendered in the browser and needs JavaScript.')
  await context.close()
})

test('fragment navigation: no reloads, title and sidebar follow, the theme toggle is kept, back works', async ({ page }) => {
  const documents: string[] = []
  page.on('request', (req) => { if (req.resourceType() === 'document') documents.push(new URL(req.url()).pathname) })
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/guide/holes')
  const toggle = page.locator('[data-cl-persist="theme"] cl-island')
  await expect(toggle).toHaveAttribute('data-cl-ready', '')
  await toggle.locator('button').click() // system → light
  await page.evaluate(() => { (window as { __kept?: Element | null }).__kept = document.querySelector('[data-cl-persist="theme"] cl-island') })

  await page.locator('.sidebar a[href="/guide/lists"]').click()
  await expect(page).toHaveURL(/\/guide\/lists$/)
  await expect(page.locator('h1')).toHaveText('Lists')
  await expect(page).toHaveTitle('Lists · clarusjs')
  await expect(page.locator('.sidebar a[aria-current="page"]')).toHaveText('Lists')
  // The same toggle element, still on "light".
  expect(await page.evaluate(() => (window as { __kept?: Element | null }).__kept === document.querySelector('[data-cl-persist="theme"] cl-island'))).toBe(true)
  await expect(toggle.locator('button')).toHaveAttribute('aria-label', /light/)

  // Islands on the new page attach: the package-manager tabs on Getting started.
  await page.locator('.sidebar a[href="/guide/getting-started"]').click()
  await expect(page.locator('h1')).toHaveText('Getting started')
  await expect(page.locator('cl-island[c="pm"]').first()).toHaveAttribute('data-cl-ready', '')

  await page.goBack()
  await expect(page.locator('h1')).toHaveText('Lists')
  await page.goForward()
  await expect(page.locator('h1')).toHaveText('Getting started')
  expect(documents).toEqual(['/guide/holes']) // one document for the whole visit
})

test('fragment navigation reaches server routes; client routes and failures load normally', async ({ page }) => {
  const documents: string[] = []
  page.on('request', (req) => { if (req.resourceType() === 'document') documents.push(new URL(req.url()).pathname) })
  await page.goto('/guide/rendering-modes')
  await page.locator('a[href="/playground"]').first().click()
  await expect(page.locator('h1')).toHaveText('Server playground')
  await expect(page.locator('#pill-html')).toHaveText(/^<span class="pill" data-cl-c="pill-[a-z0-9]+">guest<\/span>$/) // rendered by the server for this request
  expect(documents).toEqual(['/guide/rendering-modes'])
  // A client route has no fragment: the browser loads it normally, then the router renders it.
  await page.goto('/guide/client-routes')
  await page.locator('a[href="/tour/1"]').click()
  await expect(page.locator('h1')).toHaveText('A shell arrives')
  expect(documents).toContain('/tour/1')
})

test('fragment navigation to a missing page with a #hash loads it normally (no stale page)', async ({ page }) => {
  const documents: string[] = []
  page.on('request', (req) => { if (req.resourceType() === 'document') documents.push(new URL(req.url()).pathname) })
  await page.goto('/guide/holes')
  await expect(page.locator('[data-cl-persist="theme"] cl-island')).toHaveAttribute('data-cl-ready', '')
  await page.evaluate(() => { (globalThis as { navigation?: { navigate(u: string): unknown } }).navigation!.navigate('/nope#details') })
  await expect(page).toHaveURL(/\/nope#details$/)
  await expect.poll(() => documents).toEqual(['/guide/holes', '/nope']) // the missing page was really loaded
  await expect(page.locator('h1')).toHaveText('Page not found') // the Holes page is gone; the 404 page loaded
})

test('component styles: scoped with @scope, from one stylesheet, not leaking', async ({ page }) => {
  await page.goto('/guide/state')
  const warning = page.locator('aside.callout.warning')
  await expect(warning).toHaveAttribute('data-cl-c', /^callout-/)
  expect(await warning.evaluate((el) => getComputedStyle(el).borderLeftColor)).toBe('rgb(201, 138, 18)')
  expect(await warning.locator('p').last().evaluate((el) => getComputedStyle(el).marginBottom)).toBe('0px')
  // The callout's p:last-child rule stays inside callouts.
  const outside = await page.evaluate(() => {
    const div = document.createElement('div')
    div.innerHTML = '<p>outside</p>'
    document.querySelector('main')!.append(div)
    return getComputedStyle(div.firstElementChild!).marginBottom
  })
  expect(outside).toBe('16px')
  const sheets = await page.locator('link[rel="stylesheet"]').evaluateAll((links) => links.map((l) => l.getAttribute('href')))
  expect(sheets.some((h) => /\/assets\/cl-styles-.+\.css$/.test(h!))).toBe(true)
})

test('component styles reach components rendered inside islands', async ({ page }) => {
  await page.goto('/')
  const pill = page.locator('cl-island[c="todo"] .pill').first()
  await expect(pill).toBeVisible()
  expect(await pill.evaluate((el) => getComputedStyle(el).borderRadius)).toBe('999px')
})

test('no theme flash: the saved theme is on <html> before any module script runs', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('clarusjs-theme', 'dark') } catch {} })
  await page.route('**/assets/**/*.js', (route) => route.abort()) // no island, loader or navigation code at all
  await page.goto('/guide/holes')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe('rgb(251, 252, 252)')
})

test('the saved theme survives fragment navigation and client routes (the router runs inline head scripts)', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('clarusjs-theme', 'dark') } catch {} })
  await page.goto('/guide/holes')
  await page.locator('.sidebar a[href="/guide/lists"]').click()
  await expect(page.locator('h1')).toHaveText('Lists')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  // On a client route, block the theme toggle's own code: only the page's inline head script can set the theme.
  await page.route('**/theme-toggle-*.js', (route) => route.abort())
  await page.goto('/tour/1')
  await expect(page.locator('h1')).toHaveText('A shell arrives')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('the theme and site stylesheets go through Vite: imported by the layouts, hashed, linked before the component styles', async ({ page }) => {
  const response = await page.goto('/guide/styles')
  expect(response?.status()).toBe(200)
  const hrefs = await page.locator('head link[rel="stylesheet"]').evaluateAll((links) => links.map((l) => l.getAttribute('href')!))
  expect(hrefs[0]).toMatch(/^\/assets\/.*theme-[\w-]+\.css$/) // @clarusjs/theme-docs, imported by its layout
  expect(hrefs[1]).toMatch(/^\/assets\/.*docs-[\w-]+\.css$/) // this site's own, after the theme so it can override
  expect(hrefs[2]).toMatch(/^\/assets\/cl-styles-[\w-]+\.css$/)
  expect((await page.request.get('/docs.css')).status()).toBe(404) // no longer a raw public file
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.site-header')!).borderBottomStyle)).toBe('solid')
})

test('a Markdown page renders in the layout, with anchors, a component and the right edit link', async ({ page }) => {
  await page.goto('/guide/what-is-clarusjs')
  await expect(page.locator('h1')).toHaveText(/What is clarusjs\?/)
  await expect(page).toHaveTitle('What is clarusjs? · clarusjs')
  await expect(page.locator('h2#what-makes-it-different a.header-anchor')).toHaveAttribute('href', '#what-makes-it-different')
  await expect(page.locator('.sidebar a[aria-current="page"]')).toHaveText('What is clarusjs?')
  await expect(page.locator('aside.callout.info').filter({ hasText: 'proving ground' })).toContainText('This page is written in Markdown.')
  await expect(page.locator('main li code').first()).toHaveText('<script>')
  await expect(page.locator('a.edit')).toHaveAttribute('href', /\/src\/pages\/guide\/what-is-clarusjs\.md$/)
})

test('Markdown containers and alerts render as the site callouts; details is native', async ({ page }) => {
  await page.goto('/guide/markdown')
  const warning = page.locator('aside.callout.warning').filter({ hasText: 'This block was written as' })
  await expect(warning.locator('.callout-title')).toHaveText('A title from the Markdown')
  expect(await warning.evaluate((el) => getComputedStyle(el).borderLeftColor)).toBe('rgb(201, 138, 18)') // the component's own styles
  await expect(page.locator('aside.callout.tip').filter({ hasText: 'GitHub alert' }).locator('.callout-title')).toHaveText('Tip')
  const details = page.locator('details.custom-block')
  await expect(details.locator('summary')).toHaveText('What does a container compile to?')
  await expect(details.locator('p')).toBeHidden()
  await details.locator('summary').click()
  await expect(details.locator('p')).toBeVisible()
})

test('highlighted code: colours follow the theme, code groups switch without JavaScript, copy skips removed lines', async ({ page, browser, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/guide/markdown')
  // The theme toggle applies the saved or system theme when it attaches: let it, then switch to dark.
  await expect(page.locator('[data-cl-persist="theme"] cl-island')).toHaveAttribute('data-cl-ready', '')
  // A token whose light and dark colours differ (comments are the same grey in both GitHub themes).
  const colour = () => page.evaluate(() => {
    const span = [...document.querySelectorAll<HTMLElement>('.code-block .shiki span[style]')]
      .find((el) => el.style.getPropertyValue('--shiki-light') !== el.style.getPropertyValue('--shiki-dark'))!
    return getComputedStyle(span).color
  })
  const light = await colour()
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  expect(await colour()).not.toBe(light)
  await expect(page.locator('.code-block.language-ts .line.highlighted')).toHaveCount(1)
  // Copy: the diff block without its removed line.
  const diffBlock = page.locator('.code-block').filter({ has: page.locator('.diff.remove') })
  await diffBlock.locator('button.copy').click()
  await expect(diffBlock.locator('button.copy')).toHaveText('Copied')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('const site = clarusjs({ sources: [markdown()] }) ')

  const noJs = await browser.newContext({ javaScriptEnabled: false })
  const p2 = await noJs.newPage()
  await p2.goto('/guide/markdown')
  const group = p2.locator('.code-group')
  await expect(group.locator('.code-block').nth(0)).toBeVisible()
  await expect(group.locator('.code-block').nth(1)).toBeHidden()
  await group.locator('label', { hasText: 'npm' }).filter({ hasNotText: 'pnpm' }).click()
  await expect(group.locator('.code-block').nth(1)).toBeVisible()
  await expect(group.locator('.code-block').nth(0)).toBeHidden()
  await noJs.close()
})

test('snippets show real source files; includes share Markdown between pages', async ({ page }) => {
  await page.goto('/guide/markdown')
  const snippet = page.locator('.code-block').filter({ has: page.locator('.code-title', { hasText: 'src/nav.ts' }) })
  await expect(snippet.locator('code')).toContainText('export function sourceOf(path: string)')
  await expect(snippet.locator('code')).not.toContainText('#region')
  for (const path of ['/guide/markdown', '/guide/what-is-clarusjs']) {
    await page.goto(path)
    const box = page.locator('aside.callout.info').filter({ hasText: 'Node 22.12' })
    await expect(box.locator('.callout-title'), path).toHaveText('Requirements')
    await expect(box.locator('a'), path).toHaveAttribute('href', '/guide/getting-started')
  }
})

test('head: title template, site tags, transformHead, and Markdown frontmatter tags', async ({ page }) => {
  await page.goto('/guide/markdown')
  await expect(page).toHaveTitle('Markdown pages · clarusjs')
  const head = page.locator('head')
  await expect(head.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0b6e70')
  await expect(head.locator('link[rel="icon"]')).toHaveAttribute('href', '/logo.svg')
  await expect(head.locator('meta[name="generator"]')).toHaveAttribute('content', 'clarusjs')
  await expect(head.locator('meta[name="keywords"]')).toHaveAttribute('content', /markdown/)
  await expect(page.locator('body cl-head')).toHaveCount(0)
  await page.goto('/')
  await expect(page).toHaveTitle('Clear, compiled views · clarusjs')
  await expect(page.locator('head meta[name="keywords"]')).toHaveCount(0)
})

test('JSON-LD: the site WebSite entry and a TechArticle per page, as valid JSON', async ({ page }) => {
  await page.goto('/guide/markdown')
  const data = await page.locator('script[type="application/ld+json"]').evaluateAll((els) => els.map((e) => JSON.parse(e.textContent!)))
  expect(data).toContainEqual(expect.objectContaining({ '@type': 'WebSite', name: 'clarusjs' }))
  expect(data).toContainEqual(expect.objectContaining({ '@type': 'TechArticle', headline: 'Markdown pages', url: 'https://clarusjs.com/guide/markdown' }))
})

test('canonical URL and social cards from site.url; the card image exists', async ({ page, request }) => {
  await page.goto('/guide/markdown')
  const head = page.locator('head')
  await expect(head.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://clarusjs.com/guide/markdown')
  await expect(head.locator('meta[property="og:title"]')).toHaveAttribute('content', 'Markdown pages')
  await expect(head.locator('meta[property="og:description"]')).toHaveAttribute('content', /Write pages in Markdown/)
  await expect(head.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://clarusjs.com/og.png')
  await expect(head.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image')
  const png = await request.get('/og.png')
  expect(png.headers()['content-type']).toBe('image/png')
})

test('sitemap.xml lists static pages with dates, but not client routes', async ({ request }) => {
  const xml = await (await request.get('/sitemap.xml')).text()
  expect(xml).toMatch(/<url><loc>https:\/\/clarusjs\.com\/guide\/markdown<\/loc><lastmod>\d{4}-\d{2}-\d{2}<\/lastmod><\/url>/)
  expect(xml).toContain('<loc>https://clarusjs.com/</loc>')
  expect(xml).not.toContain('/tour/')
})

test('an unknown address gets the 404 page with status 404, and its links work at any depth', async ({ page, request }) => {
  const res = await page.goto('/no/such/page')
  expect(res!.status()).toBe(404)
  await expect(page.locator('h1')).toHaveText('Page not found')
  await page.getByRole('link', { name: 'Get started' }).click()
  await expect(page).toHaveURL(/\/guide\/getting-started$/)
  expect(await (await request.get('/robots.txt')).text()).toBe('User-agent: *\nAllow: /\n\nSitemap: https://clarusjs.com/sitemap.xml\n')
  expect(await (await request.get('/sitemap.xml')).text()).not.toContain('/404')
})

test('a11y: skip link first, landmarks, and the current page marked', async ({ page }) => {
  await page.goto('/guide/markdown')
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Skip to content' })
  await expect(skip).toBeFocused()
  await expect(skip).toBeVisible() // shown once focused
  await page.keyboard.press('Enter')
  await expect(page.locator('main#content')).toBeFocused()
  await expect(page.getByRole('banner')).toHaveCount(1)
  await expect(page.getByRole('main')).toHaveCount(1)
  await expect(page.getByRole('contentinfo')).toHaveCount(1)
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name: 'Markdown pages' })).toHaveAttribute('aria-current', 'page')
})

test('a11y: axe finds no violations (landmarks, names, ARIA) on representative pages', async ({ page }) => {
  for (const path of ['/', '/guide/markdown', '/guide/state', '/reference/vite-plugin', '/no/such/page', '/tour/1']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const { violations } = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze() // contrast: #122
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`), path).toEqual([])
  }
})

test('a11y: after fragment navigation, focus is on the new heading and the title is announced', async ({ page }) => {
  await page.goto('/guide/holes')
  await expect(page.locator('[data-cl-persist="theme"] cl-island')).toHaveAttribute('data-cl-ready', '')
  await page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name: 'Lists' }).click()
  await expect(page.locator('h1')).toHaveText('Lists')
  await expect(page.locator('h1')).toBeFocused()
  await expect(page.locator('#cl-live')).toHaveAttribute('aria-live', 'polite')
  await expect(page.locator('#cl-live')).toHaveText('Lists · clarusjs')
  // A link to a #hash on another page focuses its target.
  await page.goto('/guide/holes')
  await expect(page.locator('[data-cl-persist="theme"] cl-island')).toHaveAttribute('data-cl-ready', '')
  await page.evaluate(() => { (globalThis as { navigation?: { navigate(u: string): unknown } }).navigation!.navigate('/guide/markdown#links') })
  await expect(page.locator('h2#links')).toBeFocused()
})

test('a11y: after a client route render, focus is on the new heading and the title is announced', async ({ page }) => {
  await page.goto('/tour/1')
  await expect(page.locator('cl-island[c="theme-toggle"]')).toHaveAttribute('data-cl-ready', '')
  await page.click('nav.tour a.next')
  await expect(page.locator('h1')).toHaveText('The router renders')
  await expect(page.locator('h1')).toBeFocused()
  await expect(page.locator('#cl-live')).toHaveText('Client tour, step 2 · clarusjs')
})

test('a11y: text and code highlighting meet WCAG AA contrast, in light and dark', async ({ page }) => {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    for (const path of ['/', '/guide/markdown', '/guide/state', '/reference/vite-plugin', '/no/such/page']) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const { violations } = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()
      const found = violations.flatMap((v) => v.nodes.map((n) => `${n.target.join(' ')}: ${n.any[0]?.message.split(' (')[0] ?? ''} ${JSON.stringify(n.any[0]?.data ?? {})}`))
      expect(found, `${scheme} ${path}`).toEqual([])
    }
  }
})

test('a11y: reduced motion turns transitions off; the phone drawer opens over the page and closes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const counter = page.locator('.counter').first()
  expect(await counter.evaluate((el) => getComputedStyle(el).transitionDuration)).toMatch(/^(0s|1e-05s|0\.00001s)(, (0s|1e-05s|0\.00001s))*$/)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  expect(await counter.evaluate((el) => getComputedStyle(el).transitionDuration)).toContain('0.12s')

  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/guide/markdown')
  await page.getByRole('button', { name: 'Open menu' }).click()
  const list = page.getByRole('navigation', { name: 'Pages' })
  await expect(list).toBeVisible()
  expect(await list.evaluate((el) => getComputedStyle(el).position)).toBe('fixed') // a drawer over the page
  await page.getByRole('button', { name: 'Close the menu' }).click()
  await expect(list).toBeHidden()
})

test('review: a release page\'s TechArticle points at that release, not the release index', async ({ page }) => {
  const { readdirSync } = await import('node:fs')
  const version = readdirSync(new URL('../dist/client/releases/', import.meta.url)).find((d) => /^\d/.test(d))!
  await page.goto(`/releases/${version}`)
  const data = await page.locator('script[type="application/ld+json"]').evaluateAll((els) => els.map((e) => JSON.parse(e.textContent!)))
  expect(data).toContainEqual(expect.objectContaining({ '@type': 'TechArticle', url: `https://clarusjs.com/releases/${version}` }))
})

test('review: after the skip link, keyboard focus on <main> stays visible', async ({ page }) => {
  await page.goto('/guide/markdown')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await expect(page.locator('main#content')).toBeFocused()
  expect(await page.locator('main#content').evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none')
})

test('theme regions: header, sidebar, content and "On this page" at desktop, laptop and tablet widths', async ({ page }) => {
  // Desktop: "On this page" is a column, social links are icons.
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/guide/markdown')
  const toc = page.getByRole('complementary', { name: 'On this page' })
  await expect(toc).toBeVisible()
  await expect(toc.getByRole('link', { name: 'Snippets and includes' })).toHaveAttribute('href', '#snippets-and-includes')
  await expect(page.locator('details.toc-inline')).toBeHidden()
  await expect(page.locator('.social').getByRole('link', { name: 'npm' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'More links' })).toBeHidden()
  await expect(page.getByRole('navigation', { name: 'Pages' })).toBeVisible()
  // Laptop: the column becomes a box above the content; social links fold into ⋯.
  await page.setViewportSize({ width: 1100, height: 900 })
  await expect(toc).toBeHidden()
  await expect(page.locator('details.toc-inline')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Pages' })).toBeVisible()
  await page.getByRole('button', { name: 'More links' }).click()
  await expect(page.locator('#more').getByRole('link', { name: 'GitHub' })).toBeVisible()
  await page.keyboard.press('Escape')
  // Tablet: the sidebar is a drawer from ☰.
  await page.setViewportSize({ width: 820, height: 1100 })
  await expect(page.getByRole('navigation', { name: 'Pages' })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible()
  await expect(page.locator('details.toc-inline')).toBeVisible()
  // The header stays at the top while reading.
  await page.mouse.wheel(0, 2000)
  await expect(page.locator('header.site-header')).toBeInViewport()
})
