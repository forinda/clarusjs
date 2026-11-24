// An island works when clicked, and the page passes axe. (counter is this site's island: use one of yours.)
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('counter: clicking counts up, and the page passes axe', async ({ page }) => {
  await page.goto('/')
  const counter = page.locator('cl-island[c="counter"]')
  await expect(counter).toHaveAttribute('data-cl-ready', '') // the island has attached
  await counter.getByRole('button').click()
  await expect(counter.getByRole('button')).toContainText('Clicked 1 time')

  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  expect(violations).toEqual([])
})
