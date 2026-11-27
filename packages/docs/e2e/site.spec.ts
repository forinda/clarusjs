import { expect, test, type Page } from '@playwright/test'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pagesNav } from '@clarusjs/theme-docs/nav.ts'
import { readPages } from '@clarusjs/theme-docs/vite.js'
import { sidebar } from '../src/sidebar.ts'
import AxeBuilder from '@axe-core/playwright'

// The site's sidebar, built the way themeDocs() and nav.ts build it.
const sections = pagesNav(sidebar, readPages(resolve(import.meta.dirname, '../src/pages')))

// Docs (Guide, Reference) have the sidebar, edit links and pager; Learn's lessons use the lesson layout, and the
// playground is an app (the theme's `app` layout: no sidebar). Both are still among `pages` below.
const docSections = sections.filter((s) => s.key !== 'learn' && s.key !== 'repl')
const items = (list: typeof sections) => list.flatMap((s) => s.groups.flatMap((g) => g.items.map((i) => ({ path: i.href, title: i.title, section: s.key }))))
// Every docs page in the sidebar, in sidebar order; every page there is, plus the home page.
const docs = items(docSections)
const pages = [{ path: '/', title: 'clarusjs' }, ...items(sections)]
// The playground (/repl) ships its compiler on purpose (e2e/repl.spec.ts checks no other page does).
const guides = docs.filter((d) => d.path !== '/repl')
// axe reads computed colours: let animations (a lesson step fading in) finish first, or it sees them mid-fade.
const axe = async (page: Page) => {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)))
  return new AxeBuilder({ page })
}
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
    // The recipes' external API, answered here: this test mustn't depend on the network.
    await page.route('https://jsonplaceholder.typicode.com/**', (route) =>
      route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: route.request().url().includes('/users/') ? { id: 1, name: 'Leanne Graham' } : [] }))
    await page.route('https://api.github.com/**', (route) =>
      route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { full_name: 'forinda/clarusjs', stargazers_count: 1 } }))
    const { response, errors } = await visit(page, path)
    expect(response?.status()).toBe(200)
    await expect(page).toHaveTitle(new RegExp(esc(title)))
    await expect(page).toHaveTitle(/clarusjs/)
    await expect(page.locator('h1')).toHaveCount(1)
    // The Fetching guide's demo and the retry recipe fail one request on purpose; the browser logs that 503.
    expect(errors.filter((e) => !(['/guide/fetching', '/guide/fetching-recipes'].includes(path) && /status of 503/.test(e)))).toEqual([])
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

// One test per section (#585): ~90 pages in one test ran past the 30 s a test gets when the whole suite ran at once.
for (const section of docSections) {
  test(`the sidebar marks the current page and the header its section: ${section.key}`, async ({ page }) => {
    for (const { path } of items([section])) {
      await page.goto(path, { waitUntil: 'domcontentloaded' }) // what it checks is in the server's HTML
      const current = page.locator('.sidebar a[aria-current="page"]')
      await expect(current, path).toHaveCount(1)
      await expect(current, path).toHaveAttribute('href', path)
      await expect(page.locator('header nav a[aria-current]'), path).toHaveAttribute('href', section.href)
    }
  })
}

test('each docs page has its own description; the home page has no sidebar and no current section', async ({ page }) => {
  const descriptions = new Set<string>()
  for (const { path } of docs) {
    const html = await (await page.request.get(path)).text() // the HTML only: nothing to render
    descriptions.add(/<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? '')
  }
  expect(descriptions.size).toBe(docs.length)
  await page.goto('/')
  await expect(page.locator('header nav a[aria-current]')).toHaveCount(0)
  await expect(page.locator('.sidebar')).toHaveCount(0)
})

