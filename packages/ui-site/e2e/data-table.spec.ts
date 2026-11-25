// Data table: data-table.ts's helpers behind a table; its state lives in the URL, so a link brings it back.
import { expect, test } from '@playwright/test'
import { axeViolations, modes, pageIn } from './helpers.ts'

async function open(page: import('@playwright/test').Page, query = '') {
  await page.goto('/components/data-table' + query)
  await page.locator('cl-island[c="data-table-demo"][data-cl-ready]').waitFor({ state: 'attached' })
  return page.locator('.demo:not(.example)')
}
const names = (demo: import('@playwright/test').Locator) => demo.locator('tbody td[data-col="name"]').allTextContents()

test('a header sorts both ways, then off; Shift-click adds a second column; the URL follows', async ({ page }) => {
  const demo = await open(page)
  const team = demo.getByRole('button', { name: 'Team', exact: true })
  await team.click()
  await expect(demo.locator('th:has(#people-sort-team)')).toHaveAttribute('aria-sort', 'ascending')
  await demo.getByRole('button', { name: 'Name', exact: true }).click({ modifiers: ['Shift'] })
  expect(new URL(page.url()).searchParams.get('sort')).toBe('team,name')
  const first = await names(demo)
  expect(first[0]).toBe('Amara Okafor')
  await team.click()
  await expect(demo.locator('th:has(#people-sort-team)')).toHaveAttribute('aria-sort', 'descending')
  await team.click()
  await expect(demo.locator('th:has(#people-sort-team)')).toHaveAttribute('aria-sort', 'none')
  expect(new URL(page.url()).search).toBe('')
})

test('search and team filters narrow the rows; the team buttons count what the search leaves', async ({ page }) => {
  const demo = await open(page)
  await demo.getByRole('searchbox', { name: 'Search people' }).fill('engineer')
  await expect(demo.getByRole('button', { name: /^Design \d+$/ })).toHaveText(/Design\s*0/)
  await demo.getByRole('button', { name: /^Engineering \d+$/ }).click()
  for (const t of await demo.locator('tbody td[data-col="team"]').allTextContents())
    expect(t.trim()).toBe('Engineering')
  const url = new URL(page.url())
  expect(url.searchParams.get('q')).toBe('engineer')
  expect(url.searchParams.getAll('team')).toEqual(['Engineering'])
})

test('pages of 5, with where you are; a link with the state in it opens on that state', async ({ page }) => {
  let demo = await open(page)
  await expect(demo.locator('[data-part="data-table-range"]')).toHaveText('1–5 of 12')
  await demo.getByRole('button', { name: 'Next page' }).click()
  await expect(demo.locator('[data-part="data-table-range"]')).toHaveText('6–10 of 12')
  expect(new URL(page.url()).searchParams.get('page')).toBe('2')
  demo = await open(page, '?sort=joined.desc&team=Sales&q=a')
  await expect(demo.getByRole('searchbox', { name: 'Search people' })).toHaveValue('a')
  await expect(demo.getByRole('button', { name: /^Sales \d+$/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(demo.locator('th:has(#people-sort-joined)')).toHaveAttribute('aria-sort', 'descending')
})

for (const mode of modes) {
  test(`/components/data-table passes axe (${mode.label})`, async ({ browser }) => {
    const page = await pageIn(browser, mode)
    await page.goto('/components/data-table')
    expect(await axeViolations(page)).toEqual([])
  })
}

test('selection: Shift-click selects a range; the header checkbox goes indeterminate, then selects or clears them all', async ({
  page,
}) => {
  await page.goto('/components/data-table')
  await page.locator('cl-island[c="data-table-selection-demo"][data-cl-ready]').waitFor({ state: 'attached' })
  const demo = page.locator('[class*="data-table-selection-demo"]')
  const all = demo.getByRole('checkbox', { name: 'Select all' })
  const status = demo.getByRole('status')
  await expect(status).toHaveText('None selected')
  await demo.getByRole('checkbox', { name: 'Select INV-002' }).click()
  await demo.getByRole('checkbox', { name: 'Select INV-004' }).click({ modifiers: ['Shift'] })
  for (const n of ['002', '003', '004'])
    await expect(demo.getByRole('checkbox', { name: `Select INV-${n}` })).toBeChecked()
  await expect(demo.getByRole('checkbox', { name: 'Select INV-005' })).not.toBeChecked()
  await expect(status).toHaveText('3 selected')
  expect(await all.evaluate((el: HTMLInputElement) => el.indeterminate)).toBe(true)
  await all.click()
  await expect(status).toHaveText('6 selected')
  await expect(all).toBeChecked()
  expect(await all.evaluate((el: HTMLInputElement) => el.indeterminate)).toBe(false)
  await all.click()
  await expect(status).toHaveText('None selected')
  await demo.getByRole('checkbox', { name: 'Select INV-001' }).click()
  await demo.getByRole('button', { name: 'Clear selection' }).click()
  await expect(status).toHaveText('None selected')
})

test("columns resize: drag a header's edge, or focus it and use the arrow keys; sorting keeps the widths", async ({
  page,
}) => {
  const demo = await open(page)
  const handle = demo.getByRole('separator', { name: 'Resize Role' })
  const th = demo.locator('th:has(#people-sort-role)')
  const width = () => th.evaluate((el) => Math.round(el.getBoundingClientRect().width))
  const before = await width()
  await expect(handle).toHaveAttribute('aria-valuenow', String(before))
  await handle.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(width).toBe(before + 16)
  const box = (await handle.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 4 })
  await page.mouse.up()
  await expect.poll(width).toBe(before + 76)
  await demo.getByRole('button', { name: 'Name', exact: true }).click()
  await expect.poll(width).toBe(before + 76)
})
