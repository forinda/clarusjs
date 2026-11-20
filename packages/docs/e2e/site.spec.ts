import { expect, test, type Page } from '@playwright/test'

const pages = [
  { path: '/', title: 'clarusjs' },
  { path: '/guide/getting-started', title: 'Getting started' },
  { path: '/guide/components', title: 'Components' },
  { path: '/guide/islands', title: 'Islands' },
  { path: '/guide/build', title: 'Build' },
]
const guides = pages.filter((p) => p.path !== '/')

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
    await expect(page).toHaveTitle(new RegExp(title))
    await expect(page).toHaveTitle(/clarusjs/)
    await expect(page.locator('h1')).toHaveCount(1)
    expect(errors).toEqual([])
  })
}

for (const { path } of guides) {
  test(`${path} loads no JavaScript`, async ({ page }) => {
    const { response, scripts } = await visit(page, path)
    expect(response?.status()).toBe(200)
    await expect(page.locator('h1')).toHaveCount(1)
    expect(scripts).toEqual([])
  })
}

test('every header nav link, followed as written, lands on a page', async ({ page }) => {
  await page.goto('/')
  const hrefs = (await page.locator('header nav a').evaluateAll((links) => links.map((a) => a.getAttribute('href')!)))
    .filter((href) => href.startsWith('/')) // the site's own pages; external links are not ours to test
  expect(hrefs.length).toBe(guides.length)
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
  await expect(islands).toHaveAttribute('data-cl-ready', '')
  const button = islands.locator('button')
  const before = await page.locator('main').textContent()
  await button.click()
  await expect(button).toContainText('Clicked 1 time')
  const after = await page.locator('main').textContent()
  expect(after?.replace(/Clicked \d+ times? \(double: \d+\)/, '')).toBe(before?.replace(/Clicked \d+ times? \(double: \d+\)/, ''))
  expect(errors).toEqual([])
})
