import AxeBuilder from '@axe-core/playwright'
import type { Browser, Page } from '@playwright/test'

/** What axe finds on the page (WCAG 2.2 AA and best practice), as "rule: targets" lines. */
export async function axeViolations(page: Page): Promise<string[]> {
  // axe reads computed colours: let animations finish first, or it sees them mid-fade.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)))
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze()
  return violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
}

/** The two ways every page is checked: a phone in light mode and a desktop in dark mode. */
export const modes = [
  { label: 'phone, light', viewport: { width: 390, height: 800 }, colorScheme: 'light' },
  { label: 'desktop, dark', viewport: { width: 1280, height: 900 }, colorScheme: 'dark' },
] as const

export async function pageIn(browser: Browser, mode: (typeof modes)[number]): Promise<Page> {
  const context = await browser.newContext({ viewport: mode.viewport, colorScheme: mode.colorScheme, reducedMotion: 'reduce' })
  return context.newPage()
}
