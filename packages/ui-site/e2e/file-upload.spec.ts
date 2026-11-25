// File upload: a real file input behind a drop zone; the island lists files with previews, checks them, and keeps the
// input's files in step so a form sends what's listed.
import { expect, test } from '@playwright/test'
import { axeViolations, modes, pageIn } from './helpers.ts'

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const files = {
  cat: { name: 'cat.png', mimeType: 'image/png', buffer: png },
  dog: { name: 'dog.png', mimeType: 'image/png', buffer: png },
  notes: { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') },
  big: { name: 'huge.png', mimeType: 'image/png', buffer: Buffer.alloc(6 * 1024 * 1024) },
}

async function open(page: import('@playwright/test').Page) {
  await page.goto('/components/file-upload')
  await page.locator('cl-island[c="file-upload"][data-cl-ready]').first().waitFor({ state: 'attached' })
  return page.locator('.demo:not(.example) [data-part="file-upload"]')
}

test('picking files lists them, images with a preview; remove takes one out; the input holds exactly what is listed', async ({ page }) => {
  const upload = await open(page)
  const input = upload.locator('input[type="file"]')
  await input.setInputFiles([files.cat, files.notes])
  const list = upload.getByRole('list', { name: 'Chosen files' })
  await expect(list.getByRole('listitem')).toHaveCount(2)
  await expect(list.getByRole('img', { name: 'cat.png' })).toHaveAttribute('src', /^blob:/)
  await input.setInputFiles([files.dog]) // picking again adds to the list
  await expect(list.getByRole('listitem')).toHaveCount(3)
  await upload.getByRole('button', { name: 'Remove notes.txt' }).click()
  await expect(list.getByRole('listitem')).toHaveCount(2)
  expect(await input.evaluate((i: HTMLInputElement) => [...i.files!].map((f) => f.name))).toEqual(['cat.png', 'dog.png'])
})

test('files are dropped onto the zone; it shows while something is dragged over it', async ({ page }) => {
  const upload = await open(page)
  const zone = upload.locator('[data-part="file-drop"]')
  const transfer = await page.evaluateHandle(() => {
    const dt = new DataTransfer()
    dt.items.add(new File(['x'], 'dropped.png', { type: 'image/png' }))
    return dt
  })
  await zone.dispatchEvent('dragover', { dataTransfer: transfer })
  await expect(upload).toHaveAttribute('data-dragging', 'true')
  await zone.dispatchEvent('drop', { dataTransfer: transfer })
  await expect(upload).not.toHaveAttribute('data-dragging', 'true')
  await expect(upload.getByRole('listitem')).toHaveCount(1)
  await expect(upload.getByRole('listitem')).toContainText('dropped.png')
})

test('a file of the wrong type or too large is refused, saying why; the rest are kept', async ({ page }) => {
  await page.goto('/components/file-upload')
  await page.locator('cl-island[c="file-upload"][data-cl-ready]').first().waitFor({ state: 'attached' })
  const images = page.locator('[class*="file-upload-images-demo"] [data-part="file-upload"]')
  await images.locator('input[type="file"]').setInputFiles([files.cat, files.notes, files.big])
  await expect(images.getByRole('listitem')).toHaveCount(1)
  await expect(images.getByRole('alert')).toContainText("notes.txt isn't an accepted type")
  await expect(images.getByRole('alert')).toContainText('huge.png is over 5 MB')
})

test('the drop zone shows the input\'s keyboard focus', async ({ page }) => {
  const upload = await open(page)
  await upload.locator('input[type="file"]').focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await expect(upload.locator('[data-part="file-drop"]')).not.toHaveCSS('outline-style', 'none')
})

for (const mode of modes) {
  test(`/components/file-upload passes axe with files listed (${mode.label})`, async ({ browser }) => {
    const page = await pageIn(browser, mode)
    const upload = await open(page)
    await upload.locator('input[type="file"]').setInputFiles([files.cat, files.notes])
    expect(await axeViolations(page)).toEqual([])
  })
}