test('every sidebar link lands on a page, and the edit link points at its source', async ({ page }) => {
  await page.goto('/guide/what-is-clarusjs')
  for (const section of docSections) {
    await page.goto(section.href)
    const hrefs = await page.locator('.sidebar details[data-group] ul a').evaluateAll((links) => links.map((a) => a.getAttribute('href')!))
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
  for (const section of docSections) {
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
  // Each link's title (its first span: a badge, such as Tailwind CSS's "New", follows it).
  const shown = await page.locator('#sidebar details[data-group="Templates"] ul a > span:first-child').allTextContents()
  // Verbatim is a .tscl page, placed by nav.ts.
  expect(shown.filter((t) => t !== 'Verbatim')).toEqual(templates)
  expect(shown).toContain('Verbatim')
})

test('a verbatim element in a Markdown page shows its text as written', async ({ page }) => {
  await page.goto('/guide/holes')
  await expect(page.locator('.lead code').first()).toHaveText('{{ }}')
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
  // The section links live in the drawer on phones, not in the header.
  await expect(page.locator('.site-header .top-nav')).toBeHidden()
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
  // Every sidebar page, plus the pages dynamic routes generate (release notes per version, the client tour), 404 and 500.
  const routes = Object.keys(manifest.routes)
  // /api/demo-stats and /api/demo-records are the Fetching guide's endpoints (server routes), not sidebar pages.
  // /members is the Auth guide's guarded page (#457); /demos/ pages are linked from the guides, not the sidebar.
  const generated = (r: string) => r.startsWith('/releases/') || r.startsWith('/tour/') || r === '/404' || r === '/500' || r.startsWith('/api/') || r === '/members' || r.startsWith('/demos/')
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
  await expect(page.locator('cl-island[c="explained-table"]')).toHaveAttribute('data-cl-ready', '')
  await page.getByLabel('Rows').selectOption('all')
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
  await expect(groups).toHaveCount(3)
  await expect(groups.first()).toHaveAttribute('data-cl-ready', '')
  await expect(groups.first().locator('code')).toHaveText('mkdir my-site && cd my-site\npnpm init\npnpm add clarusjs\npnpm add -D vite')
  await groups.first().getByRole('tab', { name: 'npm', exact: true }).click()
  await expect(groups.first().locator('code')).toHaveText('mkdir my-site && cd my-site\nnpm init -y\nnpm install clarusjs\nnpm install -D vite')
  await expect(groups.nth(1).locator('code')).toHaveText(/^npm run dev /) // the other group followed
  await expect(groups.nth(1).getByRole('tab', { name: 'npm', exact: true })).toHaveAttribute('aria-selected', 'true')
  // The copy button copies what is shown.
  await groups.first().locator('button.copy').click()
  await expect(groups.first().locator('button.copy')).toHaveText('Copied')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('mkdir my-site && cd my-site\nnpm init -y\nnpm install clarusjs\nnpm install -D vite')
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
  await expect(page.locator('cl-island[c="pm"] code').first()).toHaveText('mkdir my-site && cd my-site\npnpm init\npnpm add clarusjs\npnpm add -D vite')
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
  await expect(page.locator('#pill-html')).toHaveText(/^<span class="pill cl-c-pill-[a-z0-9]+">&lt;img src=x onerror=alert\(1\)&gt;<\/span>$/)
})

test('the generated Netlify function serves only the server routes', async () => {
  const { readFileSync } = await import('node:fs')
  const fn = readFileSync(new URL('../.netlify/v1/functions/clarusjs-server.mjs', import.meta.url), 'utf8')
  expect(fn).toContain('import handler from "../../../dist/server/index.mjs"')
  // The pages and endpoints, each with its fragment path (endpoints have none: a 404).
  expect(fn).toContain('export const config = {"path":["/api/demo-auth","/api/demo-auth/","/api/demo-auth/index.frag.html","/api/demo-cities","/api/demo-cities/","/api/demo-cities/index.frag.html","/api/demo-clock","/api/demo-clock/","/api/demo-clock/index.frag.html","/api/demo-export","/api/demo-export/","/api/demo-export/index.frag.html","/api/demo-likes","/api/demo-likes/","/api/demo-likes/index.frag.html","/api/demo-posts","/api/demo-posts/","/api/demo-posts/index.frag.html","/api/demo-profile","/api/demo-profile/","/api/demo-profile/index.frag.html","/api/demo-records","/api/demo-records/","/api/demo-records/index.frag.html","/api/demo-session","/api/demo-session/","/api/demo-session/index.frag.html","/api/demo-stats","/api/demo-stats/","/api/demo-stats/index.frag.html","/api/demo-upload","/api/demo-upload/","/api/demo-upload/index.frag.html","/api/demo-vendor","/api/demo-vendor/","/api/demo-vendor/index.frag.html","/api/demo-weather","/api/demo-weather/","/api/demo-weather/index.frag.html","/members","/members/","/members/index.frag.html","/playground","/playground/","/playground/index.frag.html"],"preferStatic":true}')
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
  await page.locator('.content a[href="/playground"]').first().click() // the page's link (the sidebar's sits in a collapsed group)
  await expect(page.locator('h1')).toHaveText('Server demo')
  await expect(page.locator('#pill-html')).toHaveText(/^<span class="pill cl-c-pill-[a-z0-9]+">guest<\/span>$/) // rendered by the server for this request
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

test('#279: <style scoped>: the scope class; a parent styles a child component\'s top-level element, not its inside', async ({ page }) => {
  await page.goto('/guide/styles')
  const demo = page.locator('.scope-demo')
  await expect(demo).toHaveClass(/\bcl-c-scope-demo-[a-z0-9]+\b/)
  const color = (el: Element) => getComputedStyle(el).color
  expect(await demo.locator(':scope > p').evaluate(color)).toBe('rgb(11, 110, 112)') // the parent's own p
  const child = demo.locator('.scope-child')
  await expect(child).toHaveClass(/\bcl-c-scope-child-[a-z0-9]+\b/)
  expect(await child.evaluate((el) => getComputedStyle(el).borderLeftWidth)).toBe('3px') // the child's top-level element
  // class="framed" on the component tag lands on its top-level element, and the parent's .framed rule styles it.
  await expect(child).toHaveClass(/\bframed\b/)
  expect(await child.evaluate((el) => getComputedStyle(el).borderTopLeftRadius)).toBe('6px')
  // Inside the child, the parent's p rule doesn't apply, though the child has no <style> of its own.
  expect(await child.locator('p').evaluate(color)).not.toBe('rgb(11, 110, 112)')
})

test('component styles: scoped with @scope, from one stylesheet, not leaking', async ({ page }) => {
  await page.goto('/guide/state')
  const warning = page.locator('aside.callout.warning')
  await expect(warning).toHaveClass(/\bcl-c-callout-[a-z0-9]+\b/)
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

test('last updated: each page shows the last commit date of its source file from git', async ({ page }) => {
  const { execFileSync } = await import('node:child_process')
  for (const [path, file] of [['/guide/lists', 'guide/lists.md'], ['/guide/verbatim', 'guide/verbatim.tscl']]) {
    const seconds = Number(execFileSync('git', ['log', '-1', '--format=%ct', '--', file], { cwd: resolve(import.meta.dirname, '../src/pages'), encoding: 'utf8' }))
    await page.goto(path)
    const time = page.locator('.page-footer p.updated time')
    await expect(time, path).toHaveAttribute('datetime', new Date(seconds * 1000).toISOString())
    await expect(time, path).toHaveText(new Date(seconds * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }))
  }
})

test('search: Ctrl+K opens a modal, results load from small index files, arrows and Enter open one, Escape closes', async ({ page }) => {
  const fetched: string[] = []
  const documents: string[] = []
  page.on('request', (r) => {
    if (r.url().includes('/search/')) fetched.push(new URL(r.url()).pathname)
    if (r.resourceType() === 'document') documents.push(new URL(r.url()).pathname)
  })
  await page.goto('/guide/holes')
  const dialog = page.locator('dialog.search-dialog')
  await expect(dialog).not.toBeVisible()
  await expect(page.locator('cl-island[c="search"]')).toHaveAttribute('data-cl-ready', '')
  await page.keyboard.press('Control+k')
  await expect(dialog).toBeVisible()
  const input = dialog.getByRole('combobox', { name: 'Search the docs' })
  await expect(input).toBeFocused()
  await input.fill('fragment navig')
  const options = dialog.getByRole('option')
  await expect(options.first()).toContainText('Fragment navigation')
  await expect(dialog.getByRole('status')).toHaveText(/^\d+ results?$/)
  // Only the term files for the words typed and the section files for the results: never the whole index.
  expect(fetched.every((p) => /^\/search\/(t-(fr|na)|s-\d+)\.json$/.test(p))).toBe(true)
  await input.press('ArrowDown')
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true')
  await expect(input).toHaveAttribute('aria-activedescendant', 'search-result-1')
  await input.press('ArrowUp')
  const href = await options.first().locator('a').getAttribute('href')
  await input.press('Enter')
  await expect(page).toHaveURL(new RegExp(href!.replace(/[.?#]/g, '\\$&') + '$'))
  await expect(dialog).not.toBeVisible()
  // The URL commits before the new page is swapped in: wait for it, then search again.
  await expect(page.locator('h1')).not.toHaveText('Holes')
  expect(documents).toEqual(['/guide/holes']) // Enter navigates with navigate(): a fragment swap, not a page load
  // "/" opens it too (outside a text field); Escape closes it and focus goes back to the page.
  await page.keyboard.press('/')
  await expect(dialog).toBeVisible()
  await page.keyboard.type('zzqqxx')
  await expect(dialog.getByRole('status')).toHaveText('No results for "zzqqxx"')
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  // The sidebar's search box opens the same dialog (#369: the header button hides where the sidebar shows); while it's
  // open, the page behind is inert (focus stays inside).
  await page.locator('#sidebar [data-search-open]').click()
  await expect(dialog).toBeVisible()
  for (let i = 0; i < 4; i++) await page.keyboard.press('Tab')
  expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true)
  expect((await (await axe(page)).include('dialog.search-dialog').analyze()).violations).toEqual([])
})

test('search: the focused input draws one indicator, its accent bottom line, not a square ring inside the rounded dialog', async ({ page }) => {
  await page.goto('/guide/holes')
  await expect(page.locator('cl-island[c="search"]')).toHaveAttribute('data-cl-ready', '')
  await page.keyboard.press('Control+k')
  const input = page.locator('dialog.search-dialog').getByRole('combobox', { name: 'Search the docs' })
  await input.click()
  await expect(input).toBeFocused()
  const style = await input.evaluate((el) => {
    const s = getComputedStyle(el)
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    return { outline: s.outlineStyle, shadow: s.boxShadow, accent: (() => { const p = document.createElement('p'); p.style.color = accent; document.body.append(p); const c = getComputedStyle(p).color; p.remove(); return c })() }
  })
  expect(style.outline).toBe('none')
  expect(style.shadow).toContain(style.accent)
})

test('attach="visible": an island attaches once it scrolls into view, in a real browser (its <cl-island> has no box)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 400 })
  await page.goto('/guide/lazy-attach')
  const island = page.locator('#visible-demo cl-island')
  await expect(island).toHaveAttribute('a', 'visible')
  expect((await page.locator('#visible-demo').boundingBox())!.y).toBeGreaterThan(400) // below the fold
  await expect(island).not.toHaveAttribute('data-cl-ready', '')
  await page.locator('#visible-demo').scrollIntoViewIfNeeded()
  await expect(island).toHaveAttribute('data-cl-ready', '')
  await page.locator('#visible-demo button').click()
  await expect(page.locator('#visible-demo button')).toContainText('Clicked 1 times')
})

test('history.pushState and replaceState belong to the page: the router never turns them into a page load', async ({ page }) => {
  await page.goto('/guide/holes')
  await expect(page.locator('cl-island[c="search"]')).toHaveAttribute('data-cl-ready', '')
  const fragments: string[] = []
  page.on('request', (r) => { if (/\.frag\.html|__data\.json/.test(r.url())) fragments.push(r.url()) })
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('h1')!.focus()
    history.replaceState(null, '', '#escaping')
    history.pushState(null, '', '/guide/holes?tab=2')
  })
  await page.waitForTimeout(500)
  expect(fragments).toEqual([])
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('H1')
})

test('client tour: arrow keys move between steps with navigate(), rendered by the router', async ({ page }) => {
  const documents: string[] = []
  page.on('request', (r) => { if (r.resourceType() === 'document') documents.push(new URL(r.url()).pathname) })
  await page.goto('/tour/1')
  await expect(page.locator('cl-island[c="tour-keys"]')).toHaveAttribute('data-cl-ready', '')
  await page.keyboard.press('ArrowRight')
  await expect(page).toHaveURL(/\/tour\/2$/)
  await expect(page.locator('h1')).toHaveText('The router renders')
  await expect(page.locator('cl-island[c="tour-keys"]')).toHaveAttribute('data-cl-ready', '')
  await page.keyboard.press('ArrowLeft')
  await expect(page.locator('h1')).toHaveText('A shell arrives')
  await page.keyboard.press('ArrowLeft') // no step before the first
  await page.waitForTimeout(300)
  await expect(page).toHaveURL(/\/tour\/1$/)
  expect(documents).toEqual(['/tour/1'])
})

test('navigation hooks: beforeNavigate cancels a link click, navigate() leaves anyway, and the hook goes with its island', async ({ page }) => {
  await page.goto('/guide/navigation')
  await expect(page.locator('cl-island[c="leave-guard"]')).toHaveAttribute('data-cl-ready', '')
  await page.locator('#leave-note').fill('draft')
  await page.locator('.sidebar a[href="/guide/lists"]').click()
  await expect(page.getByRole('alert')).toContainText('unsaved note')
  await expect(page).toHaveURL(/\/guide\/navigation$/) // cancelled: still here
  await page.getByRole('button', { name: 'Leave anyway' }).click()
  await expect(page.locator('h1')).toHaveText('Lists')
  // The island was swapped out with its page: its hook no longer stops anything.
  await page.locator('.sidebar a[href="/guide/holes"]').click()
  await expect(page.locator('h1')).toHaveText('Holes')
})

test('transitions: <html data-cl-navigating> shows the phase while a fragment loads, and is gone after', async ({ page }) => {
  await page.route('**/guide/lists/index.frag.html', async (route) => { await new Promise((done) => setTimeout(done, 600)); await route.continue() })
  await page.goto('/guide/holes')
  await expect(page.locator('cl-island[c="search"]')).toHaveAttribute('data-cl-ready', '')
  await page.locator('.sidebar a[href="/guide/lists"]').click()
  await expect(page.locator('html')).toHaveAttribute('data-cl-navigating', 'loading')
  await expect(page.locator('h1')).toHaveText('Lists')
  await expect(page.locator('html')).not.toHaveAttribute('data-cl-navigating')
})

test('transitions: beforeSwap holds the page change, the navigating store shows the phase, the client router too', async ({ page }) => {
  await page.goto('/guide/navigation')
  const demo = page.locator('cl-island[c="swap-demo"]')
  await expect(demo).toHaveAttribute('data-cl-ready', '')
  await expect(demo.locator('.swap-status')).toHaveText('Idle')
  await demo.getByRole('checkbox').check()
  await page.locator('.sidebar a[href="/guide/lists"]').click()
  await expect(demo.locator('.swap-status')).toHaveText('Going to /guide/lists: swapping')
  await expect(page.locator('html')).toHaveAttribute('data-cl-navigating', 'swapping')
  await expect(page.locator('h1')).toHaveText('Navigation') // held by beforeSwap
  await expect(page.locator('h1')).toHaveText('Lists')
  await expect(page.locator('html')).not.toHaveAttribute('data-cl-navigating')
  // Client routes go through the same steps.
  await page.route('**/tour/2/__data.json', async (route) => { await new Promise((done) => setTimeout(done, 600)); await route.continue() })
  await page.goto('/tour/1')
  await expect(page.locator('cl-island[c="tour-keys"]')).toHaveAttribute('data-cl-ready', '')
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('html')).toHaveAttribute('data-cl-navigating', 'loading')
  await expect(page.locator('h1')).toHaveText('The router renders')
  await expect(page.locator('html')).not.toHaveAttribute('data-cl-navigating')
})

test('redirects: a static redirect forwards to its page; a server page\'s load() redirects', async ({ page, request }) => {
  await page.goto('/docs')
  await expect(page).toHaveURL(/\/guide\/getting-started$/)
  await expect(page.locator('h1')).toHaveText(/Getting started/)
  // The playground (a server page) sends a name of only spaces to the plain page.
  const res = await request.get('/playground?name=%20%20', { maxRedirects: 0 })
  expect([res.status(), res.headers().location]).toEqual([303, '/playground'])
  await page.goto('/playground?name=%20%20')
  await expect(page).toHaveURL(/\/playground$/)
  // Fragment navigation that hits the redirect loads the page normally, so the address bar shows where it landed.
  await page.goto('/guide/holes')
  await expect(page.locator('cl-island[c="search"]')).toHaveAttribute('data-cl-ready', '')
  await page.evaluate(() => { const a = document.createElement('a'); a.href = '/playground?name=%20'; a.id = 'to-playground'; a.textContent = 'go'; document.querySelector('main')!.append(a) })
  await page.locator('#to-playground').click()
  await expect(page).toHaveURL(/\/playground$/)
  await expect(page.locator('h1')).toHaveText('Server demo')
})

test('abort: the URL is held while a page loads; Stop cancels its request and leaves page and URL as they were', async ({ page }) => {
  let release = () => {}
  await page.route('**/guide/lists/index.frag.html', async (route) => { await new Promise<void>((done) => { release = done }); await route.continue().catch(() => {}) })
  const failed: string[] = []
  page.on('requestfailed', (r) => failed.push(new URL(r.url()).pathname))
  await page.goto('/guide/navigation')
  const demo = page.locator('cl-island[c="swap-demo"]')
  await expect(demo).toHaveAttribute('data-cl-ready', '')
  await page.locator('.sidebar a[href="/guide/lists"]').click()
  await expect(page.locator('html')).toHaveAttribute('data-cl-navigating', 'loading')
  await expect(page).toHaveURL(/\/guide\/navigation$/) // held: not committed while loading
  await demo.getByRole('button', { name: 'Stop' }).click()
  await expect(page.locator('html')).not.toHaveAttribute('data-cl-navigating')
  release()
  await expect(page).toHaveURL(/\/guide\/navigation$/)
  await expect(page.locator('h1')).toHaveText('Navigation')
  await expect.poll(() => failed).toContain('/guide/lists/index.frag.html') // the request was cancelled
  // The next navigation works as usual, and its URL changes once the page is in.
  await page.locator('.sidebar a[href="/guide/holes"]').click()
  await expect(page.locator('h1')).toHaveText('Holes')
  await expect(page).toHaveURL(/\/guide\/holes$/)
})

test('error pages: the 500 page renders at /500 and as 500.html, with links that work from the site root', async ({ page }) => {
  const { readFileSync } = await import('node:fs')
  expect(readFileSync(new URL('../dist/client/500.html', import.meta.url), 'utf8')).toContain('Something went wrong')
  await page.goto('/500')
  await expect(page.locator('h1')).toHaveText('Something went wrong')
  await expect(page.locator('.lead')).toContainText('error 500')
  await page.getByRole('link', { name: 'Get started' }).first().click()
  await expect(page).toHaveURL(/\/guide\/getting-started$/)
})

test('client routes: a first render that fails shows the site\'s 500 or 404 page, at the same URL, with its islands', async ({ page }) => {
  await page.route('**/tour/2/__data.json', (route) => route.fulfill({ status: 500, body: 'down' }))
  await page.goto('/tour/2')
  await expect(page.locator('h1')).toHaveText('Something went wrong')
  await expect(page).toHaveURL(/\/tour\/2$/)
  await expect(page.locator('cl-island[c="theme-toggle"]')).toHaveAttribute('data-cl-ready', '')
  await expect(page.locator('.site-header')).toBeVisible() // styled: the shell links the error pages' stylesheets
  expect(await page.locator('.site-header').evaluate((el) => getComputedStyle(el).position)).toBe('sticky')
  await page.route('**/tour/3/__data.json', (route) => route.fulfill({ status: 404, body: 'gone' }))
  await page.goto('/tour/3')
  await expect(page.locator('h1')).toHaveText('Page not found')
})

test('view transitions: a page change runs inside document.startViewTransition, then the new page shows', async ({ page }) => {
  await page.goto('/guide/holes')
  await expect(page.locator('cl-island[c="view-transitions"]')).toHaveAttribute('data-cl-ready', '')
  await page.evaluate(() => {
    const start = document.startViewTransition.bind(document)
    ;(window as { __vt?: number }).__vt = 0
    document.startViewTransition = ((update: () => Promise<void>) => { (window as { __vt?: number }).__vt!++; return start(update) }) as typeof document.startViewTransition
  })
  await page.locator('.sidebar a[href="/guide/lists"]').click()
  await expect(page.locator('h1')).toHaveText('Lists')
  expect(await page.evaluate(() => (window as { __vt?: number }).__vt)).toBe(1)
  await expect(page.locator('cl-island[c="view-transitions"]')).toHaveAttribute('data-cl-ready', '') // kept across swaps
})

test('view transitions demo: the named card is on both pages, larger on the second, and the page change runs as a view transition', async ({ page }) => {
  await page.goto('/demos/view-transitions/one')
  await expect(page.locator('cl-island[c="view-transitions"]')).toHaveAttribute('data-cl-ready', '')
  const card = page.locator('figure.vt-card')
  await expect(card).toHaveCSS('view-transition-name', 'vt-demo-card')
  const small = (await card.boundingBox())!
  await page.evaluate(() => {
    const start = document.startViewTransition.bind(document)
    ;(window as { __vt?: number }).__vt = 0
    document.startViewTransition = ((update: () => Promise<void>) => { (window as { __vt?: number }).__vt!++; return start(update) }) as typeof document.startViewTransition
  })
  await page.getByRole('link', { name: 'Next page: the same card, wide' }).click()
  await expect(page.locator('h1')).toHaveText('View transitions demo, page two')
  expect(await page.evaluate(() => (window as { __vt?: number }).__vt)).toBe(1)
  await expect(card).toHaveCSS('view-transition-name', 'vt-demo-card')
  expect((await card.boundingBox())!.width).toBeGreaterThan(small.width * 2)
  // Not in the sidebar: a demo, linked from the animations guide.
  await expect(page.locator('.sidebar a[href="/demos/view-transitions/one"]')).toHaveCount(0)
})

test('inputs: a nested island gets new props in place, keeping its own state', async ({ page }) => {
  await page.goto('/guide/components-in-islands')
  const swatch = page.locator('cl-island[c="swatch"]')
  await expect(swatch).toHaveAttribute('data-cl-ready', '')
  await expect(page.locator('cl-island[c="hue-picker"]')).toHaveAttribute('data-cl-ready', '')
  await swatch.locator('.swatch-pin').click()
  await expect(swatch.locator('.swatch-pin')).toHaveText('Pinned')
  const handle = await swatch.elementHandle()
  await page.locator('.hue-next').click()
  await expect(swatch.locator('.swatch-hue')).toHaveText('240°')
  await expect(swatch.locator('.swatch-pin')).toHaveText('Pinned') // its own state kept
  expect(await page.evaluate((el) => el!.isConnected, handle)).toBe(true) // the same element, updated in place
})

test('forms: field components bound two ways update one state object; native selects and checkboxes too; reset goes back', async ({ page }) => {
  await page.goto('/guide/forms')
  const form = page.locator('cl-island[c="signup-form"]')
  await expect(form).toHaveAttribute('data-cl-ready', '')
  for (const field of await form.locator('cl-island[c="text-field"]').all()) await expect(field).toHaveAttribute('data-cl-ready', '')
  const summary = form.locator('.signup-summary')
  await expect(summary).toHaveText('Someone (no email) on free.')
  await expect(form.locator('.signup-reset')).toBeDisabled()
  const name = form.getByLabel('Name')
  const nameField = await name.elementHandle()
  await name.fill('Ada')
  await form.getByLabel('Email').fill('ada@example.com')
  await expect(form.getByRole('radio', { name: 'Free' })).toBeChecked() // a radio group bound with [(value)] (#267)
  await form.getByRole('radio', { name: 'Pro' }).check()
  await form.getByLabel('Send me updates').check()
  await expect(summary).toHaveText('Ada (ada@example.com) on pro, with updates. Changed.')
  await form.locator('.signup-reset').click()
  await expect(summary).toHaveText('Someone (no email) on free.')
  await expect(name).toHaveValue('') // the field follows the form
  await expect(form.getByLabel('Send me updates')).not.toBeChecked()
  await expect(form.getByRole('radio', { name: 'Free' })).toBeChecked() // the group follows the form back
  expect(await page.evaluate((el) => el!.isConnected, nameField)).toBe(true) // the same field, updated in place
})

test('events: a custom event from a child island, mouseenter, keys, focus and blur, and submit without a reload', async ({ page }) => {
  const documents: string[] = []
  page.on('request', (r) => { if (r.resourceType() === 'document') documents.push(new URL(r.url()).pathname) })
  await page.goto('/guide/events')
  const demo = page.locator('cl-island[c="event-demo"]')
  await expect(demo).toHaveAttribute('data-cl-ready', '')
  await expect(page.locator('cl-island[c="star-rating"]')).toHaveAttribute('data-cl-ready', '')
  const third = demo.getByRole('button', { name: '3 stars' })
  await third.hover()
  await expect(third).toHaveClass('star on') // (mouseenter), which doesn't bubble
  await third.click()
  await expect(demo.locator('.event-rating')).toHaveText('Rating: 3')
  const note = demo.getByLabel('Note')
  await note.fill('hello')
  await note.press('Escape')
  await expect(note).toHaveValue('')
  await note.fill('kept')
  await note.press('Enter')
  await note.blur()
  await expect(demo.locator('.event-log li')).toHaveText(['blur', 'submit: kept', 'focus', 'rate: 3 (click)'])
  expect(documents).toEqual(['/guide/events']) // submit was handled, not a page load
})

test('large forms: a section, lines bound by index, derived total and validation, add and remove, send, reset', async ({ page }) => {
  await page.goto('/guide/forms')
  const order = page.locator('cl-island[c="order-form"]')
  await expect(order).toHaveAttribute('data-cl-ready', '')
  // The fields are islands of their own, attached separately: wait for them before typing.
  for (const field of await order.locator('cl-island[c="text-field"]').all()) await expect(field).toHaveAttribute('data-cl-ready', '')
  await expect(order.locator('.order-total')).toHaveText('Total: 4')
  // Nothing is wrong before you've done anything; placeholders show what goes where.
  await expect(order.getByRole('alert')).toHaveCount(0)
  await expect(order.getByLabel('Name')).toHaveAttribute('placeholder', 'Ada Lovelace')
  await expect(order.getByLabel('Email')).toHaveAttribute('placeholder', 'ada@example.com')
  await expect(order.getByLabel('Item 1')).toHaveAttribute('placeholder', 'Item')
  await expect(order.locator('.order-changed')).toHaveCount(0) // f.dirty: nothing changed yet
  // A field's error shows under that field once you leave it, then follows what you type.
  const nameField = order.locator('.text-field').filter({ has: page.getByLabel('Name') })
  const emailField = order.locator('.text-field').filter({ has: page.getByLabel('Email') })
  await order.getByLabel('Email').fill('ada@')
  await expect(emailField.getByRole('alert')).toHaveCount(0) // still typing
  await order.getByLabel('Name').focus() // left the email field
  await expect(emailField.getByRole('alert')).toHaveText('Enter an email like ada@example.com.')
  await expect(order.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true')
  await expect(order.locator('.order-changed')).toHaveText('Unsaved changes')
  await order.getByLabel('Email').fill('')
  await expect(order.locator('.order-changed')).toHaveCount(0) // typed and taken back: compared by value
  await order.getByLabel('Email').fill('ada@example.com')
  await expect(emailField.getByRole('alert')).toHaveCount(0)
  await expect(nameField.getByRole('alert')).toHaveText('Enter a name.') // Name was left empty (focused, then Email): its own error, under it
  // Send shows what's still wrong, each under its field.
  await order.getByRole('button', { name: 'Send' }).click()
  await expect(nameField.getByRole('alert')).toHaveText('Enter a name.')
  await order.getByLabel('Name').fill('Ada')
  await expect(nameField.getByRole('alert')).toHaveCount(0)
  await order.getByLabel('Quantity 1').fill('1.5') // not a whole number: the field's own rule (step)
  await order.getByLabel('Price 1').focus()
  await expect(order.locator('.order-line').first().getByRole('alert')).toHaveText('Quantity: use a whole number.')
  await order.getByLabel('Quantity 1').fill('3')
  await expect(order.locator('.order-line').first().getByRole('alert')).toHaveCount(0)
  await expect(order.locator('.order-total')).toHaveText('Total: 12')
  await order.getByRole('button', { name: 'Add a line' }).click()
  await expect(order.locator('.order-lines-error')).toHaveText('Every line needs an item.')
  await order.getByLabel('Item 2').fill('Pen')
  await order.getByLabel('Price 2').fill('2.5')
  await expect(order.locator('.order-total')).toHaveText('Total: 14.5')
  await order.getByRole('button', { name: 'Remove line 1' }).click()
  await expect(order.getByLabel('Item 1')).toHaveValue('Pen')
  await expect(order.locator('.order-total')).toHaveText('Total: 2.5')
  await order.getByRole('button', { name: 'Send' }).click()
  await expect(order.locator('.order-sent')).toContainText('"name":"Ada"')
  await expect(order.locator('.order-sent')).toContainText('"item":"Pen"')
  await order.getByRole('button', { name: 'Reset' }).click()
  await expect(order.locator('.order-total')).toHaveText('Total: 4')
  await expect(order.getByLabel('Item 1')).toHaveValue('Notebook')
  await expect(order.getByLabel('Name')).toHaveValue('')
  await expect(order.locator('.order-changed')).toHaveCount(0)
  await expect(order.getByRole('alert')).toHaveCount(0) // reset clears what was shown
})

test('client routes: pushState and replaceState from the page are not page loads', async ({ page }) => {
  await page.goto('/tour/1')
  await expect(page.locator('cl-island[c="theme-toggle"]')).toHaveAttribute('data-cl-ready', '')
  const data: string[] = []
  page.on('request', (r) => { if (r.url().includes('__data.json')) data.push(r.url()) })
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('h1')!.setAttribute('tabindex', '-1')
    document.querySelector<HTMLElement>('h1')!.focus()
    history.replaceState(null, '', '?tab=1')
    history.pushState(null, '', '/tour/1?tab=2')
  })
  await page.waitForTimeout(500)
  expect(data).toEqual([])
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('H1')
})

test('client routes: a replaceState while the next page loads still shows that page', async ({ page }) => {
  await page.route('**/tour/2/__data.json', async (route) => { await new Promise((done) => setTimeout(done, 600)); await route.continue() })
  await page.goto('/tour/1')
  await expect(page.locator('cl-island[c="theme-toggle"]')).toHaveAttribute('data-cl-ready', '')
  await page.click('nav.tour a.next')
  await expect(page.locator('html')).toHaveAttribute('data-cl-navigating', 'loading')
  await page.evaluate(() => history.replaceState(null, '', location.pathname + '#top'))
  await expect(page.locator('h1')).toHaveText('The router renders')
  await expect(page).toHaveURL(/\/tour\/2$/)
})

test('lesson without JavaScript: a plain page, every step shown, segments jump to them, no action bar', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/learn/first-page')
  await expect(page.locator('.lesson-header .eyebrow')).toHaveText(/^Learn · Lesson 1 of \d+$/)
  await expect(page.locator('main .step')).toHaveCount(6)
  for (const step of await page.locator('main .step').all()) await expect(step).toBeVisible()
  await expect(page.locator('.segments a')).toHaveText(['Read', 'Create', 'Write', 'Run', 'Quiz', 'Done'])
  // The quiz: radios to pick, and the answer in a <details> to open.
  const quiz = page.locator('.quiz')
  await quiz.getByRole('radio', { name: 'src/pages/about.tscl' }).check()
  await quiz.locator('summary', { hasText: 'Show the answer' }).click()
  await expect(quiz.locator('.quiz-correct')).toHaveText('Answer: src/pages/about.tscl')
  await expect(page.locator('.lesson-bar')).toBeHidden()
  await context.close()
})

test('lesson: one step at a time, Continue and Back, the URL and the segments follow, focus moves to the step', async ({ page }) => {
  await page.goto('/learn/first-page')
  const bar = page.getByRole('region', { name: 'Lesson actions' })
  await expect(bar).toBeVisible()
  const visible = page.locator('main .step:visible')
  await expect(visible).toHaveCount(1)
  await expect(visible.locator('h2')).toHaveText(/^Read/)
  await expect(bar.getByRole('status')).toHaveText('Step 1 of 6: Read')
  await expect(bar.getByRole('button', { name: 'Back' })).toBeDisabled()
  await bar.getByRole('button', { name: 'Continue' }).click()
  await expect(visible.locator('h2')).toHaveText(/^Create/)
  await expect(page).toHaveURL(/#create$/)
  await expect(page.locator('#create')).toBeFocused()
  await expect(page.locator('.segments li.done')).toHaveCount(1)
  await expect(page.locator('.segments li.current a')).toHaveAttribute('aria-current', 'step')
  await expect(page.locator('.segments a[aria-current]')).toHaveCount(1)
  await bar.getByRole('button', { name: 'Back' }).click()
  await expect(visible.locator('h2')).toHaveText(/^Read/)
  // A segment link (or any #hash in a step) shows that step.
  await page.locator('.segments a[href="#run"]').click()
  await expect(visible.locator('h2')).toHaveText(/^Run/)
  // Opened at a step: that step; the last step's button finishes the lesson.
  await page.goto('/learn/first-page#done')
  await expect(visible.locator('h2')).toHaveText(/^Done/)
  await expect(bar.getByRole('status')).toHaveText('Step 6 of 6: Done')
  const finish = bar.locator('button.primary')
  await expect(finish).toHaveText(/^(Next lesson|Finish)$/)
  // The bar never covers the lesson's end: the page leaves room for it.
  const room = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('main.lesson')!).paddingBottom))
  expect(room).toBeGreaterThanOrEqual((await bar.boundingBox())!.height)
  expect((await (await axe(page)).analyze()).violations).toEqual([])
})

