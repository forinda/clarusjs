import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { registry } from '../src/registry.ts'
import { axeViolations, modes, pageIn } from './helpers.ts'

for (const entry of registry) {
  const path = `/components/${entry.name}`
  test(`${entry.name}: renders and shows its source exactly`, async ({ page }) => {
    expect((await page.goto(path))?.status()).toBe(200)
    await expect(page.locator('h1')).toHaveText(entry.title)
    const blocks = page.locator('h2#source ~ .code-block pre')
    for (const [i, f] of entry.files.entries()) {
      const file = readFileSync(resolve(import.meta.dirname, '../src/registry', entry.name, f), 'utf8').trimEnd()
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

  if (!entry.island) {
    test(`${entry.name}: no JavaScript of its own`, async ({ page }) => {
      const scripts: string[] = []
      page.on('request', (r) => { if (r.resourceType() === 'script') scripts.push(r.url()) })
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      expect(scripts.filter((s) => s.includes(`/${entry.name}-`) || s.includes(`/${entry.name}.`))).toEqual([])
    })
  }
}
