// OTP input: one native input (paste, SMS autofill and Backspace work as usual) shown as a box per digit.
import { expect, test } from '@playwright/test'
import { axeViolations, modes, pageIn } from './helpers.ts'

async function open(page: import('@playwright/test').Page) {
  await page.goto('/components/otp-input')
  await page.locator('cl-island[c="otp-input"][data-cl-ready]').first().waitFor({ state: 'attached' })
  const demo = page.locator('.demo:not(.example)')
  return { demo, input: demo.getByLabel('Verification code'), cells: demo.locator('[data-part="otp-cell"]') }
}

test('one labelled input for one-time codes; typing fills a box per digit, letters are dropped', async ({ page }) => {
  const { input, cells } = await open(page)
  await expect(input).toHaveAttribute('autocomplete', 'one-time-code')
  await expect(input).toHaveAttribute('inputmode', 'numeric')
  await expect(cells).toHaveCount(6)
  await input.pressSequentially('12a3')
  await expect(input).toHaveValue('123')
  await expect(cells.nth(2)).toHaveText('3')
  await expect(cells.nth(3)).toHaveAttribute('data-active', 'true')
  await page.keyboard.press('Backspace')
  await expect(input).toHaveValue('12')
  await expect(cells.nth(2)).toHaveText('')
})

test('a pasted code fills every box and completes; the form gets it by name', async ({ page }) => {
  const { demo, input, cells } = await open(page)
  await input.focus()
  await input.fill('482916')
  await expect(cells.nth(5)).toHaveText('6')
  await expect(demo.locator('output')).toHaveText('Complete: 482916')
  await expect(input).toHaveAttribute('name', 'code')
})

for (const mode of modes) {
  test(`/components/otp-input passes axe (${mode.label})`, async ({ browser }) => {
    const page = await pageIn(browser, mode)
    await open(page)
    expect(await axeViolations(page)).toEqual([])
  })
}
