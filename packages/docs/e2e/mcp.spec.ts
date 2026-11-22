// #51: the MCP server's docs_search on this site's own llms-full.txt: every section it returns links to a real page and
// heading, so an agent can open what it found.
import { expect, test } from '@playwright/test'
import { search } from '@clarusjs/ai/docs'

test('docs_search results link to real pages and headings', async ({ page, request }) => {
  const full = await (await request.get('/llms-full.txt')).text()
  const found = search(full, 'island track reorder state', 5)
  expect(found.length).toBe(5)
  for (const { url } of found) {
    const { pathname, hash } = new URL(url)
    const res = await page.goto(pathname)
    expect(res?.ok(), url).toBe(true)
    if (hash) await expect(page.locator(hash), url).toHaveCount(1)
  }
})

test('the clarusjs skill is published at /skills/clarusjs/SKILL.md', async ({ request }) => {
  const res = await request.get('/skills/clarusjs/SKILL.md')
  expect(res.status()).toBe(200)
  expect(await res.text()).toMatch(/^---\nname: clarusjs\ndescription: .+\.tscl/)
})
