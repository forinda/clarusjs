// The calendar block: month, week and day views of events around today; add, edit and delete them in a dialog.
import { expect, test, type Page } from '@playwright/test'

async function open(page: Page) {
  await page.goto('/view/calendar-app')
  await page.locator('cl-island[c="calendar-board"][data-cl-ready]').waitFor({ state: 'attached' })
  // The sample events move to the visitor's today just after attach.
  await expect(page.locator('[data-part="cal-event"]').first()).toBeVisible()
}
const today = (page: Page, days = 0) =>
  page.evaluate((n) => {
    const d = new Date()
    d.setDate(d.getDate() + n)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, days)
const title = (page: Page) => page.locator('#cal-title')

test('month view: today is marked and has its events; the arrows move a month, Today comes back', async ({ page }) => {
  await open(page)
  const now = await today(page)
  const cell = page.locator(`[data-date="${now}"]`)
  await expect(cell).toHaveAttribute('data-today', 'true')
  await expect(cell.getByRole('button', { name: /Standup/ })).toBeVisible()
  const start = await title(page).textContent()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(title(page)).not.toHaveText(start!)
  await page.getByRole('button', { name: 'Today' }).click()
  await expect(title(page)).toHaveText(start!)
})

test('a busy day shows "+N more", which opens that day', async ({ page }) => {
  await open(page)
  const now = await today(page)
  await page.locator(`[data-date="${now}"]`).getByRole('button', { name: /more/ }).click()
  await expect(page.getByRole('button', { name: 'Day', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-part="cal-event"]', { hasText: 'Lunch with Sam' })).toBeVisible()
})

test('week view: seven days, timed events on the grid, overlapping ones side by side', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Week', exact: true }).click()
  await expect(page.locator('[data-part="cal-day-head"]')).toHaveCount(7)
  const review = page.locator('[data-part="cal-event"]', { hasText: 'Design review' })
  const spec = page.locator('[data-part="cal-event"]', { hasText: 'Write the spec' })
  const [a, b] = [(await review.boundingBox())!, (await spec.boundingBox())!]
  expect(a.x + a.width).toBeLessThanOrEqual(b.x + 1) // side by side, not on top of each other
  expect(b.y).toBeGreaterThan(a.y) // 10:30 is below 10:00
})

test('New event: the dialog adds it, and the month shows it on its day', async ({ page }) => {
  await open(page)
  const day = await today(page, 3)
  await page.getByRole('button', { name: 'New event' }).click()
  const dialog = page.getByRole('dialog', { name: 'New event' })
  await expect(dialog.getByLabel('Title')).toBeFocused()
  await dialog.getByLabel('Title').fill('Pitch rehearsal')
  await dialog.getByLabel('Date').fill(day)
  await dialog.getByLabel('Starts').fill('15:00')
  await dialog.getByLabel('Ends').fill('16:00')
  await dialog.getByLabel('Category').selectOption('focus')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.locator(`[data-date="${day}"]`).getByRole('button', { name: /Pitch rehearsal/ })).toBeVisible()
})

test("a day's empty space opens the dialog on that day; an end before the start is refused", async ({ page }) => {
  await open(page)
  const day = await today(page, 4)
  await page
    .locator(`[data-date="${day}"]`)
    .getByRole('button', { name: /^Add an event on/ })
    .click()
  const dialog = page.getByRole('dialog', { name: 'New event' })
  await expect(dialog.getByLabel('Date')).toHaveValue(day)
  await dialog.getByLabel('Title').fill('Backwards')
  await dialog.getByLabel('Starts').fill('15:00')
  await dialog.getByLabel('Ends').fill('14:00')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('End after it starts.')).toBeVisible()
})

test('an event opens to edit: a new title is saved; Delete removes it', async ({ page }) => {
  await open(page)
  await page
    .getByRole('button', { name: /Planning/ })
    .first()
    .click()
  const dialog = page.getByRole('dialog', { name: 'Edit event' })
  await expect(dialog.getByLabel('Title')).toHaveValue('Planning')
  await dialog.getByLabel('Title').fill('Sprint planning')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('button', { name: /Sprint planning/ }).first()).toBeVisible()
  await page
    .getByRole('button', { name: /Sprint planning/ })
    .first()
    .click()
  await dialog.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('button', { name: /Sprint planning/ })).toHaveCount(0)
})

test('the categories filter what shows', async ({ page }) => {
  await open(page)
  const gym = page.getByRole('button', { name: /Gym/ })
  await expect(gym.first()).toBeVisible()
  await page.getByRole('checkbox', { name: 'Personal' }).uncheck()
  await expect(gym).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Standup/ }).first()).toBeAttached()
})

test("on a phone the page doesn't scroll sideways; the week scrolls inside", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await open(page)
  await page.getByRole('button', { name: 'Week', exact: true }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

// Its axe check is the blocks suite's (/blocks/calendar-app, the view inside the site's page).
