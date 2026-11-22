// #305: the site's .tscl components pass ESLint with its own config (eslint.config.js): core rules on each <script>,
// the template rules of clarusjs check, and this site's no-inline-style rule.
import { resolve } from 'node:path'
import { ESLint } from 'eslint'
import { expect, test } from 'vitest'

test('every .tscl file passes ESLint', async () => {
  const eslint = new ESLint({ cwd: resolve(import.meta.dirname, '..') })
  const results = await eslint.lintFiles(['src/**/*.tscl'])
  expect(results.length).toBeGreaterThanOrEqual(40) // every component and page, not none
  expect(results.flatMap((r) => r.messages.map((m) => `${r.filePath}:${m.line}:${m.column} ${m.ruleId}: ${m.message}`))).toEqual([])
}, 60_000)

test('a mistake in a component is caught: in its script, and in its template', async () => {
  const eslint = new ESLint({ cwd: resolve(import.meta.dirname, '..') })
  const [r] = await eslint.lintText('<script>\n  var n = state(0)\n</script>\n<p style="color: red">{{ n }}</p>\n', { filePath: resolve(import.meta.dirname, '../src/components/x.tscl') })
  expect(r!.messages.map((m) => `${m.line}:${m.column} ${m.ruleId}`)).toEqual(['2:3 no-var', '4:4 clarusjs/template'])
})