test('lesson quiz: the bar checks it, says how it went in green or red, then continues', async ({ page }) => {
  await page.goto('/learn/first-page#quiz')
  const bar = page.getByRole('region', { name: 'Lesson actions' })
  await expect(page.locator('cl-island[c="quiz-choices"]')).toHaveAttribute('data-cl-ready', '')
  const primary = bar.locator('button.primary')
  await expect(primary).toHaveText('Check')
  // The quiz's own button and announcement step aside: the bar does both.
  await expect(page.locator('.quiz-check')).toBeHidden()
  await primary.click()
  await expect(bar.getByRole('status')).toContainText('Pick an answer')
  await expect(primary).toHaveText('Check')
  await page.getByRole('radio', { name: 'src/about.html' }).check()
  await primary.click()
  await expect(bar.getByRole('status')).toContainText('Not quite')
  await expect(bar.getByRole('status')).toContainText('The answer is: src/pages/about.tscl.')
  await expect(page.locator('.lesson-bar')).toHaveClass(/\bbad\b/)
  // Right and wrong are said in words, not only in colour.
  await expect(page.locator('.quiz-options label.wrong')).toHaveText(/src\/about\.html\s*✗ Your pick/)
  await expect(page.locator('.quiz-options label.right')).toHaveText(/src\/pages\/about\.tscl\s*✓ Right answer/)
  expect(await page.locator('.quiz-options label.wrong').evaluate((el) => getComputedStyle(el).borderColor)).not.toBe(await page.locator('.quiz-options label.right').evaluate((el) => getComputedStyle(el).borderColor))
  await expect(page.locator('.quiz-answer')).toHaveAttribute('open', '')
  await expect(page.getByRole('radio', { name: 'src/pages/about.tscl' })).toBeDisabled()
  await expect(primary).toHaveText('Continue')
  expect((await (await axe(page)).analyze()).violations).toEqual([])
  await primary.click()
  await expect(page.locator('main .step:visible h2')).toHaveText(/^Done/)
  await expect(page.locator('.lesson-bar')).not.toHaveClass(/\b(ok|bad)\b/)
})

test('lesson quiz, right answer: the bar turns green', async ({ page }) => {
  await page.goto('/learn/first-page#quiz')
  await expect(page.locator('cl-island[c="quiz-choices"]')).toHaveAttribute('data-cl-ready', '')
  await page.getByRole('radio', { name: 'src/pages/about.tscl' }).check()
  await page.locator('.lesson-bar button.primary').click()
  await expect(page.locator('.lesson-bar')).toHaveClass(/\bok\b/)
  await expect(page.getByRole('region', { name: 'Lesson actions' }).getByRole('status')).toContainText('Correct!')
})

test('progress: a lesson done, its quiz right, XP and badges on the progress page, the sidebar marks it, Reset', async ({ page }) => {
  await page.goto('/learn/progress')
  const board = page.locator('.progress-board')
  await expect(board.locator('.progress-stats')).toContainText(/XP\s*0/)
  await expect(board.locator('.progress-stats')).toContainText(/Lessons\s*0 of 6/)
  await expect(board.locator('.progress-stats')).toContainText('no quizzes answered yet')
  await expect(page.locator('.sidebar ul a[href="/learn/first-page"]')).toHaveAttribute('data-status', 'current')
  await expect(page.locator('.sidebar ul a[href="/learn/first-page"] .status-note')).toHaveText(' (up next)')
  await expect(page.locator('.site-header .xp-chip')).toHaveText(/0 XP/)

  await page.goto('/learn/first-page')
  const bar = page.getByRole('region', { name: 'Lesson actions' })
  const primary = bar.locator('button.primary')
  await expect(page.locator('cl-island[c="quiz-choices"]')).toHaveAttribute('data-cl-ready', '')
  for (let i = 0; i < 4; i++) await primary.click() // Read, Create, Write, Run
  await expect(page.locator('.lesson-header .xp-chip')).toHaveText(/40 XP/) // 10 a step, live
  await page.getByRole('radio', { name: 'src/pages/about.tscl' }).check()
  await primary.click() // Check: right
  await primary.click() // Continue to Done
  await expect(primary).toHaveText('Next lesson')
  await primary.click()
  await expect(page).toHaveURL(/\/learn\/templates$/)
  await page.goto('/learn/progress')
  // 6 steps × 10 + the lesson 50 + a quiz right 20.
  await expect(board.locator('.progress-stats')).toContainText(/XP\s*130/)
  await expect(board.locator('.progress-stats')).toContainText(/Lessons\s*1 of 6/)
  await expect(board.locator('.progress-stats')).toContainText('100% (1 of 1)')
  await expect(board.locator('.badges li.earned strong')).toHaveText(['First lesson'])
  await expect(page.locator('.sidebar ul a[href="/learn/first-page"]')).toHaveAttribute('data-status', 'done')
  await expect(page.locator('.sidebar ul a[href="/learn/templates"]')).toHaveAttribute('data-status', 'current')
  await expect(page.locator('.sidebar ul a[href="/learn/ship-it"]')).toHaveAttribute('data-status', 'locked')
  // Stored in one versioned key, in this browser only.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('clarusjs-learn')!).v)).toBe(1)
  expect((await (await axe(page)).analyze()).violations).toEqual([])

  const reset = board.getByRole('button', { name: 'Reset progress' })
  await reset.click()
  await expect(board.getByRole('button', { name: 'Click again to erase your progress' })).toBeVisible()
  await board.getByRole('button', { name: 'Click again to erase your progress' }).click()
  await expect(board.locator('.progress-stats')).toContainText(/XP\s*0/)
  await expect(page.locator('.site-header .xp-chip')).toHaveText(/0 XP/)
})

test('progress with storage blocked: the page says so, lessons still work; without JavaScript: plain links, no chip', async ({ browser }) => {
  const blocked = await browser.newContext()
  await blocked.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError') } }))
  const page = await blocked.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/learn/progress')
  await expect(page.locator('.progress-note')).toContainText('storage is blocked')
  await page.goto('/learn/first-page')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.locator('main .step:visible h2')).toHaveText(/^Create/)
  expect(errors).toEqual([])
  await blocked.close()

  const plain = await browser.newContext({ javaScriptEnabled: false })
  const noJs = await plain.newPage()
  await noJs.goto('/learn/progress')
  await expect(noJs.locator('.progress-note')).toContainText('with JavaScript on')
  await expect(noJs.locator('.progress-lessons a')).toHaveText(['Install and a first page', 'Templates', 'Your first island', 'Pages and data', 'Markdown and the head', 'Ship it'])
  await expect(noJs.locator('.xp-chip')).toBeHidden()
  await plain.close()
})

test('the learning path: six lessons in order, each with steps, a quiz and links to the docs, chained by Next lesson', async ({ page }) => {
  const lessons = sections.find((s) => s.key === 'learn')!.groups.flatMap((g) => g.items).filter((i) => i.href !== '/learn/progress')
  expect(lessons.map((l) => l.href)).toEqual(['/learn/first-page', '/learn/templates', '/learn/first-island', '/learn/pages-and-data', '/learn/markdown-and-head', '/learn/ship-it'])
  for (const [i, lesson] of lessons.entries()) {
    await page.goto(lesson.href + '#done')
    await expect(page.locator('.lesson-header .eyebrow'), lesson.href).toHaveText(`Learn · Lesson ${i + 1} of 6`)
    expect(await page.locator('main .step').count(), lesson.href).toBeGreaterThanOrEqual(4)
    await expect(page.locator('main .quiz'), lesson.href).toHaveCount(1)
    // The Done step points to the matching docs pages, and each link lands.
    const docs = await page.locator('main .step:visible a[href^="/guide/"], main .step:visible a[href^="/reference/"]').evaluateAll((links) => links.map((a) => a.getAttribute('href')!))
    expect(docs.length, lesson.href).toBeGreaterThan(0)
    await expect(page.locator('.lesson-bar button.primary'), lesson.href).toHaveText(i < lessons.length - 1 ? 'Next lesson' : 'Finish')
    for (const href of docs) expect((await page.request.get(href)).status(), `${lesson.href} → ${href}`).toBe(200)
  }
})

test('home: two ways in, Learn and Docs', async ({ page }) => {
  await page.goto('/')
  const ways = page.getByRole('region', { name: 'Two ways in' })
  await expect(ways.locator('a.way')).toHaveCount(2)
  await expect(ways.locator('a.way').first()).toHaveAttribute('href', '/learn/first-page')
  await expect(ways.locator('a.way').nth(1)).toHaveAttribute('href', '/guide/what-is-clarusjs')
})

