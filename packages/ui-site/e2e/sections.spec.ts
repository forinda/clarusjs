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
    for (const e of sectionsOf(kind)) await page.frameLocator(`iframe[src="/view/${e.name}"]`).locator('section').first().waitFor()
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
