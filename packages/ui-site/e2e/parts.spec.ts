import { expect, test } from '@playwright/test'

test('accordion: opens one item at a time', async ({ page }) => {
  await page.goto('/components/accordion')
  const items = page.locator('.demo:not(.example) details')
  await items.nth(1).locator('summary').click()
  await expect(items.nth(1)).toHaveAttribute('open', '')
  await expect(items.nth(0)).not.toHaveAttribute('open', '')
})

for (const name of ['checkbox', 'switch']) {
  test(`${name}: toggles with click and Space`, async ({ page }) => {
    await page.goto(`/components/${name}`)
    await page.locator('.demo:not(.example) cl-island[data-cl-ready]').first().waitFor()
    const input = page.locator(`.demo:not(.example) [data-part="${name}"] input`).first()
    const out = page.locator('.demo:not(.example) .out')
    await expect(out).toHaveText('off')
    await input.click()
    await expect(out).toHaveText('on')
    await input.press('Space')
    await expect(out).toHaveText('off')
  })
}

test('radio group: arrow keys select', async ({ page }) => {
  await page.goto('/components/radio-group')
  await page.locator('.demo:not(.example) cl-island[data-cl-ready]').first().waitFor()
  const out = page.locator('.demo:not(.example) .out')
  await expect(out).toHaveText('m')
  await page.getByRole('radio', { name: 'Medium', exact: true }).focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('radio', { name: 'Large', exact: true })).toBeChecked()
  await expect(out).toHaveText('l')
})

test('field: shows its error after an invalid submit', async ({ page }) => {
  await page.goto('/components/field')
  await page.locator('.demo:not(.example) cl-island[data-cl-ready]').first().waitFor()
  const error = page.locator('.demo:not(.example) [data-part="error"]')
  await expect(error).toBeHidden()
  await page.locator('.demo:not(.example) button[type="submit"]').click()
  await expect(error).toBeVisible()
  await expect(error).toHaveText('Enter an email address.')
})

