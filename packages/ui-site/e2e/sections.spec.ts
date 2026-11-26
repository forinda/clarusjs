// Marketing sections: versions of a kind on /blocks/marketing/<kind>, each framed from /view/<name>, and their grid
// effects reacting to a pointer.
import { expect, test, type Page } from '@playwright/test'
import { SECTION_KINDS, sectionsOf, type SectionKind } from '../src/registry.ts'
import { axeViolations, modes } from './helpers.ts'

/** Moves a real pointer across the middle of a frame's section, then reports what its effect layer holds. */
async function hover(page: Page, view: string) {
  await page.goto(`/view/${view}`)
  if (await page.locator('cl-island').count()) await page.locator('cl-island[data-cl-ready]').first().waitFor({ state: 'attached' })
  const box = (await page.locator('section').first().boundingBox())!
  await page.mouse.move(box.x + 4, box.y + 4)
  for (let i = 0; i < 6; i++) await page.mouse.move(box.x + box.width / 2 + i * 6, box.y + box.height / 2)
}

test('/blocks lists a Marketing group, each kind linked to its page', async ({ page }) => {
  await page.goto('/blocks')
  for (const kind of Object.keys(SECTION_KINDS) as SectionKind[]) {
    if (!sectionsOf(kind).length) continue
    const row = page.locator(`[data-block]:has(a[href="/blocks/marketing/${kind}"])`) // shown by one of its versions
    await expect(row.getByRole('link', { name: SECTION_KINDS[kind].title, exact: true })).toHaveAttribute('href', `/blocks/marketing/${kind}`)
    await expect(row).toContainText('Marketing')
  }
})

test('the hero page shows its three versions, each framed', async ({ page }) => {
  await page.goto('/blocks/marketing/hero')
  for (const e of sectionsOf('hero')) {
    await expect(page.getByRole('heading', { name: new RegExp(`^${e.title}\\b`) })).toBeVisible()
    await expect(page.locator(`iframe[src="/view/${e.name}"]`)).toBeAttached()
  }
})

test('hero-grid: a pointer over it bends the lean effect\'s lines', async ({ page }) => {
  await hover(page, 'hero-grid')
  await expect(page.locator('[data-part="grid-effect"] path').first()).toBeAttached()
  await expect(page.locator('section[data-grid-lean]')).toHaveCount(1)
})

/** axe on a kind's page (its frames included), with the pointer over its first effect's frame: effects on. */
export async function kindPageAxe(page: Page, kind: SectionKind) {
  for (const mode of modes) {
    await page.setViewportSize(mode.viewport)
    await page.emulateMedia({ colorScheme: mode.colorScheme, reducedMotion: 'no-preference' })
    await page.goto(`/blocks/marketing/${kind}`)
    for (const e of sectionsOf(kind)) await page.frameLocator(`iframe[src="/view/${e.name}"]`).locator('[data-ui-preview] > *').first().waitFor()
    const framed = sectionsOf(kind).find((e) => e.uses.includes('grid-effect'))
    if (framed) {
      const box = (await page.locator(`iframe[src="/view/${framed.name}"]`).boundingBox())!
      await page.mouse.move(box.x + 4, box.y + 4)
      for (let i = 0; i < 6; i++) await page.mouse.move(box.x + box.width / 2 + i * 6, box.y + box.height / 3)
    }
    expect(await axeViolations(page), `${kind}, ${mode.label}`).toEqual([])
  }
}

test('the hero page: no axe violations, light and dark, pointer over its effect', async ({ page }) => {
  await kindPageAxe(page, 'hero')
})

test('navbar: keyboard reaches every link and the menu; on a 390 px viewport the Menu button opens the sheet with the links', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/view/header-menus')
  await page.locator('cl-island[data-cl-ready]').first().waitFor({ state: 'attached' })
  const nav = page.getByRole('navigation', { name: 'Site', exact: true })
  const names: string[] = []
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    names.push(await page.evaluate(() => (document.activeElement as HTMLElement).innerText.trim()))
  }
  for (const n of ['Products', 'Pricing', 'Docs', 'Sign up']) expect(names, n).toContain(n)
  await nav.getByRole('button', { name: 'Products' }).click()
  await expect(page.getByRole('menuitem').first()).toBeVisible()
  await page.setViewportSize({ width: 390, height: 800 })
  await expect(nav).toBeHidden()
  await page.getByRole('button', { name: 'Menu' }).click()
  const sheet = page.getByRole('dialog', { name: 'Menu' })
  await expect(sheet.getByRole('link', { name: 'Pricing' })).toBeVisible()
})

test('the header page: no axe violations, light and dark', async ({ page }) => {
  await kindPageAxe(page, 'header')
})
