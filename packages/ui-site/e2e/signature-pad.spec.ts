// Signature pad: draw with a pointer (or type a name instead); the signature is a PNG in a hidden input its form sends.
import { expect, test } from '@playwright/test'
import { axeViolations, modes, pageIn } from './helpers.ts'

async function open(page: import('@playwright/test').Page) {
  await page.goto('/components/signature-pad')
  await page.locator('cl-island[c="signature-pad"][data-cl-ready]').first().waitFor({ state: 'attached' })
  return page.locator('.demo:not(.example) [data-part="signature-pad"]')
}
async function draw(page: import('@playwright/test').Page, pad: import('@playwright/test').Locator, dy = 0) {
  const box = (await pad.locator('canvas').boundingBox())!
  await page.mouse.move(box.x + 20, box.y + box.height / 2 + dy)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + 20 + i * 15, box.y + box.height / 2 + dy + (i % 2 ? -10 : 10))
  await page.mouse.up()
}
const value = (pad: import('@playwright/test').Locator) => pad.locator('input[type="hidden"]').inputValue()

test('drawing makes a PNG signature in the hidden input; Undo takes the last stroke back, Clear empties it', async ({ page }) => {
  const pad = await open(page)
  expect(await value(pad)).toBe('')
  await expect(pad.getByRole('button', { name: 'Undo' })).toBeDisabled()
  await draw(page, pad)
  await expect.poll(() => value(pad)).toMatch(/^data:image\/png;base64,/)
  await draw(page, pad, 20)
  const two = await value(pad)
  await pad.getByRole('button', { name: 'Undo' }).click()
  await expect.poll(() => value(pad)).not.toBe(two)
  expect(await value(pad)).toMatch(/^data:image\/png/)
  await pad.getByRole('button', { name: 'Clear' }).click()
  await expect.poll(() => value(pad)).toBe('')
})

test('typing a name instead makes the signature too (no pointer needed)', async ({ page }) => {
  const pad = await open(page)
  await pad.getByRole('button', { name: 'Type instead' }).click()
  const name = pad.getByLabel('Type your name')
  await expect(name).toBeFocused()
  await name.pressSequentially('Ada Lovelace')
  await expect.poll(() => value(pad)).toMatch(/^data:image\/png;base64,/)
  await pad.getByRole('button', { name: 'Draw instead' }).click()
  await expect(pad.locator('canvas')).toBeVisible()
})

test('the canvas is named, and the hidden input carries the field name for the form', async ({ page }) => {
  const pad = await open(page)
  await expect(pad.getByRole('img', { name: /signature/i })).toBeVisible()
  await expect(pad.locator('input[type="hidden"]')).toHaveAttribute('name', 'signature')
})

for (const mode of modes) {
  test(`/components/signature-pad passes axe (${mode.label})`, async ({ browser }) => {
    const page = await pageIn(browser, mode)
    await open(page)
    expect(await axeViolations(page)).toEqual([])
  })
}
