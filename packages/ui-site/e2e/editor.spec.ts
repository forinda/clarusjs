// @clarusjs/editor's parts on their page, and the two blocks made of them: the chat composer and the comment box.
import { expect, test, type Page } from '@playwright/test'
import { axeViolations } from './helpers.ts'

async function chat(page: Page) {
  await page.goto('/view/chat-composer')
  const block = page.locator('.chat')
  return { block, field: block.getByRole('textbox', { name: 'Message' }), editable: block.locator('[contenteditable=true]') }
}

test('editor page: the parts load, the field takes over on first focus with what was typed, axe passes', async ({ page }) => {
  await page.goto('/components/editor')
  const demo = page.locator('.demo').first()
  expect(await axeViolations(page)).toEqual([])
  await expect(demo.locator('[data-command=bold]')).toBeDisabled() // nothing to run until the field's editor does
  await demo.getByRole('textbox', { name: 'Notes' }).click()
  await page.keyboard.type('Some notes')
  await expect(demo.locator('[contenteditable=true]')).toHaveText('Some notes')
  await expect(demo.locator('[data-command=bold]')).toBeEnabled()
  await expect(demo.locator('[data-part=count]')).toHaveText('10/1000')
})

test('chat: Enter sends a message shown as typed; Shift+Enter, @ mentions, :+1 emoji', async ({ page }) => {
  const { block, field, editable } = await chat(page)
  await field.click()
  await expect(editable).toBeFocused() // Markdown shortcuts are the editor's: typed into the textarea, they stay text
  await page.keyboard.type('line **one**')
  await page.keyboard.press('Shift+Enter')
  await page.keyboard.type('two @ma')
  await expect(page.getByRole('option', { name: 'Mara Okafor' })).toBeVisible()
  await page.keyboard.press('Enter')
  await page.keyboard.type(':+1')
  await expect(page.getByRole('option').first()).toHaveText('👍 :+1:')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  const message = block.locator('.messages li').first()
  await expect(message.locator('strong')).toHaveText('one')
  await expect(message.locator('br')).toHaveCount(1)
  await expect(message.locator('[data-mention="mara"]')).toHaveText('@Mara Okafor')
  await expect(message).toContainText('👍')
  await expect(editable).toHaveText('')
})

test('chat: one frame around the field and its footer (the field\'s own border is off); nothing overflows', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  const { block, field, editable } = await chat(page)
  await expect(field).toHaveCSS('border-top-width', '0px')
  await field.click()
  await expect(editable).toBeFocused()
  await page.keyboard.type('x'.repeat(160))
  await page.keyboard.press('Shift+Enter')
  await block.getByRole('button', { name: 'Code block' }).click()
  await page.keyboard.type('const longLine = "' + 'y'.repeat(160) + '"')
  for (let i = 0; i < 20; i++) await page.keyboard.press('Enter')
  const sizes = await block.locator('.composer').evaluate((el) => ({
    composer: el.scrollWidth - el.clientWidth,
    right: Math.max(0, Math.round(el.getBoundingClientRect().right - el.closest('.chat')!.getBoundingClientRect().right)),
    page: document.documentElement.scrollWidth - innerWidth,
  }))
  expect(sizes).toEqual({ composer: 0, right: 0, page: 0 })
  // axe on the block's page (the bare /view/ frame is no page of its own: no lang, main or h1)
  await page.goto('/blocks/chat-composer')
  expect(await axeViolations(page)).toEqual([])
})

test('comment box: Enter is a new line, Preview shows the draft, Cancel clears, Ctrl+Enter posts', async ({ page }) => {
  await page.goto('/view/comment-box')
  const box = page.locator('.comments')
  await box.getByRole('textbox', { name: 'Comment' }).click()
  const editable = box.locator('[contenteditable=true]')
  await expect(editable).toBeFocused()
  await page.keyboard.type('first')
  await page.keyboard.press('Enter')
  await page.keyboard.type('**second**')
  await expect(box.locator('.list li')).toHaveCount(0)
  await box.getByRole('button', { name: 'Preview' }).click()
  await expect(box.locator('.preview strong')).toHaveText('second')
  await box.getByRole('button', { name: 'Write' }).click()
  await box.getByRole('button', { name: 'Cancel' }).click()
  await expect(editable).toHaveText('')
  await editable.click()
  await page.keyboard.type('a comment')
  await page.keyboard.press('ControlOrMeta+Enter')
  await expect(box.locator('.list li')).toHaveText('a comment')
  await page.goto('/blocks/comment-box')
  expect(await axeViolations(page)).toEqual([])
})
