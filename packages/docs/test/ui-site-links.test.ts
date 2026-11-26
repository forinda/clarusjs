// clarusjs.com points to ui.clarusjs.com, where the styled components are: the header, the UI primitives guide,
// and each headless part's page links to its styled version, which must exist there.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'

const pages = resolve(import.meta.dirname, '../src/pages')
const uiPages = resolve(import.meta.dirname, '../../ui-site/src/pages/components')
// A part whose styled version has another name there.
const STYLED: Record<string, string> = { radio: 'radio-group' }

test('each component page links to its styled version on ui.clarusjs.com, which exists', () => {
  for (const file of readdirSync(resolve(pages, 'components')).filter((f) => f.endsWith('.md'))) {
    const name = file.replace(/\.md$/, '')
    const styled = STYLED[name] ?? name
    const text = readFileSync(resolve(pages, 'components', file), 'utf8')
    expect(text, file).toContain(`(https://ui.clarusjs.com/components/${styled})`)
    expect(existsSync(resolve(uiPages, `${styled}.md`)), `ui-site has ${styled}.md`).toBe(true)
  }
})

test('the header and the UI primitives guide point to ui.clarusjs.com', () => {
  expect(readFileSync(resolve(import.meta.dirname, '../src/nav.ts'), 'utf8')).toMatch(/label: 'UI', href: 'https:\/\/ui\.clarusjs\.com'/)
  expect(readFileSync(resolve(pages, 'guide/ui-primitives.md'), 'utf8')).toContain('(https://ui.clarusjs.com)')
})