test('dialog: opens from its trigger; Escape closes it and focus returns to the trigger', async ({ page }) => {
  await page.goto('/components/dialog')
  const trigger = page.locator('.demo:not(.example) [data-part="trigger"]')
  const dialog = page.locator('.demo:not(.example) dialog')
  await trigger.click()
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('popover: opens from its trigger and closes on a click outside', async ({ page }) => {
  await page.goto('/components/popover')
  const popover = page.locator('.demo:not(.example) [data-part="popover"]')
  await page.locator('.demo:not(.example) [data-part="trigger"]').click()
  await expect(popover).toBeVisible()
  await page.locator('h1').click()
  await expect(popover).toBeHidden()
})

test('tooltip: shows on focus and hides on Escape', async ({ page }) => {
  await page.goto('/components/tooltip')
  await page.locator('.demo:not(.example) cl-island[data-cl-ready]').first().waitFor()
  const tip = page.locator('.demo:not(.example) [data-part="tooltip"]')
  await page.locator('.demo:not(.example) cl-island button').first().focus()
  await expect(tip).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(tip).toBeHidden()
})

test('menu: opens, arrow keys move, Escape closes and returns focus', async ({ page }) => {
  await page.goto('/components/menu')
  await page.locator('.demo:not(.example) cl-island[data-cl-ready]').first().waitFor()
  const trigger = page.locator('.demo:not(.example) [data-part="trigger"]')
  await trigger.click()
  const items = page.getByRole('menuitem')
  await expect(items.first()).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(items.nth(1)).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('.demo:not(.example) [data-part="menu-list"]')).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('tabs: select by click and arrow keys; the panel follows', async ({ page }) => {
  await page.goto('/components/tabs')
  await page.locator('.demo:not(.example) cl-island[data-cl-ready]').first().waitFor()
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
  await page.locator('.demo:not(.example) cl-island[data-cl-ready]').first().waitFor()
  await page.locator('.demo:not(.example) select').selectOption('l')
  await expect(page.locator('.demo:not(.example) .out')).toHaveText('l')
})

test('combobox: filters as you type, and Enter picks', async ({ page }) => {
  await page.goto('/components/combobox')
  await page.locator('.demo:not(.example) cl-island[data-cl-ready]').first().waitFor()
  const input = page.locator('.demo:not(.example)').getByRole('combobox')
  await input.fill('ban')
  await expect(page.locator('.demo:not(.example)').getByRole('option')).toHaveText(['Banana'])
  await input.press('ArrowDown')
  await input.press('Enter')
  await expect(page.locator('.demo:not(.example) .out')).toHaveText('banana')
})

test('sheet: slides in from its side; Escape closes it and focus returns', async ({ page }) => {
  await page.goto('/components/sheet')
  const trigger = page.locator('.demo:not(.example) [data-part="trigger"]').first()
  await trigger.click()
  const sheet = page.locator('.demo:not(.example) dialog[data-side="right"]')
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
  const trigger = page.locator('.demo:not(.example) [data-part="trigger"]').first()
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
  await page.locator('.demo:not(.example) cl-island[data-cl-ready]').first().waitFor()
  const bold = page.locator('.demo:not(.example) [data-part="toggle"]')
  await bold.click()
  await expect(bold).toHaveAttribute('aria-pressed', 'true')
  const align = page.locator('.demo:not(.example)').getByRole('group', { name: 'Alignment' })
  await align.getByRole('button', { name: 'Center' }).click()
  await expect(align.getByRole('button', { name: 'Center' })).toHaveAttribute('aria-pressed', 'true')
  await expect(align.getByRole('button', { name: 'Left' })).toHaveAttribute('aria-pressed', 'false')
  await page.keyboard.press('ArrowRight')
  await expect(align.getByRole('button', { name: 'Right' })).toBeFocused()
})

test('toast: a message appears in the polite region without taking focus; its action runs', async ({ page }) => {
  await page.goto('/components/toast')
  await page.locator('cl-island[c="toast-demo"][data-cl-ready]').waitFor({ state: 'attached' })
  const save = page.locator('.demo:not(.example)').getByRole('button', { name: 'Save' })
  await save.click()
  const region = page.getByRole('region', { name: 'Notifications' })
  await expect(region.locator('[data-part="toast-message"]')).toHaveText(['Saved'])
  await expect(region.locator('[aria-live="polite"]')).toHaveCount(1)
  await expect(save).toBeFocused()
  await page.locator('.demo:not(.example)').getByRole('button', { name: 'Delete project' }).click()
  await expect(page.locator('.demo:not(.example) .out')).toHaveText('1')
  await region.getByRole('button', { name: 'Undo' }).click()
  await expect(page.locator('.demo:not(.example) .out')).toHaveText('0')
})

test('sidebar: the trigger collapses it on a wide screen, and a reload keeps it collapsed from the first paint', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/components/sidebar')
  await page.locator('cl-island[c="sidebar-trigger"][data-cl-ready]').waitFor({ state: 'attached' })
  const nav = page.getByRole('navigation', { name: 'Project' })
  await expect(nav).toBeVisible()
  await page.locator('.demo:not(.example)').getByRole('button', { name: 'Menu' }).click()
  await expect(nav).toBeHidden()
  await page.reload()
  expect(await page.evaluate(() => document.documentElement.dataset.sidebar)).toBe('collapsed')
  await expect(nav).toBeHidden()
  await page.locator('.demo:not(.example)').getByRole('button', { name: 'Menu' }).click()
  await expect(nav).toBeVisible()
})

test('sidebar: on a phone the trigger opens it as a panel; Escape closes it', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 800 } })).newPage()
  await page.goto('/components/sidebar')
  await page.locator('cl-island[c="sidebar-trigger"][data-cl-ready]').waitFor({ state: 'attached' })
  const nav = page.getByRole('navigation', { name: 'Project' })
  await expect(nav).toBeHidden()
  await page.locator('.demo:not(.example)').getByRole('button', { name: 'Menu' }).click()
  await expect(nav).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(nav).toBeHidden()
  await page.context().close()
})

