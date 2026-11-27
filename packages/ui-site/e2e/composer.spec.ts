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
  await expect(demo.locator('.messages li').first()).toHaveText(/^line one\s*two @Mara Okafor 👍\s*$/)
  await expect(demo.locator('.messages li').first().locator('br')).toHaveCount(1) // the line break kept
  await expect(demo.locator('.messages li').first().locator('[data-mention]')).toHaveCount(1)
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

test('user: long words and long code lines wrap inside the composer; nothing overflows the page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  const { demo, field } = await open(page)
  await field.click()
  const editable = demo.locator('[contenteditable=true]')
  await expect(editable).toBeFocused()
  await page.keyboard.type('x'.repeat(120))
  await page.keyboard.press('Shift+Enter')
  await demo.getByRole('button', { name: 'Code block' }).click()
  await page.keyboard.type('const longLine = "' + 'y'.repeat(120) + '"')
  for (let i = 0; i < 20; i++) await page.keyboard.press('Enter') // in a code block: new lines
  const composer = demo.locator('[data-part=composer]')
  const sizes = await composer.evaluate((el) => {
    const box = el.querySelector('[contenteditable]')!
    const rect = el.getBoundingClientRect(), demoRect = el.closest('.demo')!.getBoundingClientRect() // <cl-island> has no box
    return { editable: box.scrollWidth - box.clientWidth, composer: el.scrollWidth - el.clientWidth, right: rect.right - demoRect.right, page: document.documentElement.scrollWidth - innerWidth, height: rect.height }
  })
  expect(sizes).toMatchObject({ editable: 0, composer: 0, page: 0 })
  expect(sizes.right).toBeLessThanOrEqual(0)
  expect(sizes.height).toBeLessThan(800 * 0.6) // the field scrolls past 40vh; the composer doesn't grow with it
})
