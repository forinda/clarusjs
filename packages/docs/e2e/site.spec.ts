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
  await expect(page.locator('a.edit')).toHaveAttribute('href', /\/packages\/docs\/src\/pages\/guide\/lists\.tscl$/)
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
  // Every sidebar page, plus the pages dynamic routes generate (release notes per version, the client tour).
  const routes = Object.keys(manifest.routes)
  const generated = (r: string) => r.startsWith('/releases/') || r.startsWith('/tour/')
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
  await expect(page.locator('#pill-html')).toHaveText('<span class="pill">&lt;img src=x onerror=alert(1)&gt;</span>')
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
  await expect(page.locator('#pill-html')).toHaveText('<span class="pill">guest</span>') // rendered by the server for this request
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
  await expect(page.locator('h1')).toHaveCount(0) // the Holes page is gone
})
