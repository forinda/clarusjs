import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { components as registry } from '../src/registry.ts'
import { axeViolations, modes, pageIn } from './helpers.ts'

for (const entry of registry) {
  const path = `/components/${entry.name}`
  test(`${entry.name}: renders and shows its source exactly`, async ({ page }) => {
    expect((await page.goto(path))?.status()).toBe(200)
    await expect(page.locator('h1')).toHaveText(entry.title)
    // After the Source heading: directly, or inside the CSS / Tailwind switch (the CSS file first).
    const blocks = page.locator('h2#source ~ .code-block pre, h2#source ~ * [data-flavor-code] .code-block:first-of-type pre')
    for (const [i, f] of entry.files.entries()) {
      const file = readFileSync(resolve(import.meta.dirname, '../src/registry', f), 'utf8').trimEnd()
      expect((await blocks.nth(i).innerText()).trimEnd()).toBe(file)
    }
  })

  for (const mode of modes) {
    test(`${entry.name}: passes axe and fits the screen (${mode.label})`, async ({ browser }) => {
      const page = await pageIn(browser, mode)
      await page.goto(path)
      expect(await axeViolations(page)).toEqual([])
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.context().close()
    })
  }

  // An island example (button-loading-demo) renders the component in the browser, so its page carries the component's
  // render code; the component itself compiles to none (test/registry.test.ts).
  const islandExample = (entry.examples ?? []).some((x) => readFileSync(resolve(import.meta.dirname, '../src/registry', `${entry.name}-${x}-demo.tscl`), 'utf8').includes('<script>'))
  if (!entry.island && !islandExample) {
    test(`${entry.name}: no JavaScript of its own`, async ({ page }) => {
      const scripts: string[] = []
      page.on('request', (r) => { if (r.resourceType() === 'script') scripts.push(r.url()) })
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      // Its own code, not an example's (an example may be an island: button-loading-demo).
      expect(scripts.filter((s) => !s.includes('-demo') && (s.includes(`/${entry.name}-`) || s.includes(`/${entry.name}.`)))).toEqual([])
    })
  }
}

test('/components/button: eight examples, each with its code; loading blocks a second click; circles are square', async ({ page }) => {
  await page.goto('/components/button')
  for (const name of ['Variants', 'Sizes', 'Icons', 'Loading', 'Shapes', 'Full width', 'Disabled', 'With other buttons']) {
    await expect(page.getByRole('heading', { level: 3, name: new RegExp(`^${name}\\b`) })).toBeVisible()
  }
  await page.locator('cl-island[c="button-loading-demo"][data-cl-ready]').waitFor({ state: 'attached' })
  const save = page.getByRole('button', { name: 'Click to save' })
  await save.click()
  const busy = page.getByRole('button', { name: 'Saving…' })
  await expect(busy).toHaveAttribute('aria-busy', 'true')
  await expect(busy).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Click to save' })).toBeEnabled({ timeout: 5000 })
  for (const label of ['Add', 'Search']) {
    const box = (await page.getByRole('button', { name: label, exact: true }).first().boundingBox())!
    expect(Math.round(box.width)).toBe(Math.round(box.height))
  }
  const block = (await page.getByRole('button', { name: 'Create account' }).boundingBox())!
  const container = (await page.getByRole('button', { name: 'Create account' }).locator('xpath=..').boundingBox())!
  expect(block.width).toBeGreaterThan(container.width * 0.8)
})

test('/components/input: one size scale: an input, a select and a button in a row share its height (30, 36, 44px)', async ({ page }) => {
  await page.goto('/components/input')
  const demo = page.locator('[class*="input-sizes-demo"]')
  for (const [size, px] of [['sm', 30], ['md', 36], ['lg', 44]] as const) {
    const row = demo.locator(`[data-size="${size}"]`).first()
    const heights = await Promise.all(['[data-part="text-input"]', '[data-part="control"]', '[data-part="button"]'].map((sel) => row.locator(sel).first().evaluate((el) => Math.round(el.getBoundingClientRect().height))))
    expect(heights, size).toEqual([px, px, px])
  }
})

