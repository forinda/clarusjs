// Resizable: two panels and a handle between them, dragged with a pointer or moved with the keyboard.
import { expect, test } from '@playwright/test'
import { axeViolations, modes, pageIn } from './helpers.ts'

async function open(page: import('@playwright/test').Page) {
  await page.goto('/components/resizable')
  await page.locator('cl-island[c="resizable"][data-cl-ready]').first().waitFor({ state: 'attached' })
  return page.locator('.demo:not(.example) [data-part="resizable"]').first()
}
const width = (l: import('@playwright/test').Locator) => l.evaluate((el) => el.getBoundingClientRect().width)

test('the handle is a separator with its value; the arrow keys move it, Home and End go to the limits', async ({
  page,
}) => {
  const split = await open(page)
  const handle = split.getByRole('separator', { name: 'Resize the sidebar' })
  await expect(handle).toHaveAttribute('aria-valuenow', '30')
  await expect(handle).toHaveAttribute('aria-orientation', 'vertical')
  await handle.focus()
  await page.keyboard.press('ArrowRight')
  await expect(handle).toHaveAttribute('aria-valuenow', '35')
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowLeft')
  await expect(handle).toHaveAttribute('aria-valuenow', '25')
  await page.keyboard.press('Home')
  await expect(handle).toHaveAttribute('aria-valuenow', '20')
  await page.keyboard.press('End')
  await expect(handle).toHaveAttribute('aria-valuenow', '60')
})

test('dragging the handle resizes the panels, within the limits', async ({ page }) => {
  const split = await open(page)
  const first = split.locator('[data-part="resizable-panel"]').first()
  const total = await width(split)
  const before = await width(first)
  const box = (await split.getByRole('separator').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + total * 0.2, box.y + box.height / 2, { steps: 5 })
  await page.mouse.up()
  expect(await width(first)).toBeGreaterThan(before + total * 0.1)
  await page.mouse.move(box.x + total * 0.2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + total * 2, box.y + box.height / 2, { steps: 5 })
  await page.mouse.up()
  await expect(split.getByRole('separator')).toHaveAttribute('aria-valuenow', '60')
})

test('vertical: the panels stack, and Up and Down move the handle', async ({ page }) => {
  await open(page)
  const split = page.locator('[class*="resizable-vertical-demo"] [data-part="resizable"]')
  const handle = split.getByRole('separator')
  await expect(handle).toHaveAttribute('aria-orientation', 'horizontal')
  const now = Number(await handle.getAttribute('aria-valuenow'))
  await handle.focus()
  await page.keyboard.press('ArrowDown')
  await expect(handle).toHaveAttribute('aria-valuenow', String(now + 5))
})

for (const mode of modes) {
  test(`/components/resizable passes axe (${mode.label})`, async ({ browser }) => {
    const page = await pageIn(browser, mode)
    await open(page)
    expect(await axeViolations(page)).toEqual([])
  })
}