test('toast kinds: each kind is tinted, has its icon, and says its kind to screen readers', async ({ page }) => {
  await page.goto('/components/toast')
  await page.locator('cl-island[c="toast-demo"][data-cl-ready]').waitFor({ state: 'attached' })
  await page.locator('.demo:not(.example)').getByRole('button', { name: 'Fail' }).click()
  const item = page.locator('[data-part="toast"][data-type="error"]')
  await expect(item).toContainText('Error:')
  await expect(item).toContainText('Upload failed')
  await expect(item.locator('[data-part="toast-icon"] svg')).toHaveCount(1)
})

test('#tokens: combobox: one focus ring, on its box, not a second outline on the input inside', async ({ page }) => {
  await page.goto('/components/combobox')
  await page.locator('cl-island[data-cl-ready]').first().waitFor({ state: 'attached' })
  const input = page.locator('.demo [data-part="combobox"] [role="combobox"]').first()
  await input.focus()
  await page.keyboard.press('a') // keyboard focus (focus-visible)
  expect(await input.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('none')
  expect(await input.evaluate((el) => getComputedStyle(el.closest('[data-part="control"]')!).boxShadow)).not.toBe('none')
})

test('#tokens: input sizes: each row\'s input, select and button line up at the bottom', async ({ page }) => {
  await page.goto('/components/input')
  for (const size of ['Small', 'Medium', 'Large']) {
    const input = (await page.getByRole('textbox', { name: `${size} search` }).boundingBox())!
    const select = (await page.getByRole('combobox', { name: `${size} status` }).boundingBox())!
    const button = (await page.getByRole('button', { name: size, exact: true }).boundingBox())!
    expect(Math.abs(input.y + input.height - (select.y + select.height)), size).toBeLessThanOrEqual(1)
    expect(Math.abs(input.y + input.height - (button.y + button.height)), size).toBeLessThanOrEqual(1)
  }
})

test('#tokens: input sizes: the selects\' labels are read, not shown, so each row is one line of controls', async ({ page }) => {
  await page.goto('/components/input')
  for (const size of ['Small', 'Medium', 'Large']) {
    const input = (await page.getByRole('textbox', { name: `${size} search` }).boundingBox())!
    const select = (await page.getByRole('combobox', { name: `${size} status` }).boundingBox())!
    expect(Math.abs(input.y - select.y), size).toBeLessThanOrEqual(1) // tops line up too: no label above the select
  }
})

test('dialog backdrop variants: the backdrop dims by data-backdrop (light, dark, none) and blurs with blur', async ({ page }) => {
  await page.goto('/components/dialog')
  const backdrop = (id: string) => page.evaluate((id) => { const d = document.getElementById(id) as HTMLDialogElement; d.showModal(); const s = getComputedStyle(d, '::backdrop'); const out = { bg: s.backgroundColor, filter: s.backdropFilter }; d.close(); return out }, id)
  const alpha = (bg: string) => Number(/rgba?\([^)]*?,\s*([\d.]+)\)/.exec(bg)?.[1] ?? /\/\s*([\d.]+)\)/.exec(bg)?.[1] ?? 1)
  expect(alpha((await backdrop('dialog-backdrop-light')).bg)).toBeCloseTo(0.2)
  expect(alpha((await backdrop('dialog-backdrop-dark')).bg)).toBeCloseTo(0.7)
  expect(alpha((await backdrop('dialog-backdrop-none')).bg)).toBeCloseTo(0)
  expect((await backdrop('dialog-backdrop-blur')).filter).toContain('blur(6px)')
})
