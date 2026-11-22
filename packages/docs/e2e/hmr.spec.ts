// #53: in dev, editing an island swaps it in place with its state; editing a page reloads it. The other tests run
// against the built site, so this one starts its own dev server, edits two files and puts them back.
import { expect, test } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer, type ViteDevServer } from 'vite'

const root = resolve(import.meta.dirname, '..')
const counter = resolve(root, 'src/components/counter.tscl')
const lesson = resolve(root, 'src/pages/learn/first-island.md')
const originals = new Map([counter, lesson].map((f) => [f, readFileSync(f, 'utf8')]))
let server: ViteDevServer
let base: string

test.describe.configure({ mode: 'serial' })
test.beforeAll(async () => {
  server = await createServer({ root, configFile: resolve(root, 'vite.config.ts'), logLevel: 'silent', server: { port: 0 } })
  await server.listen()
  const address = server.httpServer!.address()
  base = `http://localhost:${typeof address === 'object' && address ? address.port : 0}`
})
test.afterAll(async () => {
  for (const [file, text] of originals) writeFileSync(file, text)
  await server?.close()
})

test('editing an island swaps it in place and keeps its count', async ({ page }) => {
  await page.goto(`${base}/`)
  const button = page.locator('.demo button.counter')
  await expect(page.locator('.demo cl-island[data-cl-ready]')).toHaveCount(1)
  await button.click()
  await button.click()
  await expect(button).toHaveText('Clicked 2 times (double: 4)')
  await page.evaluate(() => { (window as { stayed?: boolean }).stayed = true })

  writeFileSync(counter, originals.get(counter)!.replace('Clicked {{ count }}', 'Pressed {{ count }}'))
  await expect(button).toHaveText('Pressed 2 times (double: 4)')
  expect(await page.evaluate(() => (window as { stayed?: boolean }).stayed)).toBe(true) // not reloaded
  await button.click()
  await expect(button).toHaveText('Pressed 3 times (double: 6)') // the new version is wired, once
})

test('editing a page reloads it', async ({ page }) => {
  await page.goto(`${base}/learn/first-island`)
  await page.waitForFunction(() => document.querySelector('[data-cl-ready]')) // the dev client is connected by then
  const reloaded = page.waitForEvent('framenavigated')
  writeFileSync(lesson, originals.get(lesson)!.replace('Create a counter:', 'Make a counter:'))
  await reloaded
  await expect(page.getByText('Make a counter:')).toBeAttached() // in a lesson step, maybe not on screen
})