test('lesson: a #link to something inside a step opens that step and keeps the target', async ({ page }) => {
  await page.goto('/learn/pages-and-data')
  await expect(page.locator('.lesson-bar')).toBeVisible()
  await page.evaluate(() => { location.hash = '#the-page' })
  await expect(page.locator('main .step:visible h2')).toHaveText(/^Route/)
  await expect(page).toHaveURL(/#the-page$/)
  await expect(page.locator('#the-page')).toBeInViewport()
})

test('lesson: keyboard users see where focus went when a step opens; a mouse click shows no ring', async ({ page }) => {
  await page.goto('/learn/first-page')
  // The bar's island must be attached before the keypress, or Enter lands on a button with no handler yet (#291).
  await expect(page.locator('cl-island[c="lesson-bar"]')).toHaveAttribute('data-cl-ready', '')
  const continueButton = page.locator('.lesson-bar button.primary')
  await continueButton.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#create')).toBeFocused()
  expect(await page.locator('#create').evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none')
  await continueButton.click()
  await expect(page.locator('#write')).toBeFocused()
  expect(await page.locator('#write').evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('none')
})

test('fragment navigation: a replaceState while the next page loads still shows that page', async ({ page }) => {
  await page.route('**/guide/lists/index.frag.html', async (route) => { await new Promise((done) => setTimeout(done, 600)); await route.continue() })
  await page.goto('/guide/holes')
  await expect(page.locator('cl-island[c="search"]')).toHaveAttribute('data-cl-ready', '')
  await page.locator('.sidebar a[href="/guide/lists"]').click()
  // While it loads (the URL is held), the page changes its own URL: the clicked page still shows.
  await expect(page.locator('html')).toHaveAttribute('data-cl-navigating', 'loading')
  await page.evaluate(() => history.replaceState(null, '', location.pathname + '#top'))
  await expect(page.locator('h1')).toHaveText('Lists')
  await expect(page).toHaveURL(/\/guide\/lists$/)
})

test('lesson with reduced motion: steps change without animation', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.goto('/learn/first-page')
  await page.getByRole('button', { name: 'Continue' }).click()
  expect(await page.locator('main .step:visible').evaluate((el) => getComputedStyle(el).animationName)).toBe('none')
  await context.close()
})

test('a Markdown page renders in the layout, with anchors, a component and the right edit link', async ({ page }) => {
  await page.goto('/guide/what-is-clarusjs')
  await expect(page.locator('h1')).toHaveText(/What is clarusjs\?/)
  await expect(page).toHaveTitle('What is clarusjs? · clarusjs')
  await expect(page.locator('h2#what-makes-it-different a.header-anchor')).toHaveAttribute('href', '#what-makes-it-different')
  await expect(page.locator('.sidebar a[aria-current="page"]')).toHaveText('What is clarusjs?')
  await expect(page.locator('aside.callout.info').filter({ hasText: 'built with clarusjs' })).toContainText('This page is written in Markdown.')
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
  await expect(snippet.locator('code')).toContainText("editLink: 'https://github.com/forinda/clarusjs/edit/main/packages/docs/src/pages/:file'")
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
    const { violations } = await (await axe(page)).disableRules(['color-contrast']).analyze() // contrast: #122
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
      const { violations } = await (await axe(page)).withRules(['color-contrast']).analyze()
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

test('wide screens: the sidebar and the table of contents stay in view under the header, and the header lines up with the page', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 900 })
  await page.goto('/guide/markdown')
  await page.evaluate(() => scrollTo(0, 2000))
  const header = await page.locator('header.site-header').boundingBox()
  for (const name of ['Pages', 'On this page']) {
    const box = (await page.getByRole(name === 'Pages' ? 'navigation' : 'complementary', { name }).boundingBox())!
    expect(box.y, name).toBeCloseTo(header!.height, 0)
  }
  // The header's content is as wide as the page below it, not the whole window.
  const docs = (await page.locator('.docs').boundingBox())!
  const brand = (await page.locator('.site-header .brand').boundingBox())!
  const end = (await page.locator('.site-header .header-end').boundingBox())!
  expect(brand.x).toBeGreaterThanOrEqual(docs.x)
  expect(brand.x).toBeLessThan(docs.x + 32)
  expect(end.x + end.width).toBeLessThanOrEqual(docs.x + docs.width)
  expect(end.x + end.width).toBeGreaterThan(docs.x + docs.width - 32)
})

// Form validation guide: the multi-step demo, run by clarusjs/forms.
async function stepsDemo(page: import('@playwright/test').Page, path = '/guide/form-validation') {
  await page.goto(path)
  const demo = page.locator('cl-island[c="signup-steps"]')
  await expect(demo).toHaveAttribute('data-cl-ready', '')
  return demo
}

test('form validation: Next stays on a step with errors, shown on their fields and focused; then moves on, in the hash', async ({ page }) => {
  const demo = await stepsDemo(page)
  await expect(demo.locator('#signup-details')).toBeVisible()
  await expect(demo.locator('#signup-account')).toBeHidden()
  await demo.getByRole('button', { name: 'Next' }).first().click()
  const name = demo.getByLabel('Name', { exact: true })
  await expect(name).toBeFocused()
  await expect(name).toHaveAttribute('aria-invalid', 'true')
  const message = demo.locator('#signup-details [data-cl-message]').first()
  await expect(message).toBeVisible()
  await expect(name).toHaveAttribute('aria-describedby', (await message.getAttribute('id'))!)
  await name.fill('Ada')
  await demo.getByLabel('Email').fill('ada@example.com')
  await expect(name).not.toHaveAttribute('aria-invalid', 'true')
  await demo.getByRole('button', { name: 'Next' }).first().click()
  await expect(demo.locator('#signup-account')).toBeVisible()
  await expect(page).toHaveURL(/#signup-account$/)
  await demo.getByRole('button', { name: 'Back' }).first().click()
  await expect(page).toHaveURL(/#signup-details$/)
  await page.goBack()
  await expect(page).toHaveURL(/#signup-account$/)
  await expect(demo.locator('#signup-account')).toBeVisible()
})

test('form validation: a reload on a step\'s hash opens it; a heading\'s hash leaves the form on its first step', async ({ page }) => {
  let demo = await stepsDemo(page, '/guide/form-validation#signup-account')
  await expect(demo.locator('#signup-account')).toBeVisible()
  await expect(demo.locator('#signup-details')).toBeHidden()
  const heading = await page.locator('main h2[id]').first().getAttribute('id')
  await page.goto('/guide/forms') // a real load next, not a hash change on the same page
  demo = await stepsDemo(page, `/guide/form-validation#${heading}`)
  await expect(demo.locator('#signup-details')).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`#${heading}$`))
})

test('form validation: submit from the last step goes to the first error, with a summary linking to every field', async ({ page }) => {
  const demo = await stepsDemo(page, '/guide/form-validation#signup-confirm')
  await demo.getByRole('button', { name: 'Create account' }).click()
  await expect(demo.locator('#signup-details')).toBeVisible()
  await expect(demo.getByLabel('Name', { exact: true })).toBeFocused()
  const summary = demo.getByRole('alert')
  await expect(summary.getByRole('link')).toHaveCount(5) // name, email, username, plan, terms
  await summary.getByRole('link', { name: /terms/i }).click()
  await expect(demo.locator('#signup-confirm')).toBeVisible()
  await expect(demo.getByLabel(/terms/i)).toBeFocused()
})

test('form validation: an async check (a taken username) and a server error land on their fields', async ({ page }) => {
  const demo = await stepsDemo(page)
  await demo.getByLabel('Name', { exact: true }).fill('Ada')
  await demo.getByLabel('Email').fill('taken@example.com')
  await demo.getByRole('button', { name: 'Next' }).first().click()
  await expect(demo.locator('#signup-account')).toBeVisible()
  const username = demo.getByLabel('Username')
  await username.fill('admin')
  await username.blur()
  await expect(demo.locator('#signup-account')).toContainText('That username is taken.')
  await username.fill('ada')
  await demo.getByLabel('Plan').selectOption('pro')
  await demo.getByRole('button', { name: 'Next' }).first().click()
  await expect(demo.locator('#signup-confirm')).toBeVisible()
  await demo.getByLabel(/terms/i).check()
  await demo.getByRole('button', { name: 'Create account' }).click()
  // The (pretend) server says the email is registered: back to that field.
  await expect(demo.locator('#signup-details')).toBeVisible()
  await expect(demo.getByLabel('Email')).toBeFocused()
  await expect(demo.locator('#signup-details')).toContainText('That email is already registered.')
  await demo.getByLabel('Email').fill('ada@example.com')
  await demo.getByRole('button', { name: 'Next' }).first().click()
  await expect(demo.locator('#signup-account')).toBeVisible() // next() is async (it waits for the schema)
  await demo.getByRole('button', { name: 'Next' }).first().click()
  await expect(demo.locator('#signup-confirm')).toBeVisible()
  await demo.getByRole('button', { name: 'Create account' }).click()
  await expect(demo.getByRole('status')).toHaveText('Welcome, Ada!')
})

test('editor setup: the language server, and setup for each editor', async ({ page }) => {
  await page.goto('/guide/editor')
  for (const name of ['The language server', 'Neovim', 'Helix', 'JetBrains IDEs', 'Zed', 'Sublime Text']) {
    await expect(page.getByRole('heading', { name: new RegExp(`^${name}`) })).toBeVisible() // headings end with their permalink
  }
  await expect(page.locator('main')).toContainText('clarusjs-ls --stdio')
  await expect(page.locator('main')).toContainText('npm install -g @clarusjs/language-server')
  await expect(page.locator('main')).toContainText('queries/tscl/highlights.scm')
})

test('#258 fetching: cards batch into one request, the feed waits on the user and retries, refresh refetches', async ({ page }) => {
  // Server HTML: each island's loading state, no data (nothing is fetched while server-rendering).
  const html = (await (await page.request.get('/guide/fetching')).text()).replace(/<!--.*?-->/g, '') // hole markers out
  expect(html).toContain('Loading visits')
  expect(html).not.toContain('12,400')
  const keys: string[] = []
  page.on('request', (r) => { const u = new URL(r.url()); if (u.pathname === '/api/demo-stats') keys.push(u.searchParams.get('keys')!) })
  const errors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error' && !/503/.test(m.text())) errors.push(m.text()) })
  await page.goto('/guide/fetching')
  await expect(page.locator('#stat-visits')).toContainText('12,400')
  await expect(page.locator('#stat-signups')).toContainText('318')
  await expect(page.locator('#stat-revenue')).toContainText('$9,200')
  const cards = keys.filter((k) => /visits|signups|revenue/.test(k))
  expect(cards).toHaveLength(1) // one request for the three cards, in the order they attached
  expect(cards[0]!.split(',').sort()).toEqual(['revenue', 'signups', 'visits'])
  // The feed waits for the user (chained), and its first request fails once: it's retried.
  await expect(page.locator('#user-panel')).toContainText('Ada')
  await expect(page.locator('#activity li')).toHaveCount(3)
  expect(keys.filter((k) => k.startsWith('activity'))).toHaveLength(2)
  expect(keys.indexOf('user')).toBeLessThan(keys.findIndex((k) => k.startsWith('activity')))
  // Refresh: the user panel asks again.
  const before = keys.filter((k) => k === 'user').length
  await page.locator('#user-panel button', { hasText: 'Refresh' }).click()
  await expect.poll(() => keys.filter((k) => k === 'user').length).toBe(before + 1)
  expect(errors).toEqual([])
})

test('#287 caching: seen pages make no request, invalidate refetches what\'s shown', async ({ page }) => {
  const asked: string[] = [] // the page param of each list request (renames, and the @await demo's size=3, left out)
  page.on('request', (r) => { const u = new URL(r.url()); if (u.pathname === '/api/demo-records' && r.method() === 'GET' && u.searchParams.get('size') === '10') asked.push(u.searchParams.get('page')!) })
  await page.goto('/guide/fetching#caching')
  const list = page.locator('#record-list')
  await expect(list.locator('li').first()).toHaveText('Record 1')
  await expect.poll(() => asked).toEqual(['1', '2']) // page 1, and page 2 prefetched
  await list.getByRole('button', { name: 'Next' }).click()
  await expect(list.locator('li').first()).toHaveText(/^Record 11( \(renamed\))?$/)
  await list.getByRole('button', { name: 'Previous' }).click()
  await expect(list.locator('li').first()).toHaveText('Record 1')
  await list.getByRole('button', { name: 'Next' }).click()
  await expect(list.locator('li').first()).toHaveText(/^Record 11( \(renamed\))?$/)
  await expect.poll(() => asked.filter((p) => p === '1' || p === '2').length).toBe(2) // seen pages: from the cache
  expect(asked).toContain('3') // page 3 prefetched while on page 2
  // Edit: rename the first row on screen, then invalidate(['records']): the page on screen fetches again.
  const before = asked.length
  await list.getByRole('button', { name: 'Rename the first row' }).click()
  await expect(list.locator('li').first()).toHaveText('Record 11 (renamed)')
  expect(asked.slice(before)[0]).toBe('2') // the page on screen first (the next one is prefetched again after)
  expect(asked.slice(before)).not.toContain('1')
  await list.getByRole('button', { name: 'Previous' }).click() // page 1 was invalidated too: fetched on use
  await expect(list.locator('li').first()).toHaveText('Record 1')
  await expect.poll(() => asked.slice(before)).toContain('1')
})

test('quiz text from Markdown shows as written: `<script>` in an option is <script>, not &lt;script&gt;', async ({ page }) => {
  await page.goto('/learn/first-island#quiz')
  const quiz = page.locator('.quiz')
  await expect(quiz.getByRole('radio', { name: 'Only components with a <script>' })).toHaveCount(1)
  await quiz.locator('summary', { hasText: 'Show the answer' }).click()
  await expect(quiz.locator('.quiz-correct')).toHaveText('Answer: Only components with a <script>')
  await expect(quiz).not.toContainText('&lt;')
})

test('#284: every @see link in the packages\' JSDoc lands on a page with that section', async ({ page }) => {
  const { readdirSync, readFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const root = new URL('../../', import.meta.url).pathname
  const links = new Set<string>()
  for (const pkg of ['clarusjs', 'content', 'theme-docs']) {
    const dir = join(root, pkg, 'src')
    for (const f of readdirSync(dir, { recursive: true }) as string[]) {
      if (!/\.(ts|tscl)$/.test(f)) continue
      for (const m of readFileSync(join(dir, f), 'utf8').matchAll(/@see https:\/\/clarusjs\.com(\/[^\s)*]*)/g)) links.add(m[1]!)
    }
  }
  expect(links.size).toBeGreaterThan(20)
  for (const link of links) {
    const [path, anchor] = link.split('#')
    const res = await page.request.get(path!)
    expect(res.status(), link).toBe(200)
    if (anchor) expect(await res.text(), link).toContain(`id="${anchor}"`)
  }
})

test('#249 lists: $count, $first, $last, $even and $odd follow the list in an island', async ({ page }) => {
  await page.goto('/guide/lists')
  const demo = page.locator('#row-names')
  await expect(page.locator('cl-island[c="row-names"]')).toHaveAttribute('data-cl-ready', '')
  await expect(demo.locator('li')).toHaveText(['1 of 2 · first · even', '2 of 2 · last · odd'])
  await demo.getByRole('button', { name: 'Add a row' }).click()
  await expect(demo.locator('li')).toHaveText(['1 of 3 · first · even', '2 of 3 · odd', '3 of 3 · last · even'])
})

test('#585 lists: a nested @for numbers its rows with the outer index (let s = $index), and renumbers when rows move', async ({ page }) => {
  await page.goto('/guide/lists#nested-loops')
  const demo = page.locator('#nested-rows')
  await expect(demo.locator('.n')).toHaveText(['1.1', '1.2', '2.1']) // the server's render
  await expect(page.locator('cl-island[c="nested-rows"]')).toHaveAttribute('data-cl-ready', '')
  await demo.getByRole('button', { name: 'Add a section at the top' }).click()
  await expect(demo.locator('.n')).toHaveText(['1.1', '2.1', '2.2', '3.1'])
})

test('#259 h(): the playground builds HTML in load() with h(), and the page shows it as HTML (text stays escaped)', async ({ page }) => {
  await page.goto('/playground?name=%3Cb%3EAda%3C%2Fb%3E')
  const built = page.locator('#h-built')
  await expect(built.locator('.pill')).toHaveText('<b>Ada</b>') // a real pill; the name inside it is text
  await expect(built.locator('b')).toHaveCount(0)
  await expect(built.locator('em')).toHaveText('built with h()')
})

test('#241 forms: a checkbox group and the languages combobox bind arrays, starting from the server\'s selection', async ({ page }) => {
  // Before JavaScript: the server already rendered the choices (the checkbox checked, the language's chip).
  const html = (await (await page.request.get('/guide/forms')).text()).replace(/<!--.*?-->/g, '')
  expect(html).toMatch(/<span[^>]*data-part="chip"[^>]*>English\s*<button/)
  await page.goto('/guide/forms')
  const form = page.locator('form.signup').first()
  await expect(page.locator('cl-island[c="signup-form"]').first()).toHaveAttribute('data-cl-ready', '')
  const out = form.locator('.signup-lists')
  await expect(out).toHaveText("Topics: news · Languages: en")
  await form.getByRole('checkbox', { name: 'Releases' }).check()
  await form.getByRole('checkbox', { name: 'News' }).uncheck()
  const languages = form.getByRole('combobox', { name: 'Languages' })
  await languages.fill('kis')
  await languages.press('Enter')
  await expect(out).toHaveText('Topics: releases · Languages: en, sw')
})

test('#153: code in .tscl pages is highlighted like Markdown, and passes the contrast check', async ({ page }) => {
  for (const path of ['/', '/guide/explained', '/guide/verbatim']) {
    await page.goto(path)
    const block = page.locator('.code-block.language-tscl pre.shiki').first()
    await expect(block, path).toBeVisible()
    expect(await block.locator('span[style*="--shiki-light"]').count(), path).toBeGreaterThan(3)
    // The text is the code as written: holes and directives shown, not run.
    if (path === '/') await expect(block).toContainText('@input start: number = 0')
    if (path === '/') await expect(block).toContainText('Clicked {{ count }} times')
    const results = await new AxeBuilder({ page }).include('.code-block.language-tscl').withRules(['color-contrast']).analyze()
    expect(results.violations, path).toEqual([])
  }
})

test('#145: Markdown pages use components by tag, without importing them', async ({ page }) => {
  const source = readFileSync(resolve(import.meta.dirname, '../src/pages/guide/fetching.md'), 'utf8')
  expect(source).not.toMatch(/^@import statCard\b/m)
  await page.goto('/guide/fetching')
  await expect(page.locator('cl-island[c="statCard"], cl-island[c="stat-card"]').first()).toBeAttached()
  await page.goto('/guide/getting-started')
  await expect(page.locator('.pm-tabs').first()).toBeVisible() // the package-manager tabs, imported by their tag
})

test('#50: llms.txt lists the docs for AI tools, and llms-full.txt has their text', async ({ request }) => {
  const index = await (await request.get('/llms.txt')).text()
  expect(index.startsWith('# clarusjs\n\n> A compiler for .tscl components')).toBe(true)
  expect(index).toMatch(/^## Introduction$/m)
  expect(index).toContain('- [Getting started](https://clarusjs.com/guide/getting-started): Create a clarusjs project with Vite (or from a Vite template), write your first page and run it.')
  expect(index).not.toContain('/404')
  const full = await (await request.get('/llms-full.txt')).text()
  expect(full).toContain('Source: https://clarusjs.com/guide/getting-started\n\n# Getting started')
  expect(full).not.toContain('description: "Create a clarusjs project') // no frontmatter
  expect(full).toContain('Source: https://clarusjs.com/guide/explained') // a template page, as its text
})

test('#93: the server demo remembers your name in a cookie, set by its load()', async ({ page, context }) => {
  await page.goto('/playground?name=Ada')
  await expect(page.locator('#greeting')).toHaveText('Hello, Ada!')
  const cookie = (await context.cookies()).find((c) => c.name === 'playground-name')
  expect(cookie?.value).toBe('Ada')
  expect(cookie?.httpOnly).toBe(true)
  expect(cookie?.sameSite).toBe('Lax')
  await page.goto('/playground')
  await expect(page.locator('#greeting')).toHaveText('Hello, Ada!')
  // A blank name forgets it.
  await page.goto('/playground?name=%20')
  await expect(page.locator('#greeting')).toContainText('Type a name')
  expect((await context.cookies()).some((c) => c.name === 'playground-name')).toBe(false)
})

test('#95: the demo endpoints answer reads and same-site writes, and refuse a cross-site write', async ({ request }) => {
  const stats = await request.get('/api/demo-stats?keys=visits')
  expect(await stats.json()).toEqual({ visits: 12400 })
  const base = new URL(test.info().project.use.baseURL!).origin
  const ok = await request.post('/api/demo-records', { headers: { origin: base }, data: { rename: 3 } })
  expect(await ok.json()).toEqual({ ok: true })
  const evil = await request.post('/api/demo-records', { headers: { origin: 'https://evil.example' }, data: { rename: 4 } })
  expect(evil.status()).toBe(403)
  expect((await request.put('/api/demo-records', { headers: { origin: base } })).status()).toBe(405)
})

test('#96: the auth guide signs in through an endpoint; the HttpOnly cookie keeps you signed in; sign out', async ({ page, context }) => {
  await page.goto('/guide/auth')
  const demo = page.locator('.sign-in-demo')
  await demo.getByLabel('Name').fill('Grace')
  await demo.getByRole('button', { name: 'Sign in' }).click()
  await expect(demo.locator('.signed-in')).toHaveText('Signed in as Grace.')
  const cookie = (await context.cookies()).find((c) => c.name === 'demo-user')
  expect(cookie?.httpOnly).toBe(true)
  expect(await page.evaluate(() => document.cookie)).not.toContain('demo-user') // scripts can't read it
  await page.reload()
  await expect(demo.locator('.signed-in')).toHaveText('Signed in as Grace.')
  await demo.getByRole('button', { name: 'Sign out' }).click()
  await expect(demo.getByRole('button', { name: 'Sign in' })).toBeVisible()
  expect((await context.cookies()).some((c) => c.name === 'demo-user')).toBe(false)
})

test('#97: a component loads its own data (the latest release), without the page passing it', async ({ page }) => {
  await page.goto('/releases')
  const latest = page.locator('.latest-release')
  const first = await page.locator('.releases li a').first().textContent()
  await expect(latest).toContainText(`Latest: ${first}`)
  await expect(latest).toContainText(/with \d+ changes/)
})

test("#361: the site's own footer, in place of the theme's, on every kind of page", async ({ page }) => {
  for (const path of ['/', '/guide/islands', '/learn/progress']) {
    await page.goto(path)
    const footer = page.locator('footer.site-footer')
    await expect(footer, path).toContainText('MIT licensed')
    await expect(footer.getByRole('link', { name: 'For AI agents' }), path).toHaveAttribute('href', '/guide/ai-coding')
  }
})

test('#369: the sidebar as designed: groups collapse, the current one is open, search opens from the sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/guide/islands')
  const group = (title: string) => page.locator(`#sidebar details[data-group="${title}"]`)
  await expect(group('Interactivity')).toHaveAttribute('open', '')
  await expect(group('Site quality')).not.toHaveAttribute('open')
  await expect(group('Site quality').locator('a').first()).toBeHidden()
  await group('Site quality').locator('summary').click()
  await expect(group('Site quality').locator('a').first()).toBeVisible()
  await expect(page.locator('#sidebar a[aria-current="page"]')).toHaveText('Islands')
  await expect(page.locator('#sidebar a[href="/guide/tailwind"] .badge')).toHaveText('New')
  // Search: the sidebar's box, not the header's button, which hides where the sidebar shows.
  await expect(page.locator('.site-header .search-button')).toBeHidden()
  await page.locator('#sidebar [data-search-open]').click()
  await expect(page.locator('dialog.search-dialog')).toBeVisible()
  await expect(page.locator('dialog.search-dialog input')).toBeFocused()
})

test('#369: a page in a collapsed group opens it', async ({ page }) => {
  await page.goto('/guide/deploy')
  await expect(page.locator('#sidebar details[data-group="Build & deploy"]')).toHaveAttribute('open', '')
})

test('code blocks have line numbers, except shell commands', async ({ page }) => {
  await page.goto('/guide/markdown')
  const ts = page.locator('.code-block.language-ts').first()
  await expect(ts).toHaveClass(/line-numbers/)
  await expect(ts.locator('.line-numbers-column span').first()).toHaveText('1')
  await page.goto('/guide/getting-started')
  const sh = page.locator('.code-block.language-sh').first()
  await expect(sh).toBeVisible()
  await expect(sh).not.toHaveClass(/line-numbers/)
})

test('#370: the phone drawer as designed: Menu, a Learn / Guide switch, groups, and a links row', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto('/guide/islands')
  await page.locator('.menu-button').click()
  const drawer = page.locator('#sidebar')
  await expect(drawer.locator('.sidebar-head')).toContainText('Menu')
  await expect(drawer.locator('.sidebar-switch a')).toHaveText(['Learn', 'Guide'])
  await expect(drawer.locator('.sidebar-switch a[aria-current="true"]')).toHaveText('Guide')
  await expect(drawer.locator('[data-search-open]')).toBeHidden() // the header's search button is there
  await expect(drawer.locator('.sidebar-links a')).toHaveText(['Components', 'Reference', 'Releases', 'UI', 'GitHub', 'npm'])
  await expect(drawer.locator('.sidebar-links')).toBeInViewport()
  // Nothing wider than the drawer.
  expect(await drawer.evaluate((d) => d.scrollWidth <= d.clientWidth)).toBe(true)
  await drawer.locator('.sidebar-switch a', { hasText: 'Learn' }).click()
  await expect(page).toHaveURL(/\/learn\//)
})

test('#371: a lesson has the Learn path: progress, done / next / locked, XP, its steps following the bar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  // Lessons 1 and 2 done: 3 is the one to do, 4 is next, 5 and 6 are locked.
  await page.addInitScript(() => localStorage.setItem('clarusjs-learn', JSON.stringify({ v: 1, steps: {}, done: ['/learn/first-page', '/learn/templates'], quizzes: {} })))
  await page.goto('/learn/first-island')
  const path = page.locator('.learn-path')
  await expect(path).toContainText('Your first site')
  await expect(path).toContainText('2 of 6')
  const lessons = path.locator('> ol > li')
  await expect(lessons).toHaveCount(6)
  await expect(lessons.nth(0)).toHaveAttribute('data-status', 'done')
  await expect(lessons.nth(0)).toContainText('Done')
  await expect(lessons.nth(2).locator('a').first()).toHaveAttribute('aria-current', 'page')
  await expect(lessons.nth(2)).toContainText('5 min')
  await expect(lessons.nth(2)).toContainText(/\+\d+/)
  await expect(lessons.nth(3)).toHaveAttribute('data-status', 'next')
  await expect(lessons.nth(4)).toHaveAttribute('data-status', 'locked')
  await expect(lessons.nth(4)).toContainText('Finish lesson 4 first')
  await expect(path.locator('.path-footer')).toContainText(/\d+ XP · \d+ badges?\b/)
  // The steps follow the bar.
  const steps = path.locator('.path-steps li')
  await expect(steps.first()).toHaveAttribute('data-step', 'current')
  await page.locator('.lesson-bar').getByRole('button', { name: 'Continue' }).click()
  await expect(steps.nth(0)).toHaveAttribute('data-step', 'done')
  await expect(steps.nth(1)).toHaveAttribute('data-step', 'current')
  // Phones: the header's segments, no path.
  await page.setViewportSize({ width: 390, height: 800 })
  await expect(path).toBeHidden()
})

