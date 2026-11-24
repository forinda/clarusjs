import { expect, test } from '@playwright/test'

test('overrides: a class from a parent\'s scoped style beats a component\'s own variant style', async ({ page }) => {
  await page.goto('/test/overrides')
  await expect(page.locator('.brand')).toHaveCSS('background-color', 'rgb(1, 2, 3)')
  await expect(page.locator('.flat [data-part="card-header"]')).toHaveCSS('color', 'rgb(4, 5, 6)')
})

test('overrides: a Tailwind-style utility beats a component\'s own rule', async ({ page }) => {
  await page.goto('/test/overrides')
  await expect(page.locator('.rounded-full')).toHaveCSS('border-radius', '9999px')
})

test('overrides: class, style and data-* on a ui-primitives part reach its root (the route for the island wrappers)', async ({ page }) => {
  await page.goto('/test/overrides')
  const sw = page.locator('[data-part="switch"].big')
  await expect(sw).toHaveClass(/\bbig\b/)
  await expect(sw).toHaveCSS('margin-top', '7px')
  await expect(sw).toHaveAttribute('data-x', '1')
})
