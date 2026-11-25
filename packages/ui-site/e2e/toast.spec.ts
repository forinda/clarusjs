// Toast layout: the icon, message and buttons line up on the first line, short or long; long words wrap; the info
// icon is a circled "i".
import { expect, test, type Page } from '@playwright/test'

/** Sends a toast with the demo's button of that name, and keeps it (hovered toasts wait). */
async function show(page: Page, button: string) {
  await page.goto('/components/toast')
  await page.locator('cl-island[c="toast-demo"][data-cl-ready]').waitFor({ state: 'attached' })
  await page.locator('.demo').getByRole('button', { name: button, exact: true }).click()
  const toast = page.locator('[data-part="toast"]').last()
  await toast.hover()
  return toast
}
const box = async (l: import('@playwright/test').Locator) => (await l.boundingBox())!
const middle = async (l: import('@playwright/test').Locator) => {
  const b = await box(l)
  return b.y + b.height / 2
}

test("one line: icon, text and close share a middle (the page's paragraph margins don't reach the message)", async ({
  page,
}) => {
  const toast = await show(page, 'Info')
  const text = await middle(toast.locator('[data-part="toast-message"]'))
  expect(Math.abs((await middle(toast.locator('[data-part="toast-icon"]'))) - text)).toBeLessThanOrEqual(2)
  expect(Math.abs((await middle(toast.locator('[data-part="toast-close"]'))) - text)).toBeLessThanOrEqual(2)
})

test('long text wraps inside the toast; the icon and close stay on its first line', async ({ page }) => {
  const toast = await show(page, 'Long')
  const t = await box(toast)
  const message = toast.locator('[data-part="toast-message"]')
  const m = await box(message)
  expect(m.height).toBeGreaterThan(40) // several lines
  expect(m.x + m.width).toBeLessThanOrEqual(t.x + t.width)
  expect(await message.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  const firstLine = m.y + 10
  expect(Math.abs((await middle(toast.locator('[data-part="toast-icon"]'))) - firstLine)).toBeLessThanOrEqual(4)
  expect(Math.abs((await middle(toast.locator('[data-part="toast-close"]'))) - firstLine)).toBeLessThanOrEqual(4)
})

test('the info icon is a circle with an i, like the others a whole shape', async ({ page }) => {
  const toast = await show(page, 'Info')
  const d = await toast.locator('[data-part="toast-icon"] path').getAttribute('d')
  expect(d).toMatch(/a10 10|A10 10/i) // the circle
})