test('#372: the home is a bento grid: live islands in cards, columns on desktop, one column on phones', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  const bento = page.getByRole('region', { name: 'What you get' })
  const cards = bento.locator('.bento-card')
  expect(await cards.count()).toBeGreaterThanOrEqual(7)
  for (const card of await cards.all()) await expect(card.locator('h3')).toHaveCount(1) // each card is titled
  // The live demos are cards: the counter (with what ships) and the list.
  await expect(bento.locator('.bento-card cl-island[c="counter"]')).toHaveCount(1)
  await expect(bento.locator('.bento-card cl-island[c="what-ships"]')).toHaveCount(1)
  await expect(bento.locator('.bento-card cl-island[c="todo"]')).toHaveCount(1)
  // Desktop: cards share rows, and the islands card spans more than the others.
  const tops = await cards.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)))
  expect(new Set(tops).size).toBeLessThan(tops.length)
  const width = (i: number) => cards.nth(i).evaluate((el) => el.getBoundingClientRect().width)
  expect(await width(0)).toBeGreaterThan(await width(1))
  // Phones: one column, nothing wider than the screen.
  await page.setViewportSize({ width: 390, height: 800 })
  const lefts = await cards.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left)))
  expect(new Set(lefts).size).toBe(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

// Every page, as a phone (light) and a desktop (dark) see it: no WCAG 2.2 AA or best-practice violation axe finds.
// (A full audit found the phone search button unnamed, small lesson segments, unfocusable scrolling tables and low
// contrast in dark mode, each only in one of these two.)
for (const [label, viewport, colorScheme] of [['phone, light', { width: 390, height: 800 }, 'light'], ['desktop, dark', { width: 1280, height: 900 }, 'dark']] as const) {
  test(`a11y: every page passes axe (${label})`, async ({ browser }) => {
    test.setTimeout(240_000)
    const sitemap = readFileSync(new URL('../dist/client/sitemap.xml', import.meta.url), 'utf8')
    const paths = [...sitemap.matchAll(/<loc>https?:\/\/[^/<]+(\/[^<]*)<\/loc>/g)].map((m) => m[1]!)
    expect(paths.length).toBeGreaterThan(50)
    const context = await browser.newContext({ viewport, colorScheme, reducedMotion: 'reduce' })
    const page = await context.newPage()
    const failures: string[] = []
    for (const path of paths) {
      await page.goto(path)
      // No transitions: the reduced-motion rule makes every change a 0.01ms one, so a button leaving [disabled] when
      // its data arrives keeps its disabled colours for a frame, and axe measuring that frame fails contrast.
      await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important }' })
      const { violations } = await (await axe(page)).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze()
      for (const v of violations) failures.push(`${path} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
    }
    await context.close()
    expect(failures).toEqual([])
  })
}

test('icons: <icon> is inline SVG, 1em high, hidden from screen readers, with no script for it', async ({ page }) => {
  const scripts: string[] = []
  page.on('request', (r) => { if (r.resourceType() === 'script') scripts.push(r.url()) })
  await page.goto('/guide/icons')
  const demo = page.locator('.icon-demo svg').first()
  await expect(demo).toHaveAttribute('aria-hidden', 'true')
  await expect(demo).toHaveAttribute('viewBox', '0 0 24 24')
  const { svg, text } = await demo.evaluate((el) => ({ svg: el.getBoundingClientRect().height, text: parseFloat(getComputedStyle(el.parentElement!).fontSize) }))
  expect(Math.abs(svg - text)).toBeLessThan(1) // 1em: the size of the text around it
  // The guide's example is what the page shows.
  await expect(page.locator('pre').filter({ hasText: '<icon name="lucide:rocket" />' }).first()).toBeVisible()
  expect(scripts.filter((u) => /icon/i.test(u))).toEqual([])
  // The home's cards carry icons too.
  await page.goto('/')
  await expect(page.locator('.bento-kicker svg').first()).toHaveAttribute('aria-hidden', 'true')
})

test('sitemap: /releases is dated by the changelog it is built from (its own lastmod), and the marker is gone from the page', async () => {
  const { execFileSync } = await import('node:child_process')
  // The commit's time as a UTC date, as the build writes it (%cs would be the committer's own timezone's date).
  const seconds = Number(execFileSync('git', ['log', '-1', '--format=%ct', '--', '../clarusjs/CHANGELOG.md'], { encoding: 'utf8' }).trim())
  const changelog = new Date(seconds * 1000).toISOString().slice(0, 10)
  const sitemap = readFileSync(new URL('../dist/client/sitemap.xml', import.meta.url), 'utf8')
  expect(sitemap).toContain(`<url><loc>https://clarusjs.com/releases</loc><lastmod>${changelog}</lastmod>`)
  expect(readFileSync(new URL('../dist/client/releases/index.html', import.meta.url), 'utf8')).not.toContain('sitemap:lastmod')
})

test('getting started: create the project, its scripts and files, run it; from a Vite template too', async ({ page }) => {
  await page.goto('/guide/getting-started')
  const content = page.locator('main')
  await expect(content.getByRole('heading', { name: 'Create a project' })).toBeVisible()
  await expect(content.locator('pre').filter({ hasText: '"dev": "vite"' })).toContainText('"build": "vite build"')
  await expect(content.locator('pre').filter({ hasText: '├── vite.config.ts' }).filter({ hasText: 'index.tscl' }).first()).toBeVisible() // the file tree
  await expect(content.getByRole('heading', { name: 'From a Vite template' })).toBeVisible()
  await expect(content).toContainText('index.html')
})

test("what clarusjs is: no 'early, proving ground' note on the intro or the home", async ({ page }) => {
  for (const path of ['/guide/what-is-clarusjs', '/']) {
    await page.goto(path)
    await expect(page.locator('main')).not.toContainText('proving ground')
  }
})

test('attributes: the guide\'s demo toggles a class, sets a style property and spreads attributes, following state', async ({ page }) => {
  await page.goto('/guide/attributes')
  const button = page.locator('.attr-demo-button')
  await expect(page.locator('cl-island[c="attr-demo"]')).toHaveAttribute('data-cl-ready', '')
  await expect(button).toHaveAttribute('aria-pressed', 'false')
  await expect(button).toHaveAttribute('style', '--hue: 180;')
  await expect(button).not.toHaveClass(/\bon\b/)
  await button.click()
  await expect(button).toHaveClass(/\bon\b/)
  await expect(button).toHaveAttribute('aria-pressed', 'true')
  await expect(button).toHaveAttribute('title', 'On')
  await page.locator('.attr-demo input[type="range"]').fill('20')
  await expect(button).toHaveAttribute('style', '--hue: 20;')
  // The guide says what isn't supported, and why.
  await expect(page.getByRole('heading', { name: 'Not supported, and why' })).toBeVisible()
})

test('this site, explained: one table to filter, sort by any column, sample and trim to some columns', async ({ page }) => {
  const { readFileSync } = await import('node:fs')
  const routes = Object.entries(JSON.parse(readFileSync(new URL('../dist/clarusjs-manifest.json', import.meta.url), 'utf8')).routes) as [string, { mode: string; js: { initialGzip: number } }][]
  await page.goto('/guide/explained')
  await expect(page.locator('.explained-stats li strong').first()).toHaveText(String(routes.length))
  const table = page.locator('table.explained')
  const rows = table.locator('tbody tr')
  const loads = async () => (await rows.locator('td:nth-child(3)').allTextContents()).map((t) => parseFloat(t))
  // Heaviest first, 10 rows, until JavaScript runs too: the server renders the default view.
  await expect(rows).toHaveCount(10)
  await expect(page.locator('cl-island[c="explained-table"]')).toHaveAttribute('data-cl-ready', '')
  const heavy = await loads()
  expect(heavy).toEqual([...heavy].sort((a, b) => b - a))
  // Smallest first; then a header sorts by its column, and again reverses it.
  await page.getByLabel('Show').selectOption('smallest')
  const light = await loads()
  expect(light).toEqual([...light].sort((a, b) => a - b))
  await table.getByRole('button', { name: 'Route' }).click()
  await expect(table.locator('th').first()).toHaveAttribute('aria-sort', 'ascending')
  const names = (await rows.locator('td:first-child').allTextContents()).map((t) => t.trim())
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  await table.getByRole('button', { name: 'Route' }).click()
  await expect(table.locator('th').first()).toHaveAttribute('aria-sort', 'descending')
  // Filters: a section and a search; no JavaScript on load.
  await page.getByLabel('Section').selectOption('Reference')
  await page.getByLabel('Rows').selectOption('all')
  for (const r of (await rows.locator('td:first-child').allTextContents()).map((t) => t.trim())) expect(r).toMatch(/^\/reference/)
  await page.getByLabel('Find').fill('template')
  await expect(rows).toHaveCount(1)
  await page.getByLabel('Find').fill('')
  await page.getByLabel('Section').selectOption('All')
  await page.getByLabel('Show').selectOption('nojs')
  await expect(rows).toHaveCount(routes.filter(([, r]) => r.mode !== 'server' && r.js.initialGzip === 0).length || 1)
  await expect(page.locator('.explained-count')).toContainText(`(${routes.length} pages)`)
  // Nothing matches: an empty state that says so, with a way back.
  await page.getByLabel('Show').selectOption('heaviest')
  await page.getByLabel('Find').fill('zzzz')
  const empty = page.locator('.explained-empty')
  await expect(empty).toBeVisible()
  await expect(empty).toContainText('No page matches')
  await expect(empty).toContainText('"zzzz"')
  await empty.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page.getByLabel('Find')).toHaveValue('')
  await expect(rows).toHaveCount(routes.length) // Rows is still All: only the filters were cleared
  // A server route's JavaScript is decided per request: said so, and never counted as none.
  await page.getByLabel('Show').selectOption('route')
  await page.getByLabel('Find').fill('/playground')
  await expect(rows.first()).toContainText('per request')
  await page.getByLabel('Show').selectOption('nojs')
  await expect(page.locator('.explained-empty')).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).click()
  // Columns: unchecked, gone.
  await page.getByLabel('Show').selectOption('heaviest')
  await page.getByRole('checkbox', { name: 'Islands' }).uncheck()
  await expect(table.locator('thead th')).toHaveText(['Route', 'JS on load', 'JS in all'])
})

test('what clarusjs is: where the name comes from, and how to say it', async ({ page }) => {
  await page.goto('/guide/what-is-clarusjs')
  await expect(page.getByRole('heading', { name: 'The name' })).toBeVisible()
  await expect(page.locator('main')).toContainText('KLAIR-us')
  await expect(page.locator('main')).toContainText('Latin for "clear"')
})

test('what clarusjs is: a button says the name (the browser\'s speech, KLAIR-us in English)', async ({ page }) => {
  await page.addInitScript(() => {
    const said: { text: string; lang: string }[] = []
    ;(window as unknown as { __said: typeof said }).__said = said
    // A stand-in for the browser's voice: records what would be said.
    window.speechSynthesis.speak = (u: SpeechSynthesisUtterance) => { said.push({ text: u.text, lang: u.lang }) }
    window.speechSynthesis.cancel = () => {}
  })
  await page.goto('/guide/what-is-clarusjs')
  const button = page.getByRole('button', { name: 'Hear “clarus”' })
  await expect(button).toBeVisible()
  await button.click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __said: unknown[] }).__said)).toEqual([{ text: 'Klair-us', lang: 'en-US' }])
})

test('#431 fetching: a CSV read as text, Cancel aborts without an error, a slow server times out, onSuccess/onError say so', async ({ page }) => {
  await page.goto('/guide/fetching#cancelling-and-timeouts')
  const demo = page.locator('#export')
  await expect(demo.locator('xpath=ancestor::cl-island')).toHaveAttribute('data-cl-ready', '')
  const status = demo.getByRole('status')
  await demo.getByRole('button', { name: 'Export CSV' }).click()
  await expect(status).toHaveText('Exported 3 rows.')
  await expect(demo.locator('.export-csv')).toContainText('1,Ada,12')
  // Cancel while the slow server works: idle again, no error, the last CSV kept.
  await demo.getByLabel('Slow server (4 s)').check()
  await demo.getByRole('button', { name: 'Export CSV' }).click()
  await expect(status).toHaveText('Exporting…')
  await demo.getByRole('button', { name: 'Cancel' }).click()
  await expect(status).toHaveText('Cancelled.')
  await expect(demo.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  await expect(demo.locator('.export-csv')).toContainText('1,Ada,12')
  // Left to run, the slow export hits the 2.5 s timeout: an error, so onError writes the status.
  await demo.getByRole('button', { name: 'Export CSV' }).click()
  await expect(status).toHaveText('Timed out after 2.5 s.', { timeout: 6000 })
})

test('#429 fetching: Rename is an action: pending while it runs, a second click joins it, a failure shows its error', async ({ page }) => {
  let posts = 0
  let fail = false
  await page.route('**/api/demo-records', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    posts++
    await new Promise((done) => setTimeout(done, 400))
    return fail ? route.fulfill({ status: 500, body: 'down' }) : route.continue()
  })
  await page.goto('/guide/fetching#caching')
  const list = page.locator('#record-list')
  await expect(list.locator('xpath=ancestor::cl-island')).toHaveAttribute('data-cl-ready', '')
  // Records matching 77 only: the server keeps renames in memory, and the caching test checks page 1.
  await list.getByLabel('Filter records').fill('77')
  await expect(list.locator('li').first()).toHaveText(/^Record 77/)
  const rename = list.getByRole('button', { name: /Rename the first row|Renaming…/ })
  await rename.click()
  await expect(rename).toHaveText('Renaming…')
  await expect(rename).toBeDisabled()
  await rename.dispatchEvent('click') // a second click while it runs (the button is disabled; the action joins anyway)
  await expect(rename).toHaveText('Rename the first row')
  expect(posts).toBe(1)
  await expect(list.getByRole('alert')).toHaveCount(0)
  fail = true
  await rename.click()
  await expect(list.getByRole('alert')).toHaveText("Couldn't rename it. Try again.")
  await expect(rename).toBeEnabled()
})

test('#430 <script server>: /guide/explained computes its numbers and awaits the build\'s commit on the server; nothing of it ships', async ({ page }) => {
  const html = await (await page.request.get('/guide/explained')).text()
  expect(html).toMatch(/Built from commit <code>[0-9a-f]{7,}<\/code>/)
  expect(html).not.toContain('child_process') // the server script's code and imports stay on the server
  await page.goto('/guide/explained')
  await expect(page.locator('.explained-stats li strong').first()).toHaveText(/^\d+$/)
})

test('#430 @await: the island shows Loading, then the rows; Next page loads again; a failure shows @catch', async ({ page }) => {
  let failNext = false
  await page.route('**/api/demo-records?page=*&size=3', (route) => (failNext ? route.fulfill({ status: 503, body: 'down' }) : route.continue()))
  const html = await (await page.request.get('/guide/fetching')).text()
  expect(html.replace(/<!--.*?-->/g, '')).toContain('Loading page 1…') // the server renders the pending branch
  await page.goto('/guide/fetching#in-an-island-await')
  const demo = page.locator('#await-demo')
  await expect(demo.locator('li')).toHaveCount(3)
  await expect(demo.locator('li').first()).toHaveText(/^Record 1( \(renamed\))?$/)
  await demo.getByRole('button', { name: 'Next page' }).click()
  await expect(demo.locator('li').first()).toHaveText(/^Record 4( \(renamed\))?$/)
  failNext = true
  await demo.getByRole('button', { name: 'Next page' }).click()
  await expect(demo.getByRole('alert')).toHaveText("Couldn't load page 3.")
})

test('combobox: search narrows the list; one pick by keyboard and by click; several as chips, removed by button and Backspace', async ({ page }) => {
  await page.goto('/guide/forms#a-combobox')
  const demo = page.locator('#combobox-demo')
  for (const island of await demo.locator('cl-island').all()) await expect(island).toHaveAttribute('data-cl-ready', '')
  const picked = demo.locator('.picked code')
  await expect(picked).toHaveText('{"country":"","languages":["en"],"city":""}')
  // One pick: type to search, arrows to move, Enter to pick; the field then shows its label.
  const country = demo.getByRole('combobox', { name: 'Country' })
  await expect(country).toHaveAttribute('aria-expanded', 'false')
  await country.fill('an')
  await expect(country).toHaveAttribute('aria-expanded', 'true')
  const countries = demo.getByRole('listbox', { name: 'Country' })
  await expect(countries.getByRole('option')).toHaveText(['Ghana', 'Tanzania', 'Uganda', 'Rwanda'])
  await country.press('ArrowDown')
  await expect(country).toHaveAttribute('aria-activedescendant', 'demo-country-tz')
  await country.press('Enter')
  await expect(picked).toHaveText('{"country":"tz","languages":["en"],"city":""}')
  await expect(country).toHaveValue('Tanzania')
  await expect(countries).toBeHidden()
  // Nothing matches: said so; Esc closes.
  await country.fill('zzz')
  await expect(demo.getByRole('status').first()).toHaveText('No match for "zzz"')
  await country.press('Escape')
  await expect(country).toHaveAttribute('aria-expanded', 'false')
  // By click.
  await country.click()
  await countries.getByRole('option', { name: 'Kenya' }).click()
  await expect(picked).toHaveText('{"country":"ke","languages":["en"],"city":""}')
  // Several: chips, each with a remove button; the list stays open; Backspace removes the last one.
  const languages = demo.getByRole('combobox', { name: 'Languages' })
  await languages.click()
  const list = demo.getByRole('listbox', { name: 'Languages' })
  await expect(list).toHaveAttribute('aria-multiselectable', 'true')
  await list.getByRole('option', { name: 'Swahili' }).click()
  await languages.fill('fr')
  await languages.press('Enter')
  await expect(picked).toHaveText('{"country":"ke","languages":["en","sw","fr"],"city":""}')
  await expect(list.getByRole('option', { name: /English/ })).toHaveAttribute('aria-selected', 'true')
  await demo.getByRole('button', { name: 'Remove English' }).click()
  await expect(picked).toHaveText('{"country":"ke","languages":["sw","fr"],"city":""}')
  await languages.press('Backspace')
  await expect(picked).toHaveText('{"country":"ke","languages":["sw"],"city":""}')
  // Leaving closes it.
  await page.getByRole('heading', { name: 'A combobox' }).click()
  await expect(list).toBeHidden()
})

test('combobox: options from the server, asked once typing pauses, the newest search wins; the pick keeps its label', async ({ page }) => {
  const asked: string[] = []
  page.on('request', (r) => { const u = new URL(r.url()); if (u.pathname === '/api/demo-cities') asked.push(u.searchParams.get('q')!) })
  await page.goto('/guide/forms#a-combobox')
  const demo = page.locator('#combobox-demo')
  for (const island of await demo.locator('cl-island').all()) await expect(island).toHaveAttribute('data-cl-ready', '')
  expect(asked).toEqual([]) // nothing until it opens
  const city = demo.getByRole('combobox', { name: 'City' })
  await city.pressSequentially('nai', { delay: 30 }) // keys closer than the 200 ms debounce: one search
  await expect(demo.getByRole('listbox', { name: 'City' }).getByRole('option')).toHaveText(['Nairobi'])
  expect(asked.filter((q) => q !== '')).toEqual(['nai'])
  await city.press('Enter')
  await expect(demo.locator('.picked code')).toHaveText('{"country":"","languages":["en"],"city":"nairobi"}')
  await expect(city).toHaveValue('Nairobi') // its label, though no search lists it now
  // Searching: said while the server works.
  await city.click()
  await city.fill('lu')
  await expect(demo.getByRole('status').filter({ hasText: 'Searching…' })).toBeVisible()
  await expect(demo.getByRole('listbox', { name: 'City' }).getByRole('option')).toHaveText(['Luanda', 'Lusaka'])
})

test('form validation: every text field has a placeholder showing what to write', async ({ page }) => {
  const demo = await stepsDemo(page)
  await expect(demo.locator('#signup-name')).toHaveAttribute('placeholder', 'Ada Lovelace')
  await expect(demo.locator('#signup-email')).toHaveAttribute('placeholder', 'ada@example.com')
  await expect(demo.locator('#signup-username')).toHaveAttribute('placeholder', 'ada')
})

