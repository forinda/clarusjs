import { expect, test } from '@playwright/test'

test('accordion: opens one item at a time', async ({ page }) => {
  await page.goto('/components/accordion')
  const items = page.locator('.demo details')
  await items.nth(1).locator('summary').click()
  await expect(items.nth(1)).toHaveAttribute('open', '')
  await expect(items.nth(0)).not.toHaveAttribute('open', '')
})

for (const name of ['checkbox', 'switch']) {
  test(`${name}: toggles with click and Space`, async ({ page }) => {
    await page.goto(`/components/${name}`)
    await page.locator('.demo cl-island[data-cl-ready]').first().waitFor()
    const input = page.locator(`.demo [data-part="${name}"] input`).first()
    const out = page.locator('.demo .out')
    await expect(out).toHaveText('off')
    await input.click()
    await expect(out).toHaveText('on')
    await input.press('Space')
    await expect(out).toHaveText('off')
  })
}

test('radio group: arrow keys select', async ({ page }) => {
  await page.goto('/components/radio-group')
  await page.locator('.demo cl-island[data-cl-ready]').first().waitFor()
  const out = page.locator('.demo .out')
  await expect(out).toHaveText('m')
  await page.getByRole('radio', { name: 'Medium', exact: true }).focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('radio', { name: 'Large', exact: true })).toBeChecked()
  await expect(out).toHaveText('l')
})

test('field: shows its error after an invalid submit', async ({ page }) => {
  await page.goto('/components/field')
  await page.locator('.demo cl-island[data-cl-ready]').first().waitFor()
  const error = page.locator('.demo [data-part="error"]')
  await expect(error).toBeHidden()
  await page.locator('.demo button[type="submit"]').click()
  await expect(error).toBeVisible()
  await expect(error).toHaveText('Enter an email address.')
})
