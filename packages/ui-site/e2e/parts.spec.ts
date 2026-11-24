import { expect, test } from '@playwright/test'

test('accordion: opens one item at a time', async ({ page }) => {
  await page.goto('/components/accordion')
  const items = page.locator('.demo details')
  await items.nth(1).locator('summary').click()
  await expect(items.nth(1)).toHaveAttribute('open', '')
  await expect(items.nth(0)).not.toHaveAttribute('open', '')
})

for (const name of ['checkbox', 'switch']) {
  test(`${name}: toggles with click and Space`, async ({ page }) => {
    await page.goto(`/components/${name}`)
    await page.locator('.demo cl-island[data-cl-ready]').first().waitFor()
    const input = page.locator(`.demo [data-part="${name}"] input`).first()
    const out = page.locator('.demo .out')
    await expect(out).toHaveText('off')
    await input.click()
    await expect(out).toHaveText('on')
    await input.press('Space')
    await expect(out).toHaveText('off')
  })
}

test('radio group: arrow keys select', async ({ page }) => {
  await page.goto('/components/radio-group')
  await page.locator('.demo cl-island[data-cl-ready]').first().waitFor()
  const out = page.locator('.demo .out')
  await expect(out).toHaveText('m')
  await page.getByRole('radio', { name: 'Medium', exact: true }).focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('radio', { name: 'Large', exact: true })).toBeChecked()
  await expect(out).toHaveText('l')
})

test('field: shows its error after an invalid submit', async ({ page }) => {
  await page.goto('/components/field')
  await page.locator('.demo cl-island[data-cl-ready]').first().waitFor()
  const error = page.locator('.demo [data-part="error"]')
  await expect(error).toBeHidden()
  await page.locator('.demo button[type="submit"]').click()
  await expect(error).toBeVisible()
  await expect(error).toHaveText('Enter an email address.')
})

test('dialog: opens from its trigger; Escape closes it and focus returns to the trigger', async ({ page }) => {
  await page.goto('/components/dialog')
  const trigger = page.locator('.demo [data-part="trigger"]')
  const dialog = page.locator('.demo dialog')
  await trigger.click()
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('popover: opens from its trigger and closes on a click outside', async ({ page }) => {
  await page.goto('/components/popover')
  const popover = page.locator('.demo [data-part="popover"]')
  await page.locator('.demo [data-part="trigger"]').click()
  await expect(popover).toBeVisible()
  await page.locator('h1').click()
  await expect(popover).toBeHidden()
})

test('tooltip: shows on focus and hides on Escape', async ({ page }) => {
  await page.goto('/components/tooltip')
  await page.locator('.demo cl-island[data-cl-ready]').first().waitFor()
  const tip = page.locator('.demo [data-part="tooltip"]')
  await page.locator('.demo cl-island button').first().focus()
  await expect(tip).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(tip).toBeHidden()
})

test('menu: opens, arrow keys move, Escape closes and returns focus', async ({ page }) => {
  await page.goto('/components/menu')
  await page.locator('.demo cl-island[data-cl-ready]').first().waitFor()
  const trigger = page.locator('.demo [data-part="trigger"]')
  await trigger.click()
  const items = page.getByRole('menuitem')
  await expect(items.first()).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(items.nth(1)).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('.demo [data-part="menu-list"]')).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('tabs: select by click and arrow keys; the panel follows', async ({ page }) => {
  await page.goto('/components/tabs')
  await page.locator('.demo cl-island[data-cl-ready]').first().waitFor()
  const tab = (name: string) => page.getByRole('tab', { name, exact: true })
  await tab('pnpm').click()
  await expect(tab('pnpm')).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tabpanel')).toContainText('pnpm add clarusjs')
  await page.keyboard.press('ArrowRight')
  await expect(tab('yarn')).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tabpanel')).toContainText('yarn add clarusjs')
})

test('select: changes its value', async ({ page }) => {
  await page.goto('/components/select')
  await page.locator('.demo cl-island[data-cl-ready]').first().waitFor()
  await page.locator('.demo select').selectOption('l')
  await expect(page.locator('.demo .out')).toHaveText('l')
})

test('combobox: filters as you type, and Enter picks', async ({ page }) => {
  await page.goto('/components/combobox')
  await page.locator('.demo cl-island[data-cl-ready]').first().waitFor()
  const input = page.getByRole('combobox')
  await input.fill('ban')
  await expect(page.getByRole('option')).toHaveText(['Banana'])
  await input.press('ArrowDown')
  await input.press('Enter')
  await expect(page.locator('.demo .out')).toHaveText('banana')
})

test('sheet: slides in from its side; Escape closes it and focus returns', async ({ page }) => {
  await page.goto('/components/sheet')
  const trigger = page.locator('.demo [data-part="trigger"]').first()
  await trigger.click()
  const sheet = page.locator('.demo dialog[data-side="right"]')
  await expect(sheet).toBeVisible()
  await sheet.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished))) // measured after the slide
  const box = await sheet.boundingBox()
  expect(Math.round(box!.x + box!.width)).toBe(page.viewportSize()!.width) // flush with the right edge
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('alert dialog: a click outside does not close it; Escape and Cancel do (as cancel); the action does too', async ({ page }) => {
  await page.goto('/components/alert-dialog')
  const trigger = page.locator('.demo [data-part="trigger"]').first()
  const dialog = page.getByRole('alertdialog')
  await trigger.click()
  await expect(dialog).toBeVisible()
  await page.mouse.click(5, 5)
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
  await trigger.click()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
  await trigger.click()
  await dialog.getByRole('button', { name: 'Delete' }).click()
  await expect(dialog).toBeHidden()
})

test('toggle: pressing flips aria-pressed; a single group keeps one pressed; arrow keys move between items', async ({ page }) => {
  await page.goto('/components/toggle')
  await page.locator('.demo cl-island[data-cl-ready]').first().waitFor()
  const bold = page.locator('.demo [data-part="toggle"]')
  await bold.click()
  await expect(bold).toHaveAttribute('aria-pressed', 'true')
  const align = page.getByRole('group', { name: 'Alignment' })
  await align.getByRole('button', { name: 'Center' }).click()
  await expect(align.getByRole('button', { name: 'Center' })).toHaveAttribute('aria-pressed', 'true')
  await expect(align.getByRole('button', { name: 'Left' })).toHaveAttribute('aria-pressed', 'false')
  await page.keyboard.press('ArrowRight')
  await expect(align.getByRole('button', { name: 'Right' })).toBeFocused()
})