test('#455 scoped slots: the page renders each row of the list with the data its slot passes, on the server', async ({ page }) => {
  const html = (await (await page.request.get('/guide/slots')).text()).replace(/<!--.*?-->/g, '')
  await page.goto('/guide/slots#slots-that-pass-data')
  const demo = page.locator('#slots-demo')
  const plain = demo.getByRole('region', { name: 'Unfilled: the list\'s own rows' })
  await expect(plain.getByRole('listitem')).toHaveText(['Make a page', 'Add an island', 'Ship it'])
  const filled = demo.getByRole('region', { name: 'Filled: the page renders each row' })
  await expect(filled.getByRole('listitem')).toHaveText(['1. Make a page first-page', '2. Add an island first-island', '3. Ship it ship-it'])
  await expect(filled.locator('strong').first()).toHaveText('1.')
  const empty = demo.getByRole('region', { name: 'Empty, with the page\'s message' })
  await expect(empty.getByRole('link', { name: 'Start the Learn path' })).toHaveAttribute('href', '/learn/first-page')
  expect(html).toMatch(/<strong[^>]*>1\.<\/strong>\s*Make a page/) // in the server's HTML: no JavaScript involved
})

test('#472 scoped slots in an island: the fill shows the data its slot passes, and follows the island\'s state', async ({ page }) => {
  await page.goto('/guide/slots')
  const demo = page.locator('#slots-island-demo')
  await expect(demo.getByRole('listitem')).toHaveText(['1 of 2. Make a page', '2 of 2. Add an island'])
  await expect(page.locator('cl-island[c="slots-island-demo"]')).toHaveAttribute('data-cl-ready', '')
  await demo.getByRole('button', { name: 'Add a step' }).click()
  await expect(demo.getByRole('listitem')).toHaveText(['1 of 3. Make a page', '2 of 3. Add an island', '3 of 3. Ship it'])
})

// #454: Fetching recipes, each live recipe doing what its code says.
async function recipe(page: import('@playwright/test').Page, id: string) {
  const box = page.locator('#' + id)
  await expect(box.locator('xpath=ancestor::cl-island')).toHaveAttribute('data-cl-ready', '')
  return box
}

test('#454 recipes: search waits for a pause, then shows the matches', async ({ page }) => {
  const asked: string[] = []
  page.on('request', (r) => { const u = new URL(r.url()); if (u.pathname === '/api/demo-cities') asked.push(u.searchParams.get('q')!) })
  await page.goto('/guide/fetching-recipes#search-as-you-type')
  const box = await recipe(page, 'recipe-search')
  await box.getByRole('searchbox').pressSequentially('nai', { delay: 40 })
  await expect(box.getByRole('listitem')).toHaveText(['Nairobi'])
  expect(asked).toEqual(['nai'])
})

test('#454 recipes: a newer search cancels the request still in flight, and its answer never shows', async ({ page }) => {
  const cancelled: string[] = []
  page.on('requestfailed', (r) => { const u = new URL(r.url()); if (u.pathname === '/api/demo-cities') cancelled.push(u.searchParams.get('q')!) })
  await page.route('**/api/demo-cities?q=na', async (route) => { await new Promise((r) => setTimeout(r, 1500)); await route.fulfill({ json: [{ value: 'x', label: 'Stale' }] }).catch(() => {}) })
  await page.goto('/guide/fetching-recipes#search-as-you-type')
  const box = await recipe(page, 'recipe-search')
  await box.getByRole('searchbox').fill('na')
  await page.waitForRequest((r) => r.url().includes('q=na'))
  await box.getByRole('searchbox').fill('nai')
  await expect(box.getByRole('listitem')).toHaveText(['Nairobi'])
  await expect.poll(() => cancelled).toEqual(['na']) // the browser aborted the older request
  await page.waitForTimeout(1600)
  await expect(box.getByRole('listitem')).toHaveText(['Nairobi'])
})

test('#454 recipes: load more appends the next page', async ({ page }) => {
  await page.goto('/guide/fetching-recipes#load-more')
  const box = await recipe(page, 'recipe-load-more')
  await expect(box.getByRole('listitem')).toHaveCount(5)
  await box.getByRole('button', { name: 'Load more' }).click()
  await expect(box.getByRole('listitem')).toHaveCount(10)
  await expect(box.getByRole('listitem').nth(5)).toHaveText(/^Record 6/)
})

test('#454 recipes: load more retries a failed page instead of skipping it', async ({ page }) => {
  let failed = false
  await page.route('**/api/demo-records?page=2*', (route) => (failed ? route.fallback() : ((failed = true), route.fulfill({ status: 503, json: { error: 'busy' } }))))
  await page.goto('/guide/fetching-recipes#load-more')
  const box = await recipe(page, 'recipe-load-more')
  await expect(box.getByRole('listitem')).toHaveCount(5)
  await box.getByRole('button', { name: 'Load more' }).click()
  await expect(box.getByRole('alert')).toHaveText("Couldn't load page 2.")
  await box.getByRole('button', { name: 'Try again' }).click()
  await expect(box.getByRole('listitem')).toHaveCount(10)
  await expect(box.getByRole('listitem').nth(5)).toHaveText(/^Record 6/) // page 2, not page 3
})

test('#454 recipes: polling asks again every 2 seconds', async ({ page }) => {
  await page.goto('/guide/fetching-recipes#polling')
  const box = await recipe(page, 'recipe-poll')
  const asked = box.locator('.asked')
  await expect(asked).toHaveText(/^\d+$/)
  const first = Number(await asked.textContent())
  await expect.poll(async () => Number(await asked.textContent()), { timeout: 6000 }).toBeGreaterThan(first)
})

test('#454 recipes: an optimistic like shows at once, and rolls back when the server fails', async ({ page }) => {
  await page.goto('/guide/fetching-recipes#optimistic-update-with-rollback')
  const box = await recipe(page, 'recipe-optimistic')
  const button = box.getByRole('button', { name: /♥/ })
  await expect(button).toHaveText(/♥ \d+/)
  const before = Number((await button.textContent())!.replace(/\D/g, ''))
  await button.click()
  await expect(button).toHaveText(`♥ ${before + 1}`) // at once
  await expect(button).toBeEnabled() // the server answered
  await expect(button).toHaveText(`♥ ${before + 1}`)
  await box.getByLabel('Make the server fail').check()
  await button.click()
  await expect(button).toHaveText(`♥ ${before + 2}`)
  await expect(box.getByRole('alert')).toContainText('The count went back.')
  await expect(button).toHaveText(`♥ ${before + 1}`)
})

/** Holds the next write (POST, PUT) to `url` until `release()`: to see what shows before the server answers. */
async function hold(page: import('@playwright/test').Page, url: string) {
  let release!: () => void
  const gate = new Promise<void>((done) => { release = done })
  await page.route(url, async (route) => {
    if (route.request().method() === 'GET') return route.continue()
    await gate
    await route.continue()
  }, { times: 1 })
  return release
}

test('recipes: a feed shows a post and a like at once; the server\'s answer replaces them, a failure takes them back', async ({ page }) => {
  await page.goto('/guide/fetching-recipes#a-feed-posts-and-likes-optimistic')
  const box = await recipe(page, 'recipe-feed')
  await expect(box.getByRole('listitem').first()).toBeVisible()
  const text = `Hello ${Date.now()}`
  let release = await hold(page, '**/api/demo-posts**')
  await box.getByLabel('New post').fill(text)
  await box.getByRole('button', { name: 'Post' }).click()
  const mine = box.getByRole('listitem').filter({ hasText: text })
  await expect(mine).toContainText('Posting…') // before the server answers
  await expect(box.getByLabel('New post')).toHaveValue('')
  release()
  const like = mine.getByRole('button', { name: `Like: ${text}` })
  await expect(like).toHaveText('♥ 0') // published: the server's copy
  await expect(mine).not.toContainText('Posting…')
  await like.click()
  await expect(like).toHaveAttribute('aria-pressed', 'true')
  await expect(like).toHaveText('♥ 1')
  await expect(like).toBeEnabled() // the server answered
  // A failing unlike: shown at once, and while it's on its way the same post can't be toggled again (the rollback
  // would otherwise race another one); then it goes back.
  await box.getByLabel('Make the server fail').check()
  release = await hold(page, '**/api/demo-posts**')
  await like.click()
  await expect(like).toHaveText('♥ 0')
  await expect(like).toBeDisabled()
  release()
  await expect(box.getByRole('alert')).toHaveText('The like wasn’t saved. It was taken back.')
  await expect(like).toHaveText('♥ 1')
  await expect(like).toHaveAttribute('aria-pressed', 'true')
  // A failing post: taken back, its text back in the box to try again...
  const lost = `Lost ${Date.now()}`
  release = await hold(page, '**/api/demo-posts**')
  await box.getByLabel('New post').fill(lost)
  await box.getByRole('button', { name: 'Post' }).click()
  await expect(box.getByRole('listitem').filter({ hasText: lost })).toContainText('Posting…')
  release()
  await expect(box.getByRole('alert')).toHaveText('The post wasn’t published. It was taken back.')
  await expect(box.getByRole('listitem').filter({ hasText: lost })).toHaveCount(0)
  await expect(box.getByLabel('New post')).toHaveValue(lost)
  // ...unless a newer draft was typed meanwhile: that one stays.
  release = await hold(page, '**/api/demo-posts**')
  await box.getByRole('button', { name: 'Post' }).click()
  await expect(box.getByRole('listitem').filter({ hasText: lost })).toContainText('Posting…')
  await box.getByLabel('New post').fill('Newer draft')
  release()
  await expect(box.getByRole('listitem').filter({ hasText: lost })).toHaveCount(0)
  await expect(box.getByLabel('New post')).toHaveValue('Newer draft')
})

test('recipes: editing a profile shows the save at once; saved, it is the new start; failed, the page goes back', async ({ page }) => {
  await page.goto('/guide/fetching-recipes#editing-a-profile-save-or-roll-back')
  const box = await recipe(page, 'recipe-profile')
  const card = box.getByRole('article', { name: 'Profile' })
  const name = box.getByLabel('Name')
  const save = box.getByRole('button', { name: /Save|Saving…/ })
  await expect(name).not.toHaveValue('') // loaded: the form starts from the profile
  await expect(save).toBeDisabled() // nothing changed yet
  await name.fill('') // required: Save is refused, the field says why, nothing is sent
  await save.click()
  await expect(box.locator('[data-cl-message]')).not.toHaveText('')
  await expect(name).toBeEnabled()
  await expect(box.getByRole('status')).toHaveCount(0)
  const saved = `Grace ${Date.now() % 100000}`
  const release = await hold(page, '**/api/demo-profile**')
  await name.fill(saved)
  await save.click()
  await expect(card.locator('strong')).toHaveText(saved) // before the server answers
  await expect(name).toBeDisabled() // no edits while it saves: the answer would overwrite them
  release()
  await expect(box.getByRole('status')).toHaveText('Saved.')
  await expect(name).toBeEnabled()
  await expect(save).toBeDisabled() // the saved profile is the new starting point
  await box.getByLabel('Make the server fail').check()
  await name.fill('Not saved')
  await save.click()
  await expect(box.getByRole('status')).toContainText('The profile wasn’t saved. The card went back')
  await expect(card.locator('strong')).toHaveText(saved) // rolled back
  await expect(name).toHaveValue('Not saved') // the edits stay, to try again
  await box.getByRole('button', { name: 'Undo changes' }).click()
  await expect(name).toHaveValue(saved)
  await box.getByLabel('Make the server fail').uncheck()
  await name.fill('x'.repeat(41))
  await save.click()
  await expect(name).toHaveAttribute('aria-invalid', 'true') // the server's error, on its field
  await expect(box.locator('[data-cl-message]')).toHaveText('Use 40 characters or fewer.')
  await expect(card.locator('strong')).toHaveText(saved)
})

test('#454 recipes: a chain and parallel requests to an external API (answered here, not by the network)', async ({ page }) => {
  await page.route('https://jsonplaceholder.typicode.com/**', (route) => {
    const u = new URL(route.request().url())
    const id = Number(u.searchParams.get('userId') ?? u.pathname.split('/').pop())
    const headers = { 'access-control-allow-origin': '*' } // as the real API sends
    if (u.pathname.startsWith('/users/')) return route.fulfill({ headers, json: { id, name: id === 1 ? 'Leanne Graham' : 'Ervin Howell' } })
    if (u.pathname === '/posts') return route.fulfill({ headers, json: Array.from({ length: 10 }, (_, i) => ({ id: i, userId: id })) })
    return route.fulfill({ headers, json: [{ completed: false }, { completed: true }, { completed: false }] })
  })
  await page.goto('/guide/fetching-recipes#requests-in-a-chain-and-in-parallel')
  const box = await recipe(page, 'recipe-chain')
  await expect(box.getByRole('status')).toHaveText(/Leanne Graham wrote 10 posts and has\s+2 todos left\./)
  await page.route('https://jsonplaceholder.typicode.com/posts?userId=2', async (route) => {
    await new Promise((r) => setTimeout(r, 800)) // user 2's posts are slow
    await route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: Array.from({ length: 3 }, (_, i) => ({ id: i, userId: 2 })) })
  })
  await box.getByLabel('User').selectOption('2')
  await expect(box.getByRole('status')).toHaveText('Loading…') // never user 2's name with user 1's totals
  await expect(box.getByRole('status')).toHaveText(/Ervin Howell wrote 3 posts/)
})

test('#454 recipes: an expired token is refreshed once, and the request still answers', async ({ page }) => {
  await page.goto('/guide/fetching-recipes#a-token-that-expires')
  const box = await recipe(page, 'recipe-token')
  await box.getByRole('button', { name: 'Ask for the secret' }).click()
  await expect(box.locator('.secret')).toHaveText('The cake is in the fridge.')
  await expect(box.locator('.refreshed')).toHaveText('1')
  await page.waitForTimeout(3300) // the token expires
  const answers: number[] = []
  page.on('response', (r) => { if (r.request().method() === 'GET' && new URL(r.url()).pathname === '/api/demo-auth') answers.push(r.status()) })
  await box.getByRole('button', { name: 'Ask for the secret' }).click()
  await expect(box.locator('.refreshed')).toHaveText('2')
  // Expired, then exactly one retry with the new token. The retry may still be in flight when the count shows 2.
  await expect.poll(() => answers).toEqual([401, 200])
  await expect(box.locator('.secret')).toHaveText('The cake is in the fridge.')
})

test('#454 recipes: a failed token request is shown, not hidden behind an earlier answer', async ({ page }) => {
  await page.goto('/guide/fetching-recipes#a-token-that-expires')
  const box = await recipe(page, 'recipe-token')
  await box.getByRole('button', { name: 'Ask for the secret' }).click()
  await expect(box.locator('.secret')).toHaveText('The cake is in the fridge.')
  await page.route('**/api/demo-auth', (route) => (route.request().method() === 'POST' ? route.fulfill({ status: 500, json: { error: 'down' } }) : route.fulfill({ status: 401, json: { error: 'expired' } })))
  await box.getByRole('button', { name: 'Ask for the secret' }).click()
  await expect(box.getByRole('status')).toHaveText("Couldn't get the secret (500).")
})

test('#454 recipes: retry with backoff succeeds on the second attempt', async ({ page }) => {
  await page.goto('/guide/fetching-recipes#retry-with-backoff')
  const box = await recipe(page, 'recipe-retry')
  await expect(box.getByRole('status')).toHaveText(/visits, after 2 attempts\./)
})

test('#454 recipes: prefetch on hover makes the click instant', async ({ page }) => {
  await page.goto('/guide/fetching-recipes#prefetch-on-hover')
  const box = await recipe(page, 'recipe-prefetch')
  await expect(box.getByRole('listitem').first()).toBeVisible()
  const two = box.getByRole('button', { name: 'Page 2' })
  const fetched = page.waitForResponse((r) => r.url().includes('/api/demo-records') && r.url().includes('page=2'))
  await two.hover()
  await fetched
  let requested = false
  page.on('request', (r) => { if (r.url().includes('/api/demo-records') && r.url().includes('page=2')) requested = true })
  await two.click()
  await expect(two).toHaveAttribute('aria-current', 'page')
  await expect(box.getByRole('status')).toHaveText('') // no loading: it came from the cache
  expect(requested).toBe(false)
})

test('#454 recipes: an upload sends the file, and Cancel stops one', async ({ page }) => {
  await page.goto('/guide/fetching-recipes#uploading-a-file')
  const box = await recipe(page, 'recipe-upload')
  await box.getByLabel('A file (up to 1 MB)').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello world') })
  await box.getByRole('button', { name: 'Upload' }).click()
  await expect(box.getByRole('status')).toHaveText('Uploading notes.txt…')
  await expect(box.getByRole('status')).toHaveText('Uploaded notes.txt (11 bytes).')
  await box.getByRole('button', { name: 'Upload' }).click()
  await box.getByRole('button', { name: 'Cancel' }).click()
  await expect(box.getByRole('status')).toHaveText('Uploaded notes.txt (11 bytes).') // the last one; the cancelled one left no error
  await expect(box.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  // Too big after a success: the error shows, not the earlier answer.
  await box.getByLabel('A file (up to 1 MB)').setInputFiles({ name: 'big.bin', mimeType: 'application/octet-stream', buffer: Buffer.alloc(1_100_000) })
  await box.getByRole('button', { name: 'Upload' }).click()
  await expect(box.getByRole('status')).not.toHaveText(/Uploaded notes\.txt/)
  await expect(box.getByRole('status')).not.toHaveText(/Uploading/)
})

test('#454 recipes: server data first: the number is in the built HTML, then the island fetches it again', async ({ page }) => {
  const html = (await (await page.request.get('/guide/fetching-recipes')).text()).replace(/<!--.*?-->/g, '')
  expect(html).toMatch(/<strong[^>]*>12,400<\/strong> visits,\s*as the server rendered it/)
  await page.goto('/guide/fetching-recipes#server-data-first-then-fresh-in-the-browser')
  await expect(page.locator('#recipe-server-first')).toHaveText(/12,400 visits,\s*fetched again in the browser\./)
})

test('#454 recipes: a server route keeps the API key on the server and trims the answer', async ({ page }) => {
  const seen: string[] = []
  page.on('request', (r) => seen.push(r.url() + ' ' + JSON.stringify(r.headers())))
  await page.goto('/guide/fetching-recipes#external-apis')
  const box = await recipe(page, 'recipe-proxy')
  await expect(box.getByRole('status')).toHaveText('24 °C, sunny spells.')
  await box.getByLabel('City').selectOption('Oslo')
  await expect(box.getByRole('status')).toHaveText('3 °C, light snow.')
  expect(seen.join('\n')).not.toContain('demo-secret-key') // never in the browser
  expect(seen.join('\n')).not.toContain('/api/demo-vendor')
  expect(await (await page.request.get('/api/demo-weather?city=Lima')).json()).toEqual({ temp: 19, summary: 'Overcast' }) // trimmed
  expect((await page.request.get('/api/demo-vendor?city=lima')).status()).toBe(401) // the keyed API refuses without it
})

test('#454 recipes: a rate-limited answer says when to try again (GitHub, answered here)', async ({ page }) => {
  let limited = false
  await page.route('https://api.github.com/repos/forinda/clarusjs', (route) => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'x-ratelimit-reset' }
    if (limited) return route.fulfill({ status: 403, headers: { ...headers, 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Date.UTC(2026, 0, 1, 13, 5) / 1000) }, json: { message: 'API rate limit exceeded' } })
    return route.fulfill({ headers, json: { full_name: 'forinda/clarusjs', stargazers_count: 42 } })
  })
  await page.goto('/guide/fetching-recipes#external-apis')
  const box = await recipe(page, 'recipe-rate-limit')
  await expect(box.getByRole('status')).toHaveText('forinda/clarusjs has 42 stars.')
  limited = true
  await box.getByRole('button', { name: 'Ask again' }).click()
  await expect(box.getByRole('status')).toHaveText('Rate limited until 13:05:00 UTC.')
})

