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

// Every kind with versions: its page shows each version framed, has no axe violations, and every version with a grid
// effect reacts to a pointer in its own frame.
const kinds = (Object.keys(SECTION_KINDS) as SectionKind[]).filter((k) => sectionsOf(k).length && k !== 'hero' && k !== 'header')
for (const kind of kinds) {
  test(`the ${kind} page shows its versions, each framed, with no axe violations`, async ({ page }) => {
    await page.goto(`/blocks/marketing/${kind}`)
    for (const e of sectionsOf(kind)) await expect(page.locator(`iframe[src="/view/${e.name}"]`)).toBeAttached()
    await kindPageAxe(page, kind)
  })
}

/** What an effect shows after a pointer crosses its section: spotlight's position, trail's lit cells, lean's paths. */
async function effectState(page: Page) {
  return page.locator('[data-part="grid-effect"]').first().evaluate((el) => ({
    x: el.style.getPropertyValue('--ui-grid-x'),
    lit: el.querySelectorAll('[data-on]').length + el.querySelectorAll('[data-cell]').length,
    paths: el.querySelectorAll('path').length,
  }))
}
for (const e of (Object.keys(SECTION_KINDS) as SectionKind[]).flatMap(sectionsOf).filter((x) => x.uses.includes('grid-effect'))) {
  test(`${e.name}: its grid effect reacts to a pointer`, async ({ page }) => {
    await hover(page, e.name)
    const s = await effectState(page)
    expect(s.x !== '' || s.lit > 0 || s.paths > 0, JSON.stringify(s)).toBe(true)
  })
}

test('pricing-plans: the yearly switch changes every set price; Custom stays', async ({ page }) => {
  await page.goto('/view/pricing-plans')
  await page.locator('cl-island[data-cl-ready]').first().waitFor({ state: 'attached' })
  const { plans } = await import('../src/registry/sections/pricing/data.ts')
  const shown = (k: 'monthly' | 'yearly') => plans.map((p) => (p[k] === null ? 'Custom' : '$' + p[k]))
  const prices = page.locator('[data-price]')
  await expect(prices).toHaveText(shown('monthly'))
  await page.getByRole('switch', { name: 'Billed yearly' }).click()
  await expect(prices).toHaveText(shown('yearly'))
  await expect(page.getByText('Popular', { exact: true })).toBeVisible()
})

test('pricing-compare: a table with a column header per plan and a check per included feature', async ({ page }) => {
  await page.goto('/view/pricing-compare')
  const table = page.getByRole('table')
  for (const plan of ['Hobby', 'Pro', 'Enterprise']) await expect(table.getByRole('columnheader', { name: new RegExp(plan) })).toBeVisible()
  await expect(table.getByRole('img', { name: 'Included' }).first()).toBeVisible()
})

test('faq-accordion opens an answer by keyboard', async ({ page }) => {
  await page.goto('/view/faq-accordion')
  const first = page.locator('summary').first()
  await first.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('details').first()).toHaveAttribute('open', '')
})

test('newsletter shows subscribe()\'s error on the field, and a thank-you when it works', async ({ page }) => {
  await page.goto('/view/newsletter')
  await page.locator('cl-island[data-cl-ready]').first().waitFor({ state: 'attached' })
  const email = page.getByRole('textbox', { name: 'Email' })
  await email.fill('not-an-address')
  await page.getByRole('button', { name: 'Subscribe' }).click()
  await expect(email).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText(/like you@company\.com/)).toBeVisible()
  await email.fill('you@company.com')
  await page.getByRole('button', { name: 'Subscribe' }).click()
  await expect(page.getByRole('status')).toContainText('Thanks')
})

test('two effects on one page react independently: moving over one leaves the other still', async ({ page }) => {
  await page.goto('/view/test/two-effects')
  await page.locator('cl-island[data-cl-ready]').nth(1).waitFor({ state: 'attached' })
  const sections = page.locator('section')
  const box = (await sections.nth(0).boundingBox())!
  await page.mouse.move(box.x + 4, box.y + 4)
  for (let i = 0; i < 6; i++) await page.mouse.move(box.x + box.width / 2 + i * 6, box.y + box.height / 2)
  await expect(sections.nth(0)).toHaveAttribute('data-grid-lean', '')
  await expect(sections.nth(1)).not.toHaveAttribute('data-grid-lean', '')
  expect(await sections.nth(1).locator('[data-part="grid-effect"] path').count()).toBe(0)
})

test('footer-columns: four labelled link columns; the theme switch changes the frame\'s theme', async ({ page }) => {
  await page.goto('/view/footer-columns')
  await page.locator('cl-island[data-cl-ready]').first().waitFor({ state: 'attached' })
  const footer = page.getByRole('contentinfo', { name: 'Site footer' })
  for (const name of ['Product', 'Resources', 'Company', 'Legal']) await expect(footer.getByRole('navigation', { name })).toBeVisible()
  await expect(footer).toContainText('All systems normal')
  await footer.getByRole('radio', { name: 'Dark' }).check()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await footer.getByRole('radio', { name: 'System' }).check()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./)
})
