// Calendar and Date picker: our own calendar, by pointer or keyboard; a popover that opens it from a button.
import { expect, test } from '@playwright/test'
import { axeViolations, modes, pageIn } from './helpers.ts'

async function ready(page: import('@playwright/test').Page, path: string, island: string) {
  await page.goto(path)
  await page.locator(`cl-island[c="${island}"][data-cl-ready]`).first().waitFor({ state: 'attached' })
}

test('calendar: the arrow keys move a day or a week, PageDown a month, Home and End the week; Enter picks', async ({
  page,
}) => {
  await ready(page, '/components/calendar', 'calendar-demo')
  const cal = page.locator('.demo:not(.example)')
  const title = cal.locator('[data-part="calendar-title"]')
  await expect(title).toHaveText('November 2026')
  await cal.getByRole('button', { name: 'Wednesday, November 18, 2026' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(cal.getByRole('button', { name: 'Thursday, November 19, 2026' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(cal.getByRole('button', { name: 'Thursday, November 26, 2026' })).toBeFocused()
  await page.keyboard.press('Home')
  await expect(cal.getByRole('button', { name: 'Sunday, November 22, 2026' })).toBeFocused()
  await page.keyboard.press('End')
  await expect(cal.getByRole('button', { name: 'Saturday, November 28, 2026' })).toBeFocused()
  await page.keyboard.press('PageDown')
  await expect(title).toHaveText('December 2026')
  await expect(cal.getByRole('button', { name: 'Monday, December 28, 2026' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(cal.getByRole('button', { name: 'Monday, December 28, 2026' })).toHaveAttribute('aria-pressed', 'true')
  await expect(cal.locator('output')).toHaveText('2026-12-28')
})

test("calendar: days outside min and max say they are unavailable and can't be picked", async ({ page }) => {
  await ready(page, '/components/calendar', 'calendar-limits-demo')
  const cal = page.locator('[class*="calendar-limits-demo"]')
  const early = cal.getByRole('button', { name: /November 2, 2026, unavailable/ })
  await expect(early).toHaveAttribute('aria-disabled', 'true')
  await early.click({ force: true }) // aria-disabled: Playwright won't click it unforced; the calendar must ignore it
  await expect(early).toHaveAttribute('aria-pressed', 'false')
})

test('calendar: a range is a start and an end, the days between marked', async ({ page }) => {
  await ready(page, '/components/calendar', 'calendar-range-demo')
  const cal = page.locator('[class*="calendar-range-demo"]')
  await cal.getByRole('button', { name: 'Tuesday, November 10, 2026' }).click()
  await cal.getByRole('button', { name: 'Friday, November 13, 2026' }).click()
  await expect(cal.getByRole('button', { name: 'Wednesday, November 11, 2026' })).toHaveAttribute(
    'data-between',
    'true',
  )
  await expect(cal.locator('output')).toHaveText('2026-11-10 → 2026-11-13')
})

test('date picker: the button opens the calendar on a day; picking one closes it, back on the button, which shows the date', async ({
  page,
}) => {
  await ready(page, '/components/date-picker', 'date-picker')
  const picker = page.locator('.demo:not(.example) [data-part="date-picker"]')
  const trigger = picker.getByRole('button', { name: /Delivery date/ })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Delivery date' })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('[data-part="calendar-day"]:focus')).toHaveCount(1)
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
  const iso = await picker.locator('input[type="hidden"][name="delivery"]').inputValue()
  expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  await expect(trigger).not.toContainText('Pick a date')
})

test('date picker: Escape closes the calendar and the focus goes back to the button', async ({ page }) => {
  await ready(page, '/components/date-picker', 'date-picker')
  const trigger = page.locator('.demo:not(.example)').getByRole('button', { name: /Delivery date/ })
  await trigger.click()
  await expect(page.getByRole('dialog', { name: 'Delivery date' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Delivery date' })).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('date picker: a range takes two picks, then closes; both dates go to the form', async ({ page }) => {
  await ready(page, '/components/date-picker', 'date-picker')
  const picker = page.locator('[class*="date-picker-range-demo"] [data-part="date-picker"]')
  await picker.getByRole('button', { name: /Stay/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Stay' })
  await dialog.getByRole('button', { name: 'Tuesday, December 8, 2026' }).click()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Friday, December 11, 2026' }).click()
  await expect(dialog).toBeHidden()
  await expect(picker.locator('input[name="stay"]')).toHaveValue('2026-12-08')
  await expect(picker.locator('input[name="stay-end"]')).toHaveValue('2026-12-11')
  await expect(picker.getByRole('button', { name: /Stay/ })).toContainText('Dec 8 – 11, 2026')
})

for (const mode of modes)
  for (const path of ['/components/calendar', '/components/date-picker']) {
    test(`${path} passes axe (${mode.label})`, async ({ browser }) => {
      const page = await pageIn(browser, mode)
      await page.goto(path)
      expect(await axeViolations(page)).toEqual([])
    })
  }

test('calendar: double arrows move a year, single arrows a month; the month and year lists jump straight there', async ({
  page,
}) => {
  await ready(page, '/components/calendar', 'calendar-demo')
  const cal = page.locator('.demo:not(.example)')
  const title = cal.locator('[data-part="calendar-title"]')
  await cal.getByRole('button', { name: 'Next year' }).click()
  await expect(title).toHaveText('November 2027')
  await cal.getByRole('button', { name: 'Previous month' }).click()
  await expect(title).toHaveText('October 2027')
  await cal.getByRole('button', { name: 'Previous year' }).click()
  await expect(title).toHaveText('October 2026')
  await cal.getByRole('combobox', { name: 'Month' }).selectOption({ label: 'March' })
  await expect(title).toHaveText('March 2026')
  await cal.getByRole('combobox', { name: 'Year' }).selectOption('1990')
  await expect(title).toHaveText('March 1990')
  await expect(cal.getByRole('combobox', { name: 'Month' })).toHaveValue('3')
})

test('calendar: with limits, the year list holds only the years within them', async ({ page }) => {
  await ready(page, '/components/calendar', 'calendar-limits-demo')
  const years = page
    .locator('[class*="calendar-limits-demo"]')
    .getByRole('combobox', { name: 'Year' })
    .locator('option')
  await expect(years).toHaveText(['2026'])
})

test('date picker: Clear empties the date (and the form value), closes, and goes back to the button', async ({
  page,
}) => {
  await ready(page, '/components/date-picker', 'date-picker')
  const picker = page.locator('[class*="date-picker-range-demo"] [data-part="date-picker"]')
  const trigger = picker.getByRole('button', { name: /Stay/ })
  await trigger.click()
  await page.getByRole('dialog', { name: 'Stay' }).getByRole('button', { name: 'Clear' }).click()
  await expect(page.getByRole('dialog', { name: 'Stay' })).toBeHidden()
  await expect(trigger).toBeFocused()
  await expect(trigger).toContainText('Pick a date')
  await expect(picker.locator('input[name="stay"]')).toHaveValue('')
  await expect(picker.locator('input[name="stay-end"]')).toHaveValue('')
})