test('#456 folder layouts: the tour pages are wrapped in tour/+layout.tscl, on the server and by the client router', async ({ page }) => {
  await page.goto('/tour/1')
  await expect(page).toHaveTitle(/^Client tour, step 1/) // the layout's title, from the route's params
  await expect(page.locator('.sidebar, nav[aria-label]').first()).toBeVisible() // the docs layout around the page
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.getByRole('link', { name: 'Step 2 →' }).click() // the router renders the next step in the browser
  await expect(page).toHaveURL(/\/tour\/2$/)
  await expect(page).toHaveTitle(/^Client tour, step 2/)
  expect((await page.request.get('/tour/+layout')).status()).toBe(404) // + files are never routes
})

test('#457 folder guards: /members sends signed-out visitors to sign in, and lets signed-in ones through', async ({ page, context, baseURL }) => {
  await page.goto('/members')
  await expect(page).toHaveURL(/\/guide\/auth\?next=%2Fmembers#islands-and-endpoints$/) // the guard's redirect
  await context.addCookies([{ name: 'demo-user', value: 'Ada', url: baseURL! }]) // what the demo's sign-in sets
  await page.goto('/members')
  await expect(page.getByRole('heading', { level: 1, name: 'Members' })).toBeVisible()
  await expect(page.getByText('Hello, Ada.')).toBeVisible() // load() ran after the guard, reading locals.user
  expect((await page.request.get('/members/+guard')).status()).toBe(404) // a guard is never an endpoint or a page
})

test('#458 automatic imports: components used by name render on the server, and an island attaches', async ({ page }) => {
  // <item-list> in the Slots demo and <tour-keys> on the tour pages have no @import.
  const slots = await (await page.request.get('/guide/slots')).text()
  expect(slots).toMatch(/<ul class="item-list[^"]*"/)
  await page.goto('/tour/1')
  await expect(page.locator('cl-island[c*="tour-keys"]')).toHaveCount(1)
})

test('#442 component events: the form hears its fields\' (blur) and the combobox\'s (change), and cancels a fourth language', async ({ page }) => {
  await page.goto('/guide/forms')
  const form = page.locator('cl-island[c="signup-form"]')
  await expect(form).toHaveAttribute('data-cl-ready', '')
  for (const island of await form.locator('cl-island').all()) await expect(island).toHaveAttribute('data-cl-ready', '')
  const activity = form.locator('.signup-activity')
  await form.getByLabel('Name').focus()
  await form.getByLabel('Email').focus() // leaves Name
  await expect(activity).toHaveText('Left the name field.')
  const langs = form.getByRole('combobox', { name: 'Languages' })
  await langs.click()
  await form.getByRole('option', { name: 'Kiswahili' }).click()
  await expect(activity).toHaveText('Added Kiswahili (select).')
  await form.getByRole('option', { name: 'Français' }).click()
  await expect(form.locator('.signup-lists')).toContainText('Languages: en, sw, fr')
  await form.getByRole('option', { name: 'Yorùbá' }).click() // a fourth: the form cancels it
  await expect(activity).toHaveText('Up to 3 languages: Yorùbá was not added.')
  await expect(form.locator('.signup-lists')).toContainText('Languages: en, sw, fr')
  await expect(form.getByRole('option', { name: 'Yorùbá' })).toHaveAttribute('aria-selected', 'false')
  await form.getByRole('button', { name: 'Remove Kiswahili' }).click()
  await expect(activity).toHaveText('Removed Kiswahili (remove).')
})

test('#463 attributes on a component land on its root element', async ({ page }) => {
  const html = await (await page.request.get('/guide/slots')).text()
  expect(html).toMatch(/<ul[^>]*\bid="slots-demo-steps"[^>]*>/)
  await page.goto('/guide/slots#slots-that-pass-data')
  const list = page.getByRole('list', { name: 'Learn steps' }) // aria-label, from the tag
  await expect(list).toHaveAttribute('id', 'slots-demo-steps')
  await expect(list.getByRole('listitem')).toHaveCount(3)
})

test('#464 ui-primitives: roving focus, typeahead, and a popover that positions, dismisses and returns focus', async ({ page }) => {
  await page.goto('/guide/ui-primitives')
  const demo = page.locator('.primitives-demo')
  await expect(demo.locator('xpath=ancestor::cl-island')).toHaveAttribute('data-cl-ready', '')
  const toolbar = demo.getByRole('toolbar', { name: 'Formatting' })
  await expect(toolbar.getByRole('button', { name: /Bold/ })).toHaveAttribute('tabindex', '0')
  await expect(toolbar.getByRole('button', { name: /Italic/ })).toHaveAttribute('tabindex', '-1') // one tab stop
  await toolbar.getByRole('button', { name: /Bold/ }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(toolbar.getByRole('button', { name: /Italic/ })).toBeFocused()
  await page.keyboard.press('ArrowRight') // Underline is disabled: skipped
  await expect(toolbar.getByRole('button', { name: 'Clear' })).toBeFocused()
  const list = demo.getByRole('listbox', { name: 'Fruit' })
  await list.getByRole('option', { name: 'Apple' }).focus()
  await page.keyboard.press('b')
  await expect(list.getByRole('option', { name: 'Banana' })).toBeFocused()
  await page.keyboard.press('b')
  await expect(list.getByRole('option', { name: 'Blueberry' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(demo.locator('.primitives-picked')).toHaveText('Picked: Blueberry')
  const details = demo.getByRole('button', { name: 'Details' })
  await details.click()
  const popup = demo.getByRole('dialog', { name: 'Details' })
  await expect(popup).toHaveAttribute('data-open', '')
  await expect(popup).toHaveAttribute('data-side', /^(bottom|top)$/)
  await popup.getByRole('button', { name: 'Done' }).focus()
  await page.keyboard.press('Escape')
  await expect(popup).toHaveCount(0)
  await expect(demo.locator('.primitives-closed')).toHaveText('Closed by escape-key.')
  await expect(details).toBeFocused() // focus came back
  await details.click()
  await page.locator('h1').click() // outside
  await expect(demo.getByRole('dialog')).toHaveCount(0)
  await expect(demo.locator('.primitives-closed')).toHaveText('Closed by outside-press.')
})

test('#465 parts: dialog and popover open with no JavaScript of their own, the accordion is exclusive, switch and field are wired', async ({ page }) => {
  await page.goto('/guide/ui-primitives#parts')
  const demo = page.locator('.parts-demo')
  await expect(demo.locator('xpath=ancestor::cl-island')).toHaveAttribute('data-cl-ready', '')
  await demo.getByRole('button', { name: 'Delete file…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Delete this file?' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused() // modal: focus moved in
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await demo.getByRole('button', { name: 'Share' }).click()
  const popover = demo.locator('#parts-popover')
  await expect(popover).toBeVisible()
  await page.locator('h1').click() // light dismiss
  await expect(popover).toBeHidden()
  const [first, second] = [demo.locator('details').first(), demo.locator('details').nth(1)]
  await expect(first).toHaveAttribute('open', '')
  await second.locator('summary').click()
  await expect(second).toHaveAttribute('open', '')
  await expect(first).not.toHaveAttribute('open', '') // exclusive
  const wifi = demo.getByRole('switch', { name: 'Wi-Fi' })
  await wifi.click()
  await expect(demo.locator('.parts-wifi')).toHaveText('Wi-Fi is off.')
  await expect(demo.locator('[data-part="switch"]')).not.toHaveAttribute('data-checked', '')
  const email = demo.getByLabel('Email')
  await expect(email).toHaveAttribute('aria-describedby', 'parts-email-description')
  await email.fill('ada')
  await email.blur()
  await expect(demo.getByRole('alert')).toHaveText('Enter an email address.')
  await expect(email).toHaveAttribute('aria-invalid', 'true')
  await email.fill('ada@example.com')
  await expect(demo.getByRole('alert')).toHaveCount(0)
  await demo.getByLabel('Size').selectOption('s') // the select part, two-way
  await expect(demo.locator('.parts-size')).toHaveText('Size: s')
  await expect(demo.getByRole('option', { name: 'Large' })).toBeDisabled()
})

// #467: the Components section, a page per part, styled by @clarusjs/ui; axe on every one.
for (const part of ['dialog', 'popover', 'accordion', 'switch', 'field', 'select', 'combobox', 'tabs', 'radio', 'tooltip', 'menu']) {
  test(`#467 components/${part}: the demo works and has no axe violations`, async ({ page }) => {
    await page.goto(`/components/${part}`)
    const gallery = page.locator(`[data-gallery="${part}"]`)
    await expect(gallery.locator('xpath=ancestor::cl-island')).toHaveAttribute('data-cl-ready', '')
    expect((await (await axe(page)).include(`[data-gallery="${part}"]`).analyze()).violations).toEqual([])
  })
}

test('#465 tabs: Radix-shaped on context, server-rendered ARIA; click, arrow keys, Home and End select, panels follow', async ({ page }) => {
  await page.goto('/components/tabs')
  const gallery = page.locator('[data-gallery="tabs"]')
  const list = gallery.getByRole('tablist', { name: 'Install' })
  const panel = (name: string) => gallery.getByRole('tabpanel', { name })
  // Before any script: the server already hid the other panels, so nothing jumps.
  const html = await (await page.request.get('/components/tabs')).text()
  expect(html).toMatch(/id="gallery-install-panel-pnpm"[^>]*hidden/)
  await expect(list.locator('xpath=ancestor::cl-island')).toHaveAttribute('data-cl-ready', '')
  await expect(panel('npm')).toBeVisible()
  await list.getByRole('tab', { name: 'pnpm' }).click()
  await expect(list.getByRole('tab', { name: 'pnpm' })).toHaveAttribute('aria-selected', 'true')
  await expect(panel('pnpm')).toBeVisible()
  await expect(page.locator('#gallery-install-panel-npm')).toBeHidden()
  await page.keyboard.press('ArrowRight')
  await expect(list.getByRole('tab', { name: 'yarn' })).toBeFocused()
  await expect(panel('yarn')).toBeVisible()
  await page.keyboard.press('Home')
  await expect(panel('npm')).toBeVisible()
  await expect(page.locator('#gallery-install-panel-yarn')).toBeHidden()
})

test('#465 tabs bound two ways in an island: [(value)], a cancelling (change), and the page\'s own handlers in a panel', async ({ page }) => {
  await page.goto('/components/tabs')
  const demo = page.locator('.tabs-bound-demo')
  await expect(demo.locator('xpath=ancestor::cl-island').first()).toHaveAttribute('data-cl-ready', '')
  const list = demo.getByRole('tablist', { name: 'Package manager' })
  await list.getByRole('tab', { name: 'pnpm' }).click()
  await expect(demo.locator('.bound-out')).toHaveText('Selected: pnpm')
  await expect(demo.getByRole('tabpanel', { name: 'pnpm' })).toBeVisible()
  await list.getByRole('tab', { name: 'npm', exact: true }).click()
  await demo.locator('.bound-inc').click()
  await demo.locator('.bound-inc').click()
  await expect(demo.locator('.bound-count')).toHaveText('2')
  await demo.getByLabel('Locked').check()
  await list.getByRole('tab', { name: 'yarn' }).click()
  await expect(list.getByRole('tab', { name: 'npm', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(demo.locator('.bound-out')).toHaveText('Selected: npm')
  expect((await (await axe(page)).include('.tabs-bound-demo').analyze()).violations).toEqual([])
})

test('#465 radio group: native radios bound two ways from an island; arrow keys select; the server checked one', async ({ page }) => {
  const html = await (await page.request.get('/components/radio')).text()
  expect(html).toMatch(/value="m" checked/)
  await page.goto('/components/radio')
  const group = page.getByRole('group', { name: 'Size' })
  await expect(page.locator('[data-gallery="radio"]').locator('xpath=ancestor::cl-island').first()).toHaveAttribute('data-cl-ready', '')
  await group.getByRole('radio', { name: 'Small' }).check()
  await expect(page.locator('.gallery-out')).toHaveText('Size: s')
  await page.keyboard.press('ArrowDown')
  await expect(group.getByRole('radio', { name: 'Medium' })).toBeChecked()
  await expect(page.locator('.gallery-out')).toHaveText('Size: m')
  await expect(group.locator('[data-part="radio"][data-checked]')).toHaveCount(1)
})

test('#465 tooltip: shown on hover and on focus, described by its trigger, closed by Escape', async ({ page }) => {
  await page.goto('/components/tooltip')
  const trigger = page.getByRole('button', { name: 'Copy link' })
  const tip = page.getByRole('tooltip')
  await expect(trigger).toHaveAccessibleDescription('Copies the page\'s address')
  await expect(page.locator('[data-gallery="tooltip"]').locator('xpath=ancestor::cl-island').first()).toHaveAttribute('data-cl-ready', '')
  await trigger.hover()
  await expect(tip).toBeVisible()
  await page.mouse.move(0, 0)
  await expect(tip).toBeHidden()
  await trigger.focus()
  await expect(tip).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(tip).toBeHidden()
})

test('#465 menu: the trigger opens the list and focus moves in; arrows, typeahead and Enter pick; Escape closes', async ({ page }) => {
  await page.goto('/components/menu')
  await expect(page.locator('[data-gallery="menu"]').locator('xpath=ancestor::cl-island').first()).toHaveAttribute('data-cl-ready', '')
  const trigger = page.getByRole('button', { name: 'Actions' })
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await trigger.click()
  const menu = page.getByRole('menu', { name: 'Actions' })
  await expect(menu).toBeVisible()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await expect(menu.getByRole('menuitem', { name: 'Copy' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(menu.getByRole('menuitem', { name: 'Rename' })).toBeFocused()
  await page.keyboard.press('ArrowDown') // Archive is disabled: skipped
  await expect(menu.getByRole('menuitem', { name: 'Delete' })).toBeFocused()
  await page.keyboard.press('r')
  await expect(menu.getByRole('menuitem', { name: 'Rename' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('.gallery-out')).toHaveText('Picked: rename')
  await expect(menu).toBeHidden()
  await trigger.click()
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
})

test('#467 components: @clarusjs/ui styles the parts in the site\'s tokens; interactions on a few pages', async ({ page }) => {
  await page.goto('/components/dialog')
  const trigger = page.getByRole('button', { name: 'Delete file…' })
  expect(await trigger.evaluate((el) => getComputedStyle(el).borderRadius)).toBe('8px') // ui.css's --ui-radius
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Delete this file?' })
  await expect(dialog).toBeVisible()
  expect((await (await axe(page)).include('dialog[open]').analyze()).violations).toEqual([]) // open, too
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await page.goto('/components/switch')
  await page.getByRole('switch', { name: 'Notifications' }).click()
  await expect(page.locator('.gallery-out')).toHaveText('Notifications off, terms not agreed.')
  await page.goto('/components/combobox')
  await page.getByRole('combobox', { name: 'Fruit' }).click()
  await page.getByRole('option', { name: 'Banana' }).click()
  await expect(page.locator('.gallery-out')).toHaveText('Fruit: banana')
})

test('events fallthrough: (click) on a component without that @event listens on what it renders', async ({ page }) => {
  await page.goto('/guide/events#events-on-what-a-component-renders')
  const demo = page.locator('cl-island[c="fallthrough-demo"]')
  await expect(demo).toHaveAttribute('data-cl-ready', '')
  await demo.getByRole('button', { name: 'Like' }).click()
  await demo.getByRole('button', { name: 'Like' }).click()
  await expect(demo.locator('.likes')).toHaveText('2 likes')
})

test('version badges: a feature says when it came; the heading id and contents leave the badge out', async ({ page }) => {
  await page.goto('/guide/components')
  const heading = page.locator('h3#a-component-that-stands-for-an-element-extends')
  await expect(heading.locator('.version[data-version="since"]')).toHaveText('Since 0.16.0')
  const toc = page.locator('aside.toc a[href="#a-component-that-stands-for-an-element-extends"]')
  await expect(toc).toHaveText('A component that stands for an element: @extends')
})

test('#373: the version menu (a slot of the theme): the current version, release notes; no JavaScript needed', async ({ browser }) => {
  const version = JSON.parse(readFileSync(new URL('../../clarusjs/package.json', import.meta.url), 'utf8')).version
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/guide/lists')
  const menu = page.locator('.sidebar .version-menu')
  await expect(menu.locator('summary')).toHaveText(`v${version}`)
  await expect(menu.getByRole('link', { name: 'Release notes' })).toBeHidden()
  await menu.locator('summary').click()
  await expect(menu.getByRole('link', { name: `v${version} (latest)` })).toHaveAttribute('aria-current', 'true')
  await menu.getByRole('link', { name: 'Release notes' }).click()
  await expect(page).toHaveURL(/\/releases$/)
  await context.close()
})

test('#373: the phone drawer ends with the site\'s own links, those its links row doesn\'t have; not on a wide screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto('/guide/lists')
  await page.getByRole('button', { name: 'Open menu' }).click()
  const drawer = page.locator('.sidebar')
  await expect(drawer.locator('.version-menu summary')).toBeVisible()
  const own = drawer.locator('.drawer-footer')
  await expect(own.getByRole('link', { name: 'For AI agents' })).toBeVisible()
  await expect(own.getByRole('link', { name: 'GitHub' })).toHaveCount(0) // already in the links row
  await expect(own).toContainText('MIT licensed')
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(own).toBeHidden()
})

test('navigation guide: the query demo keeps its search in the URL (setSearch replaces the entry), and a reload shows the same results', async ({ page }) => {
  await page.goto('/guide/navigation')
  const demo = page.locator('.query-demo')
  await expect(page.locator('cl-island[c="query-demo"]')).toHaveAttribute('data-cl-ready', '')
  await expect(demo.getByRole('listitem')).toHaveCount(8)
  const depth = await page.evaluate(() => history.length)
  await demo.getByRole('searchbox', { name: 'Search' }).fill('s')
  await demo.getByLabel('Tag').selectOption('templates')
  await demo.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page).toHaveURL(/\?q=s&tag=templates$/)
  await expect(page.locator('.query-demo').getByRole('listitem')).toHaveText([/Lists/, /Conditionals/, /Slots/])
  expect(await page.evaluate(() => history.length)).toBe(depth) // replaced, not pushed
  await page.reload()
  await expect(page.locator('cl-island[c="query-demo"]')).toHaveAttribute('data-cl-ready', '')
  await expect(page.locator('.query-demo').getByRole('listitem')).toHaveCount(3)
  await page.locator('.query-demo').getByRole('button', { name: 'Clear' }).click()
  await expect(page).toHaveURL(/\/guide\/navigation$/)
  await expect(page.locator('.query-demo').getByRole('listitem')).toHaveCount(8)
})

test('navigation guide: a search from the query demo keeps the scroll position; Back after a link restores it', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/guide/navigation')
  await expect(page.locator('cl-island[c="query-demo"]')).toHaveAttribute('data-cl-ready', '')
  await page.locator('.query-demo').scrollIntoViewIfNeeded()
  const before = await page.evaluate(() => scrollY)
  expect(before).toBeGreaterThan(200)
  await page.locator('.query-demo').getByRole('searchbox', { name: 'Search' }).fill('s')
  await page.locator('.query-demo').getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page).toHaveURL(/\?/)
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before - 40)
  const at = await page.evaluate(() => scrollY)
  // A slow machine (CI): Back comes before the link's page change has swapped (its view transition still snapshots).
  await page.evaluate(() => {
    const start = document.startViewTransition.bind(document)
    document.startViewTransition = ((update: () => Promise<void>) => start(() => new Promise((r) => setTimeout(r, 300)).then(update))) as typeof start
  })
  await page.getByRole('link', { name: 'Fetching', exact: true }).first().click()
  await expect(page).toHaveURL(/\/guide\/fetching/)
  await page.goBack()
  await expect(page).toHaveURL(/\/guide\/navigation/)
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(at - 40)
  expect(errors).toEqual([]) // Back while the last page change still animates skips its view transition, quietly
})

test('animations guide: what @if and @for insert animates in with @starting-style; reduced motion drops the movement', async ({ page }) => {
  await page.goto('/guide/animations')
  await expect(page.locator('cl-island[c="enter-demo"]')).toHaveAttribute('data-cl-ready', '')
  // Transitions started, as they start (transitionrun), so a slow runner can't miss one that has already ended.
  const started = async (click: () => Promise<void>, sel: string) => {
    await page.evaluate(() => { (window as { runs?: string[] }).runs = []; addEventListener('transitionrun', (e) => (window as { runs?: string[] }).runs!.push(`${(e.target as Element).matches(document.body.dataset.sel!) ? '' : 'other:'}${e.propertyName}`)) })
    await page.evaluate((s) => (document.body.dataset.sel = s), sel)
    await click()
    await expect.poll(() => page.evaluate(() => (window as { runs?: string[] }).runs!.filter((r) => !r.startsWith('other:')).length)).toBeGreaterThan(0)
    return page.evaluate(() => [...new Set((window as { runs?: string[] }).runs!.filter((r) => !r.startsWith('other:')))].sort())
  }
  expect(await started(() => page.getByRole('button', { name: 'Show the panel' }).click(), '.enter-panel')).toEqual(['opacity', 'translate'])
  expect(await started(() => page.getByRole('button', { name: 'Add a row' }).click(), '.enter-rows li')).toEqual(['opacity', 'translate'])
  // Reduced motion: no movement (this site's theme also shortens every transition to nothing).
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: 'Add a row' }).click()
  expect(await page.locator('.enter-rows li').last().evaluate((el) => getComputedStyle(el).translate)).toBe('none')
})

test('animations guide: @transition plays the leave before removing the panel, and out-in waits for the old step', async ({ page }) => {
  await page.goto('/guide/animations')
  const demo = page.locator('cl-island[c="transition-demo"]')
  await expect(demo).toHaveAttribute('data-cl-ready', '')
  // Leaving: still there, inert and in its leave classes, then gone once its 200 ms transition ends.
  await demo.getByRole('button', { name: 'Hide the panel' }).click()
  const panel = demo.locator('.transition-panel')
  await expect(panel).toHaveClass(/fade-leave-active/)
  await expect(panel).toHaveAttribute('inert', '')
  await expect(panel).toHaveCount(0)
  // Entering again: the enter classes, then none.
  await demo.getByRole('button', { name: 'Show the panel' }).click()
  await expect(demo.locator('.transition-panel')).toHaveClass(/fade-enter-active/)
  await expect(demo.locator('.transition-panel')).toHaveClass('transition-panel')
  // out-in: the next step is inserted only once the current one has left.
  await page.evaluate(() => {
    const seen: string[] = []
    ;(window as { seen?: string[] }).seen = seen
    new MutationObserver(() => seen.push([...document.querySelectorAll('.transition-step')].map((s) => s.getAttribute('data-step')).join(','))).observe(document.querySelector('.transition-steps')!, { childList: true, subtree: true })
  })
  await demo.getByRole('button', { name: 'Next step' }).click()
  await expect(demo.locator('.transition-step')).toHaveAttribute('data-step', '2')
  await expect(demo.locator('.transition-step')).toHaveCount(1)
  expect(await page.evaluate(() => (window as { seen?: string[] }).seen!.includes('1,2'))).toBe(false) // never both at once
  // Reduced motion: nothing to wait for, so the panel goes at once. Its normal leave is made 2 s first, so a leave that
  // still animated would miss the 500 ms below (under reduced motion the demo's `transition: none` still wins).
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await demo.locator('.transition-panel').evaluate((el) => ((el as HTMLElement).style.transitionDuration = '2s'))
  await demo.getByRole('button', { name: 'Hide the panel' }).click()
  await expect(demo.locator('.transition-panel')).toHaveCount(0, { timeout: 500 })
})

test('animations guide: @transition on a list: rows enter, leave before they go, and slide into place when reversed', async ({ page }) => {
  await page.goto('/guide/animations')
  const demo = page.locator('cl-island[c="transition-demo"]')
  await expect(demo).toHaveAttribute('data-cl-ready', '')
  const rows = demo.locator('.transition-list li')
  await demo.getByRole('button', { name: 'Add a fruit' }).click()
  await expect(demo.locator('li[data-fruit="Date"]')).toHaveClass(/list-enter-active/)
  await expect(demo.locator('li[data-fruit="Date"]')).toHaveClass('')
  await demo.getByRole('button', { name: 'Remove the first' }).click()
  const apple = demo.locator('li[data-fruit="Apple"]')
  await expect(apple).toHaveClass(/list-leave-active/)
  await expect(apple).toHaveAttribute('inert', '')
  await expect(apple).toHaveCount(0)
  await demo.getByRole('button', { name: 'Reverse' }).click()
  await expect(demo.locator('li.list-move').first()).toBeAttached()
  await expect(rows).toHaveText(['Date', 'Cherry', 'Banana'])
  await expect(demo.locator('li.list-move')).toHaveCount(0)
})

test('animations guide: the flip clock shows the time and flips only the digits that change', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 26, 10, 59, 58) })
  await page.goto('/guide/animations')
  const clock = page.getByRole('timer')
  await expect(page.locator('cl-island[c="flip-clock"]')).toHaveAttribute('data-cl-ready', '')
  await expect(clock).toHaveAttribute('aria-label', 'The time is 10:59:58')
  // What turns when the time moves on: watched as it starts (transitions end on their own).
  await page.evaluate(() => {
    const w = window as unknown as { __flipped: string[] }
    w.__flipped = []
    const seen = new WeakSet<Node>() // a new row is inserted, then moved into place: count each once
    new MutationObserver((records) => {
      for (const r of records) for (const n of r.addedNodes) if (n instanceof HTMLElement && n.matches('.digit') && !seen.has(n)) {
        seen.add(n)
        if (n.querySelector('.fold')!.getAnimations().length) w.__flipped.push(n.querySelector('.top')!.textContent!)
      }
    }).observe(document.querySelector('.flip-clock')!, { childList: true, subtree: true })
  })
  await page.clock.runFor(2000)
  await expect(clock).toHaveAttribute('aria-label', 'The time is 11:00:00')
  // 10:59:58 → 10:59:59 → 11:00:00: the last digit twice, then 1·0 → 1·1 (hour's second digit), 5 → 0, 9 → 0, 5 → 0.
  expect((await page.evaluate(() => (window as unknown as { __flipped: string[] }).__flipped)).sort()).toEqual(['0', '0', '0', '0', '1', '9'].sort())
})

test('animations guide: the flip clock takes the theme\'s colours, light and dark', async ({ page }) => {
  await page.goto('/guide/animations')
  const colours = () => page.locator('.flip-clock .digit .top').first().evaluate((el) => {
    const s = getComputedStyle(el), root = getComputedStyle(document.documentElement)
    return { card: s.backgroundColor, text: s.color, bg: root.getPropertyValue('--bg').trim(), scheme: document.documentElement.dataset.theme ?? '' }
  })
  await page.emulateMedia({ colorScheme: 'light' })
  const light = await colours()
  await page.emulateMedia({ colorScheme: 'dark' })
  const dark = await colours()
  expect(light.card).not.toBe(dark.card)
  expect(light.text).not.toBe(dark.text)
})

test('editor: the composer is a textarea until used; its code loads on first focus, and nothing typed is lost', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (r) => requests.push(r.url()))
  await page.goto('/guide/editor-composer')
  const demo = page.locator('.composer-demo')
  await expect(demo.locator('textarea')).toHaveCount(1)
  const composerCode = () => requests.filter((u) => /\/editor\/src\/components\/field-[\w-]+\.js$/.test(u)) // the editor's field (ui-primitives has a field chunk too)
  expect(composerCode()).toEqual([])
  await demo.getByRole('textbox', { name: 'Message' }).click()
  await page.keyboard.type('Hi all')
  const editable = demo.locator('[contenteditable=true]')
  await expect(editable).toHaveText('Hi all')
  expect(composerCode()).toHaveLength(1)
  await expect(demo.locator('textarea')).toHaveCount(0)
  await page.keyboard.press('Shift+Enter')
  await page.keyboard.type('@ma')
  await page.getByRole('option', { name: 'Mara Okafor' }).waitFor()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await expect(demo.locator('.messages li')).toHaveText(/^Hi all\s*@Mara Okafor\s*$/)
  await expect(demo.locator('.messages li [data-mention="mara"]')).toHaveText('@Mara Okafor') // as typed: the mention, not just its text
  await expect(editable).toHaveText('')
})

test('user: in the guide, long words and code lines wrap inside the composer; nothing overflows the page', async ({ page }) => {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/guide/editor-composer')
    const demo = page.locator('.composer-demo')
    await demo.getByRole('textbox', { name: 'Message' }).click()
    const editable = demo.locator('[contenteditable=true]')
    await expect(editable).toBeFocused()
    await page.keyboard.type('x'.repeat(160))
    await page.keyboard.press('Shift+Enter')
    await demo.getByRole('button', { name: 'Code block' }).click()
    await page.keyboard.type('const longLine = "' + 'y'.repeat(160) + '"')
    for (let i = 0; i < 20; i++) await page.keyboard.press('Enter')
    // the editable while it holds the long lines (sending clears it)
    const editing = await demo.locator('[contenteditable=true]').evaluate((box) => box.scrollWidth - box.clientWidth)
    expect(editing).toBe(0)
    // sent too: the long word in the message list (CodeRabbit on #647)
    await page.keyboard.press('ControlOrMeta+Enter')
    await expect(demo.locator('.messages li').first()).toContainText('xxxx')
    const sizes = await demo.locator('form.composer').evaluate((el, width) => {
      const box = el.querySelector('[contenteditable]')!
      const rect = el.getBoundingClientRect(), demoRect = el.closest('.composer-demo')!.getBoundingClientRect()
      return { width, editable: box.scrollWidth - box.clientWidth, composer: el.scrollWidth - el.clientWidth, right: Math.max(0, Math.round(Math.max(rect.right, el.closest('.composer-demo')!.querySelector('.messages')!.getBoundingClientRect().right) - demoRect.right)), page: document.documentElement.scrollWidth - innerWidth }
    }, width)
    expect(sizes).toEqual({ width, editable: 0, composer: 0, right: 0, page: 0 })
  }
})

test('a ```mermaid block is drawn as a diagram when it scrolls into view, every load, after navigation, and again in dark mode', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const box = page.locator('#diagrams ~ .mermaid-diagram').first()
  const drawn = async () => {
    await box.scrollIntoViewIfNeeded()
    await expect(box).toHaveAttribute('data-state', 'drawn')
    await expect(box.locator('.mermaid-svg svg')).toBeVisible()
    await expect(box.locator('pre.mermaid')).toBeHidden()
    await readable()
  }
  // every label is there, visible, and reads against the page: contrast at least 4.5:1 (WCAG AA)
  const readable = async () => {
    for (const label of ['page.md', '.tscl', 'server module', 'island modules', 'HTML', '@clarusjs/content', 'compile']) {
      await expect(box.locator('.mermaid-svg').getByText(label, { exact: true }).first()).toBeVisible()
    }
    const worst = await box.evaluate((el) => {
      const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)
      const lum = ([r, g, b]: number[]) => {
        const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
        return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!)
      }
      // the colour behind a label: the nearest node or edge-label shape's fill, else the page's background
      const behind = (node: Element) => {
        const shape = node.closest('.node, .edgeLabel')?.querySelector('rect, polygon, circle, path, .labelBkg, span')
        const fill = shape && getComputedStyle(shape).getPropertyValue(shape.tagName === 'SPAN' ? 'background-color' : 'fill')
        return fill && !/none|rgba\(0, 0, 0, 0\)|transparent/.test(fill) ? fill : getComputedStyle(document.body).backgroundColor
      }
      let min = Infinity
      for (const node of el.querySelectorAll('.mermaid-svg .nodeLabel, .mermaid-svg .edgeLabel span, .mermaid-svg text')) {
        if (!node.textContent?.trim()) continue
        const text = lum(rgb(getComputedStyle(node).getPropertyValue(node.tagName === 'text' ? 'fill' : 'color')))
        const back = lum(rgb(behind(node)))
        min = Math.min(min, (Math.max(text, back) + 0.05) / (Math.min(text, back) + 0.05))
      }
      return min
    })
    expect(worst).toBeGreaterThanOrEqual(4.5)
  }
  // reached by navigation (a fragment swap), then reloaded: drawn each time
  await page.goto('/guide/holes')
  await page.locator('.sidebar a[href="/guide/markdown"]').click()
  await expect(page).toHaveURL(/\/guide\/markdown$/)
  await drawn()
  for (let i = 0; i < 2; i++) {
    await page.reload()
    await drawn()
  }
  // the theme changes: drawn again, in the other theme
  const light = await box.locator('.mermaid-svg').innerHTML()
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  await expect.poll(() => box.locator('.mermaid-svg').innerHTML()).not.toBe(light)
  await readable()
  expect(errors).toEqual([])
})

