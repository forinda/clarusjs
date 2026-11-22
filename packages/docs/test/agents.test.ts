// #344: this site's AGENTS.md carries the current clarusjs section (`npx @clarusjs/ai agents` updates it).
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { guidance, START, END } from '@clarusjs/ai/agents'
import { expect, test } from 'vitest'

test('AGENTS.md has the clarusjs section, up to date', () => {
  const text = readFileSync(resolve(import.meta.dirname, '../AGENTS.md'), 'utf8')
  expect(text).toContain(`${START}\n${guidance()}\n${END}`)
})

test("the section's links point at pages this site has", () => {
  for (const [, path] of guidance().matchAll(/https:\/\/clarusjs\.com(\/[\w/.-]+)/g)) {
    if (/\.\w+$/.test(path!)) continue // a file (llms-full.txt), written at build time
    const page = resolve(import.meta.dirname, `../src/pages${path}`)
    const exists = ['.md', '.tscl', '/index.tscl', '/index.md'].some((ext) => { try { readFileSync(page + ext); return true } catch { return false } })
    expect(exists, path).toBe(true)
  }
})
