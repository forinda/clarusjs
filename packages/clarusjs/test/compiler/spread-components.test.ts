// #406: [...]="props" on a component tag passes every key as a prop; props written on the tag win; clarusjs check
// types it against the child's inputs.
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { expect, test } from 'vitest'
import { check } from '../../src/cli/check.ts'
import { compile } from '../../src/compiler/index.ts'
import { importCode } from '../helpers.ts'

const CARD = "@input title: string\n@input tone: string = 'plain'\n<p>{{ title }} ({{ tone }})</p>\n"
const server = (src: string, file: string) => compile(src, { file, target: 'server', clientUrl: '/x.js' }).code

test('every key of the spread is a prop; a prop written on the tag wins, wherever the spread sits', async () => {
  const page = "@import card from './card.tscl'\n@input p: { title: string; tone?: string }\n<card [...]=\"p\" /><card [tone]=\"'loud'\" [...]=\"p\" />\n"
  const { render } = await importCode(server(page, 'page.tscl'), 'sprc', { './card.tscl': server(CARD, 'card.tscl') })
  expect(render({ p: { title: 'Hi', tone: 'soft' } })).toBe('<p>Hi (soft)</p><p>Hi (loud)</p>')
})

function project(files: Record<string, string>): string {
  const root = mkdtempSync(resolve(tmpdir(), 'clarus-sprc-'))
  for (const [p, t] of Object.entries(files)) { mkdirSync(dirname(resolve(root, p)), { recursive: true }); writeFileSync(resolve(root, p), t) }
  mkdirSync(resolve(root, 'node_modules'), { recursive: true })
  symlinkSync(resolve(import.meta.dirname, '../..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  return root
}
const typescript = resolve(import.meta.dirname, '../../node_modules/typescript')

test('clarusjs check: the spread must provide the required inputs the tag doesn\'t write, with the right types', () => {
  const ok = project({ 'src/components/card.tscl': CARD, 'src/pages/index.tscl': "@import card from '../components/card.tscl'\n@input p: { title: string }\n<card [...]=\"p\" />\n" })
  expect(check({ root: ok, typescript }).diagnostics.filter((d) => d.severity === 'error')).toEqual([])
  const missing = project({ 'src/components/card.tscl': CARD, 'src/pages/index.tscl': "@import card from '../components/card.tscl'\n@input p: { tone: string }\n<card [...]=\"p\" />\n" })
  expect(check({ root: missing, typescript }).diagnostics.map((d) => `${d.line}:${d.column} ${d.message}`).join('\n')).toMatch(/3:1 .*'title'/)
  const wrong = project({ 'src/components/card.tscl': CARD, 'src/pages/index.tscl': "@import card from '../components/card.tscl'\n@input p: { title: number }\n<card [...]=\"p\" />\n" })
  expect(check({ root: wrong, typescript }).diagnostics.some((d) => d.severity === 'error' && /number/.test(d.message))).toBe(true)
})