test('without JavaScript a ```mermaid diagram shows its source', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/guide/markdown')
  await expect(page.locator('.mermaid-diagram pre.mermaid').first()).toContainText('flowchart LR')
  await context.close()
})

test('on a phone a wide diagram keeps its text readable: full size, scrolled sideways (keyboard too), not shrunk', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/guide/markdown')
  const box = page.locator('#diagrams ~ .mermaid-diagram').first()
  await box.scrollIntoViewIfNeeded()
  await expect(box).toHaveAttribute('data-state', 'drawn')
  const label = box.locator('.mermaid-svg').getByText('server module', { exact: true }).first()
  expect((await label.boundingBox())!.height).toBeGreaterThanOrEqual(14)
  const region = box.locator('.mermaid-svg')
  expect(await region.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true)
  await expect(region).toHaveAttribute('tabindex', '0')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true) // the page itself doesn't scroll sideways
})

test('synced code tabs: picking a language switches every group of that name, keeps the tab in place, and is remembered', async ({ page }) => {
  await page.goto('/guide/markdown')
  const groups = page.locator('#synced-tabs ~ .code-group[data-sync="sdk"]')
  await expect(groups).toHaveCount(2)
  const shown = (n: number) => groups.nth(n).locator('input:checked + label')
  await expect(shown(0)).toHaveText('TypeScript')
  await expect(page.locator('cl-island[c*="code-tabs"]').first()).toHaveAttribute('data-cl-ready', '')
  // the second group: its tab stays where it was on screen while the first changes too
  const python = groups.nth(1).getByText('Python', { exact: true })
  await python.scrollIntoViewIfNeeded()
  const before = (await python.boundingBox())!.y
  await python.click()
  await expect(shown(0)).toHaveText('Python')
  await expect(shown(1)).toHaveText('Python')
  await expect(groups.nth(0).locator('.code-block:visible')).toContainText('client = Acme(key=os.environ["ACME_KEY"])')
  expect(Math.abs((await python.boundingBox())!.y - before)).toBeLessThan(2)
  // the keyboard: arrows move between tabs, and the other group follows
  await groups.nth(0).locator('input:checked').focus()
  await page.keyboard.press('ArrowRight')
  await expect(shown(1)).toHaveText('Go')
  // remembered on the next visit
  await page.reload()
  await expect(page.locator('cl-island[c*="code-tabs"]').first()).toHaveAttribute('data-cl-ready', '')
  await expect(shown(0)).toHaveText('Go')
  await expect(shown(1)).toHaveText('Go')
  // Ruby is only in the second group: the first keeps its tab
  await groups.nth(1).getByText('Ruby', { exact: true }).click()
  await expect(shown(1)).toHaveText('Ruby')
  await expect(shown(0)).toHaveText('Go')
  // an unnamed group isn't touched
  await expect(page.locator('.code-group:not([data-sync]) input:checked + label').first()).toHaveText('pnpm')
})

test('review (#660): a tab picked before the tabs island loads is kept (and remembered), not replaced by the stored one', async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('clarusjs-tabs', JSON.stringify({ sdk: 'Go' })); sessionStorage.setItem('seeded', '1') } })
  let release!: () => void
  const held = new Promise<void>((r) => { release = r })
  await page.route(/code-tabs/, async (route) => { await held; await route.continue() })
  await page.goto('/guide/markdown')
  const groups = page.locator('#synced-tabs ~ .code-group[data-sync="sdk"]')
  await groups.nth(0).getByText('Python', { exact: true }).click() // works without JavaScript: the island isn't there yet
  release()
  await expect(page.locator('cl-island[c*="code-tabs"]').first()).toHaveAttribute('data-cl-ready', '')
  await expect(groups.nth(0).locator('input:checked + label')).toHaveText('Python')
  await expect(groups.nth(1).locator('input:checked + label')).toHaveText('Python')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('clarusjs-tabs') ?? '{}').sdk)).toBe('Python')
})
