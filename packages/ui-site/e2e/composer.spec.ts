// The composer (@clarusjs/editor): a textarea until first focus, then the editor with what was typed; Enter sends,
// @ mentions, : emoji by shortcode; and the page passes axe.
import { expect, test } from '@playwright/test'
import { axeViolations } from './helpers.ts'

async function open(page: import('@playwright/test').Page) {
  await page.goto('/components/composer')
  const demo = page.locator('.demo').first()
  return { demo, field: demo.getByRole('textbox', { name: 'Message' }) }
}

test('a textarea until used: typing before the code loads is kept, and the editor takes over', async ({ page }) => {
  const { demo, field } = await open(page)
  await expect(demo.locator('textarea')).toHaveCount(1)
  await field.click()
  await page.keyboard.type('Hello there')
  await expect(demo.locator('[contenteditable=true]')).toBeVisible()
  await expect(demo.locator('textarea')).toHaveCount(0)
  await expect(demo.getByRole('textbox', { name: 'Message' })).toHaveText('Hello there')
})

test('Enter sends to the list; Shift+Enter is a new line; @ mentions; :+1 inserts 👍', async ({ page }) => {
  const { demo, field } = await open(page)
  await field.click()
  await expect(demo.locator('[contenteditable=true]')).toBeFocused()
  const editable = demo.locator('[contenteditable=true]')
  await page.keyboard.type('line one')
  await page.keyboard.press('Shift+Enter')
  await page.keyboard.type('two @ma')
  await expect(page.getByRole('option', { name: 'Mara Okafor' })).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(editable.locator('[data-mention="mara"]')).toHaveText('@Mara Okafor')
  await page.keyboard.type(':+1')
  await expect(page.getByRole('option').first()).toHaveText('👍 :+1:')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await expect(demo.locator('.messages li').first()).toHaveText('line one\ntwo @Mara Okafor 👍')
  await expect(editable).toHaveText('')
})

test('the composer page passes axe, before and after the editor loads', async ({ page }) => {
  const { field } = await open(page)
  expect(await axeViolations(page)).toEqual([])
  await field.click()
  await page.keyboard.type('@ma')
  await expect(page.getByRole('option', { name: 'Mara Okafor' })).toBeVisible()
  expect(await axeViolations(page)).toEqual([])
})
