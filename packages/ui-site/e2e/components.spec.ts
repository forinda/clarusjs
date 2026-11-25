import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { components as registry } from '../src/registry.ts'
import { axeViolations, modes, pageIn } from './helpers.ts'

for (const entry of registry) {
  const path = `/components/${entry.name}`
  test(`${entry.name}: renders and shows its source exactly`, async ({ page }) => {
    expect((await page.goto(path))?.status()).toBe(200)
    await expect(page.locator('h1')).toHaveText(entry.title)
    const blocks = page.locator('h2#source ~ .code-block pre')
    for (const [i, f] of entry.files.entries()) {
      const file = readFileSync(resolve(import.meta.dirname, '../src/registry', f), 'utf8').trimEnd()
      expect((await blocks.nth(i).innerText()).trimEnd()).toBe(file)
    }
  })

  for (const mode of modes) {
    test(`${entry.name}: passes axe and fits the screen (${mode.label})`, async ({ browser }) => {
      const page = await pageIn(browser, mode)
      await page.goto(path)
      expect(await axeViolations(page)).toEqual([])
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.context().close()
    })
  }

  // An island example (button-loading-demo) renders the component in the browser, so its page carries the component's
  // render code; the component itself compiles to none (test/registry.test.ts).
  const islandExample = (entry.examples ?? []).some((x) => readFileSync(resolve(import.meta.dirname, '../src/registry', `${entry.name}-${x}-demo.tscl`), 'utf8').includes('<script>'))
  if (!entry.island && !islandExample) {
    test(`${entry.name}: no JavaScript of its own`, async ({ page }) => {
      const scripts: string[] = []
      page.on('request', (r) => { if (r.resourceType() === 'script') scripts.push(r.url()) })
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      // Its own code, not an example's (an example may be an island: button-loading-demo).
      expect(scripts.filter((s) => !s.includes('-demo') && (s.includes(`/${entry.name}-`) || s.includes(`/${entry.name}.`)))).toEqual([])
    })
  }
}

test('/components/button: eight examples, each with its code; loading blocks a second click; circles are square', async ({ page }) => {
  await page.goto('/components/button')
  for (const name of ['Variants', 'Sizes', 'Icons', 'Loading', 'Shapes', 'Full width', 'Disabled', 'With other buttons']) {
    await expect(page.getByRole('heading', { level: 3, name: new RegExp(`^${name}\\b`) })).toBeVisible()
  }
  await page.locator('cl-island[c="button-loading-demo"][data-cl-ready]').waitFor({ state: 'attached' })
  const save = page.getByRole('button', { name: 'Click to save' })
  await save.click()
  const busy = page.getByRole('button', { name: 'Saving…' })
  await expect(busy).toHaveAttribute('aria-busy', 'true')
  await expect(busy).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Click to save' })).toBeEnabled({ timeout: 5000 })
  for (const label of ['Add', 'Search']) {
    const box = (await page.getByRole('button', { name: label, exact: true }).first().boundingBox())!
    expect(Math.round(box.width)).toBe(Math.round(box.height))
  }
  const block = (await page.getByRole('button', { name: 'Create account' }).boundingBox())!
  const container = (await page.getByRole('button', { name: 'Create account' }).locator('xpath=..').boundingBox())!
  expect(block.width).toBeGreaterThan(container.width * 0.8)
})

test('/components/input: one size scale: an input, a select and a button in a row share its height (30, 36, 44px)', async ({ page }) => {
  await page.goto('/components/input')
  const demo = page.locator('[class*="input-sizes-demo"]')
  for (const [size, px] of [['sm', 30], ['md', 36], ['lg', 44]] as const) {
    const row = demo.locator(`[data-size="${size}"]`).first()
    const heights = await Promise.all(['[data-part="text-input"]', '[data-part="control"]', '[data-part="button"]'].map((sel) => row.locator(sel).first().evaluate((el) => Math.round(el.getBoundingClientRect().height))))
    expect(heights, size).toEqual([px, px, px])
  }
})
