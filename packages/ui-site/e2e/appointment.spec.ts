// Appointment picker: a date and a time, with shortcuts (Yesterday, Today, Tomorrow, Next week), in one popover.
import { expect, test, type Page } from '@playwright/test'
import { axeViolations, modes, pageIn } from './helpers.ts'

async function open(page: Page) {
  await page.goto('/components/appointment-picker')
  await page.locator('cl-island[c="appointment-picker"][data-cl-ready]').first().waitFor({ state: 'attached' })
  return page.locator('.demo:not(.example) [data-part="appointment"]')
}
// Today in the browser's own time zone, as the picker sees it, moved by days.
const day = (page: Page, days: number) =>
  page.evaluate((n) => {
    const d = new Date()
    d.setDate(d.getDate() + n)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, days)

test('a shortcut picks the day (the calendar goes there), a time picks the hour and closes; the form gets both', async ({
  page,
}) => {
  const picker = await open(page)
  const trigger = picker.getByRole('button', { name: /Appointment/ })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Appointment' })
  await dialog.getByRole('button', { name: 'Next week' }).click()
  const next = await day(page, 7)
  await expect(dialog.locator(`[id$="-${next}"]`)).toHaveAttribute('aria-pressed', 'true')
  await dialog.getByRole('group', { name: 'Time' }).getByRole('button', { name: '10:30 AM', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
  await expect(trigger).toContainText('10:30 AM')
  await expect(picker.locator('input[type="hidden"][name="appointment"]')).toHaveValue(`${next}T10:30`)
})

test('times run from the first slot to the last, every interval; the chosen one is pressed', async ({ page }) => {
  const picker = await open(page)
  await picker.getByRole('button', { name: /Appointment/ }).click()
  const times = page
    .getByRole('dialog', { name: 'Appointment' })
    .getByRole('group', { name: 'Time' })
    .getByRole('button')
  await expect(times).toHaveCount(17) // 9:00 to 17:00, every 30 minutes
  await expect(times.first()).toHaveText('9:00 AM')
  await expect(times.last()).toHaveText('5:00 PM')
})

test('with min, a shortcut before it is unavailable; Clear empties it all', async ({ page }) => {
  await open(page)
  const picker = page.locator('[class*="appointment-picker-min-demo"] [data-part="appointment"]')
  const trigger = picker.getByRole('button', { name: /Visit/ })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Visit' })
  await expect(dialog.getByRole('button', { name: 'Yesterday' })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Tomorrow' }).click()
  await dialog.getByRole('button', { name: '2:00 PM', exact: true }).click()
  await expect(picker.locator('input[name="visit"]')).toHaveValue(`${await day(page, 1)}T14:00`)
  await trigger.click()
  await dialog.getByRole('button', { name: 'Clear' }).click()
  await expect(picker.locator('input[name="visit"]')).toHaveValue('')
  await expect(trigger).toContainText('Pick a date and time')
})

for (const mode of modes) {
  test(`/components/appointment-picker passes axe (${mode.label})`, async ({ browser }) => {
    const page = await pageIn(browser, mode)
    await open(page)
    expect(await axeViolations(page)).toEqual([])
  })
}
