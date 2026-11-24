import { expect, test } from '@playwright/test'
import { axeViolations, modes, pageIn } from './helpers.ts'

test('/theme: renders the preview; its menu and dialog work', async ({ page }) => {
  expect((await page.goto('/theme'))?.status()).toBe(200)
  await expect(page.locator('h1')).toHaveText('Theme')
  const preview = page.locator('[data-ui-preview]')
  await expect(preview).toBeVisible()
  await preview.locator('cl-island[data-cl-ready]').first().waitFor()
  await preview.getByRole('button', { name: 'Actions' }).click()
  await expect(page.getByRole('menuitem', { name: 'Archive' })).toBeFocused()
  await page.keyboard.press('Escape')
  await preview.getByRole('button', { name: 'Invite people' }).click()
  await expect(page.getByRole('dialog', { name: 'Invite people' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
})

for (const mode of modes) {
  test(`/theme: passes axe and fits the screen (${mode.label})`, async ({ browser }) => {
    const page = await pageIn(browser, mode)
    await page.goto('/theme')
    expect(await axeViolations(page)).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.context().close()
  })
}