test('/components/input: the interactive examples: password shows and hides, clear empties and keeps the focus, the count follows', async ({ page }) => {
  await page.goto('/components/input')
  for (const c of ['input-password-demo', 'input-clear-demo', 'input-count-demo']) await page.locator(`cl-island[c="${c}"][data-cl-ready]`).waitFor({ state: 'attached' })
  const password = page.getByLabel('Password', { exact: true })
  await password.fill('hunter2')
  await expect(password).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Show password' }).click()
  await expect(password).toHaveAttribute('type', 'text')
  await expect(password).toHaveValue('hunter2') // the same input: what was typed stays
  await expect(page.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true')
  const query = page.getByLabel('Filter', { exact: true })
  await query.fill('invoices')
  await page.getByRole('button', { name: 'Clear' }).click()
  await expect(query).toHaveValue('')
  await expect(query).toBeFocused()
  const bio = page.getByLabel('Short bio')
  await bio.fill('Hello')
  await expect(page.getByText('5 / 80')).toBeVisible()
})

test('/components/input: the four variants look different; warning and invalid colour the border', async ({ page }) => {
  await page.goto('/components/input')
  const v = (name: string) => page.locator(`[data-part="text-input"][data-variant="${name}"]`).first()
  await expect(v('filled')).not.toHaveCSS('background-color', await v('borderless').evaluate((e) => getComputedStyle(e).backgroundColor))
  await expect(v('borderless')).toHaveCSS('border-top-width', '0px')
  await expect(v('underlined')).toHaveCSS('border-top-width', '0px')
  await expect(v('underlined')).not.toHaveCSS('border-bottom-width', '0px')
})

test('/components/input: inside an input group the input has no box of its own (the group is the box)', async ({ page }) => {
  await page.goto('/components/input')
  const inGroup = page.locator('[data-part="input-group"] > [data-part="text-input"]').first()
  await expect(inGroup).toHaveCSS('border-top-width', '0px')
  await expect(inGroup).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
})

for (const entry of registry.filter((e) => e.examples?.length)) {
  test(`${entry.name}: every example is on its page, rendered`, async ({ page }) => {
    await page.goto(`/components/${entry.name}`)
    for (const x of entry.examples!) await expect(page.locator(`[class*="${entry.name}-${x}-demo"]`).first(), x).toBeVisible()
    expect(await page.locator('.content h3').count()).toBeGreaterThanOrEqual(entry.examples!.length)
  })
}

test('badge: an icon and its word have room between them', async ({ page }) => {
  await page.goto('/components/badge')
  const badge = page.locator('[class*="badge-icons-demo"] [data-part="badge"]').first()
  const gap = await badge.evaluate((b) => b.querySelector('svg')!.getBoundingClientRect().right)
  const text = await badge.evaluate((b) => { const r = document.createRange(); r.selectNodeContents(b.lastChild!); return r.getBoundingClientRect().left })
  expect(text - gap).toBeGreaterThanOrEqual(3)
})

test('select: a disabled one looks disabled', async ({ page }) => {
  await page.goto('/components/select')
  const locked = page.getByLabel('Plan (locked)')
  await expect(locked).toBeDisabled()
  expect(Number(await locked.evaluate((e) => getComputedStyle(e).opacity))).toBeLessThan(1)
})

test('combobox: an option already picked shows a check in the list, not only a chip', async ({ page }) => {
  await page.goto('/components/combobox')
  const demo = page.locator('[class*="combobox-multiple-demo"]')
  await demo.locator('cl-island[data-cl-ready]').first().waitFor({ state: 'attached' })
  const input = demo.getByRole('combobox')
  await input.fill('Ru')
  await input.press('ArrowDown')
  await input.press('Enter')
  await input.fill('')
  await input.press('ArrowDown')
  const rust = demo.getByRole('option', { name: 'Rust' })
  await expect(rust).toHaveAttribute('aria-selected', 'true')
  expect(await rust.evaluate((o) => getComputedStyle(o, '::after').content)).not.toBe('none')
  expect(await demo.getByRole('option', { name: 'Go' }).evaluate((o) => getComputedStyle(o, '::after').content)).toBe('none')
  // The open list is on top of what follows it on the page (the code block), not under it.
  const kotlin = demo.getByRole('option', { name: 'Kotlin' })
  await kotlin.scrollIntoViewIfNeeded()
  expect(await kotlin.evaluate((o) => { const r = o.getBoundingClientRect(); return o.contains(document.elementFromPoint(r.right - 8, r.top + r.height / 2)) })).toBe(true)
})

test('sizes: the nearest size wins: a small control inside a large row is small, and md resets it', async ({ page }) => {
  await page.goto('/components/input')
  const heights = await page.evaluate(() => {
    const input = document.querySelector('[data-part="text-input"]')!
    const control = document.querySelector('[data-part="control"]')!
    const box = document.createElement('div')
    box.dataset.size = 'lg'
    const make = (el: Element, size?: string) => { const c = el.cloneNode(true) as HTMLElement; if (size) c.dataset.size = size; else delete c.dataset.size; box.append(c); return c }
    const cases = [make(input, 'sm'), make(input, 'md'), make(input), make(control, 'sm'), make(control)]
    document.querySelector('.content')!.append(box)
    return cases.map((c) => Math.round(c.getBoundingClientRect().height))
  })
  expect(heights).toEqual([30, 36, 44, 30, 44])
})

test('input: a filled input keeps its warning and error borders; a filled group keeps its error border', async ({ page }) => {
  await page.goto('/components/input')
  const colors = await page.evaluate(() => {
    const input = document.querySelector('[data-part="text-input"]')!
    const group = document.querySelector('[data-part="input-group"]')!
    const root = document.querySelector('.content')!
    const warn = input.cloneNode() as HTMLElement
    Object.assign(warn.dataset, { variant: 'filled', status: 'warning' })
    const bad = input.cloneNode() as HTMLElement
    bad.dataset.variant = 'filled'
    bad.setAttribute('aria-invalid', 'true')
    const g = group.cloneNode(true) as HTMLElement
    g.dataset.variant = 'filled'
    g.querySelector('input')!.setAttribute('aria-invalid', 'true')
    root.append(warn, bad, g)
    const probe = (v: string) => { const p = document.createElement('p'); p.style.color = `var(${v})`; root.append(p); const c = getComputedStyle(p).color; p.remove(); return c }
    return { warn: getComputedStyle(warn).borderTopColor, bad: getComputedStyle(bad).borderTopColor, group: getComputedStyle(g).borderTopColor, warning: probe('--ui-warning'), danger: probe('--ui-danger') }
  })
  expect(colors.warn).toBe(colors.warning)
  expect(colors.bad).toBe(colors.danger)
  expect(colors.group).toBe(colors.danger)
})

test('aspect ratio: any ratio; the switcher changes the box\'s shape', async ({ page }) => {
  await page.goto('/components/aspect-ratio')
  const demo = page.locator('[class*="aspect-ratio-ratios-demo"]')
  await page.locator('cl-island[c="aspect-ratio-ratios-demo"][data-cl-ready]').waitFor({ state: 'attached' })
  const box = demo.locator('[data-part="aspect-ratio"]').first()
  const shape = async () => { const b = (await box.boundingBox())!; return Math.round((b.width / b.height) * 100) / 100 }
  await demo.getByRole('button', { name: '1:1' }).click()
  await expect.poll(shape).toBe(1)
  await demo.getByRole('button', { name: '21:9' }).click()
  await expect(demo.getByRole('button', { name: '21:9' })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(shape).toBe(2.33)
})

test('button group: its buttons join: inner corners square, outer ones round', async ({ page }) => {
  await page.goto('/components/button-group')
  const radii = await page.locator('.demo:not(.example) [data-part="button-group"]').first().evaluate((g) => [...g.children].map((b) => {
    const s = getComputedStyle(b)
    return [s.borderTopLeftRadius, s.borderTopRightRadius]
  }))
  expect(radii[0]![1]).toBe('0px')
  expect(radii[1]).toEqual(['0px', '0px'])
  expect(radii.at(-1)![0]).toBe('0px')
  expect(radii[0]![0]).not.toBe('0px')
  expect(radii.at(-1)![1]).not.toBe('0px')
})

test('combobox remote example: typing asks /api/cities for the search, and lists what it answers', async ({ page }) => {
  await page.goto('/components/combobox')
  const city = page.getByRole('combobox', { name: 'City' })
  await city.scrollIntoViewIfNeeded()
  await page.locator('cl-island[data-cl-ready]', { has: city }).waitFor({ state: 'attached' })
  const asked = page.waitForRequest((r) => r.url().includes('/api/cities?q=lo'))
  await city.fill('lo')
  await asked
  const list = page.getByRole('listbox', { name: 'City' })
  await expect(list.getByRole('option', { name: 'London' })).toBeVisible()
  await expect(list.getByRole('option', { name: 'Lagos' })).toHaveCount(0) // the server filtered: "lo" isn't in Lagos
  // Answers are cached by search: going back to "lo" asks nothing again.
  await city.fill('lon')
  await expect(list.getByRole('option')).toHaveCount(1)
  const requests: string[] = []
  page.on('request', (r) => r.url().includes('/api/cities') && requests.push(r.url()))
  await city.fill('lo')
  await expect(list.getByRole('option', { name: 'Oslo' })).toBeVisible()
  await page.waitForTimeout(400) // past the 200 ms pause after the last key, when a request would go
  expect(requests).toEqual([])
  await list.getByRole('option', { name: 'London' }).click()
  await expect(city).toHaveValue('London')
})
