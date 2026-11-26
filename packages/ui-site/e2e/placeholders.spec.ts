// Every text field on the site's pages shows a placeholder: an example of what goes in it. Text-like inputs and
// textareas only (checkboxes, radios, colours, ranges, files and dates have nothing to hint).
import { expect, test } from '@playwright/test'
import { blocks, components } from '../src/registry.ts'

const TEXT = 'input:not([type]), input[type=text], input[type=search], input[type=email], input[type=password], input[type=url], input[type=tel], input[type=number], textarea'

test('every text field on a component or block page has a placeholder', async ({ page }) => {
  test.setTimeout(300_000)
  const pages = [...components.map((c) => `/components/${c.name}`), ...blocks.map((b) => `/view/${b.name}`)]
  const misses: string[] = []
  for (const path of pages) {
    await page.goto(path)
    const found = await page.locator(`main ${TEXT.split(', ').join(', main ')}, [data-ui-preview] ${TEXT.split(', ').join(', [data-ui-preview] ')}`).evaluateAll((els) =>
      els.filter((e) => !(e as HTMLInputElement).placeholder && !(e as HTMLElement).closest('header, nav, .search, [data-part="calendar"]'))
        .map((e) => e.outerHTML.replace(/\s+/g, ' ').slice(0, 90)))
    for (const f of found) misses.push(`${path}: ${f}`)
  }
  expect(misses).toEqual([])
})
