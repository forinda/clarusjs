// Marketing sections: versions of a kind on /blocks/marketing/<kind>, each framed from /view/<name>, and their grid
// effects reacting to a pointer.
import { expect, test, type Page } from '@playwright/test'
import { SECTION_KINDS, sectionsOf, type SectionKind } from '../src/registry.ts'
import { axeViolations, modes } from './helpers.ts'

/** Moves a real pointer across the middle of a frame's section, then reports what its effect layer holds. */
async function hover(page: Page, view: string, go = true) {
  if (go) await page.goto(`/view/${view}`)
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
      // In view first: the pointer moves in viewport coordinates, and this frame can sit below the fold.
      const frame = page.locator(`iframe[src="/view/${framed.name}"]`)
      await frame.scrollIntoViewIfNeeded()
      const box = (await frame.boundingBox())!
      await page.mouse.move(box.x + 4, box.y + 4)
      for (let i = 0; i < 6; i++) await page.mouse.move(box.x + box.width / 2 + i * 6, box.y + box.height / 3)
      await expect(page.frameLocator(`iframe[src="/view/${framed.name}"]`).locator('[data-part="grid-effect"][data-active]').first()).toBeAttached() // the effect is on
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

/** Records the trail's lit cells as they light (the mark lasts two frames; the fade is CSS), on window.__lit. */
async function watchTrail(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __lit: DOMRect[] }
    w.__lit = []
    new MutationObserver((records) => {
      for (const r of records) if ((r.target as Element).hasAttribute('data-on')) w.__lit.push((r.target as Element).getBoundingClientRect())
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-on'] })
  })
}
/** What an effect shows after a pointer crosses its section: spotlight's position, trail's lit cells, lean's paths. */
async function effectState(page: Page) {
  const lit = await page.evaluate(() => (window as unknown as { __lit?: DOMRect[] }).__lit?.length ?? 0)
  return page.locator('[data-part="grid-effect"]').first().evaluate((el, lit) => ({
    x: el.style.getPropertyValue('--ui-grid-x'),
    lit,
    paths: el.querySelectorAll('path').length,
  }), lit)
}
for (const e of (Object.keys(SECTION_KINDS) as SectionKind[]).flatMap(sectionsOf).filter((x) => x.uses.includes('grid-effect'))) {
  test(`${e.name}: its grid effect reacts to a pointer`, async ({ page }) => {
    await page.goto(`/view/${e.name}`)
    await watchTrail(page)
    await hover(page, e.name, false)
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

test('#review: the trail lights the cell under the pointer, in a frame whose width isn\'t a multiple of the cell', async ({ page }) => {
  await page.setViewportSize({ width: 1003, height: 800 })
  await page.goto('/view/stats')
  await page.locator('cl-island[data-cl-ready]').first().waitFor({ state: 'attached' })
  const box = (await page.locator('section').first().boundingBox())!
  const at = { x: box.x + box.width - 70, y: box.y + box.height - 40 } // far right, bottom rows: where a wrong count drifts most
  await watchTrail(page)
  await page.mouse.move(box.x + 2, box.y + 2)
  // In steps: one jump can be coalesced into a single pointermove (one lit cell), as Chromium does under load.
  await page.mouse.move(at.x, at.y, { steps: 12 })
  await expect.poll(() => page.evaluate(() => (window as unknown as { __lit: DOMRect[] }).__lit.length)).toBeGreaterThan(1)
  const cell = await page.evaluate(() => { const l = (window as unknown as { __lit: DOMRect[] }).__lit; const r = l[l.length - 1]!; return { x: r.x, y: r.y, width: r.width, height: r.height } })
  expect(at.x >= cell.x && at.x <= cell.x + cell.width && at.y >= cell.y && at.y <= cell.y + cell.height, JSON.stringify({ at, cell })).toBe(true)
})

test('#review: newsletter: the status region holds only the thank-you, and focus goes to it', async ({ page }) => {
  await page.goto('/view/newsletter')
  await page.locator('cl-island[data-cl-ready]').first().waitFor({ state: 'attached' })
  await expect(page.getByRole('status').getByRole('textbox')).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Email' }).fill('you@company.com')
  await page.getByRole('button', { name: 'Subscribe' }).click()
  await expect(page.getByRole('status')).toBeFocused()
})

test('#review: pricing-compare says "Not included" as an image name, not a label on a plain span', async ({ page }) => {
  await page.goto('/view/pricing-compare')
  await expect(page.getByRole('table').getByRole('img', { name: 'Not included' }).first()).toBeVisible()
})

test('footers: every link is a 24 px touch target on a phone, whatever the font (WCAG 2.5.8)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  for (const s of sectionsOf('footer')) {
    await page.goto(`/view/${s.name}`)
    const small = await page.locator('footer a, footer button').evaluateAll((els) =>
      els.filter((el) => el.getBoundingClientRect().height < 24).map((el) => el.textContent!.trim()))
    expect(small, s.name).toEqual([])
  }
})

test('footer-columns: the theme switch shows the theme the page already has, and follows it', async ({ page }) => {
  await page.addInitScript(() => addEventListener('DOMContentLoaded', () => (document.documentElement.dataset.theme = 'dark')))
  await page.goto('/view/footer-columns')
  await page.locator('cl-island[data-cl-ready]').first().waitFor({ state: 'attached' })
  await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked()
  await page.evaluate(() => document.documentElement.removeAttribute('data-theme'))
  await expect(page.getByRole('radio', { name: 'System' })).toBeChecked()
})

test('header-centred: on a phone, a link in the menu closes it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/view/header-centred')
  await page.locator('cl-island[data-cl-ready]').first().waitFor({ state: 'attached' })
  await page.getByRole('button', { name: 'Menu' }).click()
  const menu = page.getByRole('dialog', { name: 'Menu' })
  await expect(menu).toBeVisible()
  await menu.getByRole('link', { name: 'Pricing' }).click()
  await expect(menu).toBeHidden()
})

test('faq-columns: its columns fit a 320 px section with larger text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto('/view/faq-columns')
  await page.addStyleTag({ content: 'html { font-size: 20px }' })
  const [dl, section] = await page.evaluate(() => [document.querySelector('dl')!.getBoundingClientRect().right, document.querySelector('section')!.getBoundingClientRect().right])
  expect(dl).toBeLessThanOrEqual(section!)
})

test('every marketing page copies its versions into a folder of its own kind (each has its own data.ts)', async ({ page }) => {
  for (const kind of Object.keys(SECTION_KINDS) as SectionKind[]) {
    if (!sectionsOf(kind).length) continue
    await page.goto(`/blocks/marketing/${kind}`)
    await expect(page.locator('.lead'), kind).toContainText(`src/components/sections/${kind}/`)
  }
})

test('grid-backdrop\'s demo: its box (the scope root) is styled, so the backdrop stays inside it', async ({ page }) => {
  await page.goto('/components/grid-backdrop')
  const demo = page.locator('cl-island[c="grid-backdrop-demo"] .demo, .demo:has([data-part="grid-backdrop"])').first()
  expect(await demo.evaluate((el) => [getComputedStyle(el).position, getComputedStyle(el).minHeight])).toEqual(['relative', '240px'])
})
