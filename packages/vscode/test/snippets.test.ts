// Every snippet, expanded with its default values, is valid: .tscl ones compile with the clarusjs compiler (template
// constructs inside an island), the .load.ts ones parse as TypeScript modules.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { compile } from 'clarusjs/compiler'
import { expect, test } from 'vitest'

type Snippet = { prefix: string | string[]; body: string[]; description: string; isFileTemplate?: boolean }
const read = (file: string) => JSON.parse(readFileSync(resolve(import.meta.dirname, '..', file), 'utf8')) as Record<string, Snippet>

/** A snippet as VS Code inserts it when every placeholder keeps its default. */
function expand(body: string[]): string {
  let text = body.join('\n').replace(/\$\{TM_FILENAME_BASE\}/g, 'example')
  // Placeholders nest (${3:${1:item}.id}): expand from the inside out.
  for (let previous = ''; previous !== text; ) {
    previous = text
    // A placeholder with no placeholder inside (a literal `{` is fine; `\}` and `\$` are escapes).
    text = text.replace(/\$\{\d+:((?:[^$}\\]|\\.)*)\}/g, (_, value: string) => value.replace(/\\([}$\\])/g, '$1'))
  }
  return text.replace(/\$\{\d+\}|\$\d+/g, '')
}

test('every .tscl snippet compiles: whole files on their own, template pieces inside an island', () => {
  const snippets = read('snippets/tscl.json')
  expect(Object.keys(snippets).length).toBeGreaterThan(15)
  for (const [name, snippet] of Object.entries(snippets)) {
    const text = expand(snippet.body)
    expect(snippet.description, name).toBeTruthy()
    // Pieces get what they need around them: the names they use, and an island to live in.
    const source = snippet.isFileTemplate
      ? text
      : name.startsWith('@input') || name.startsWith('@model') || name.startsWith('@type') || name.startsWith('@interface') || name.startsWith('@import')
        ? `${text}\n<p>x</p>\n`
        : `@import card from './card.tscl'\n<script>\n  let condition = state(true)\n  let items = state([{ id: 1 }])\n  let value = state(1)\n  let form = state({ name: '' })\n  function handler() {}\n</script>\n<card>${text}</card>\n<input ${name === 'binding' || name === 'event' || name === 'two-way binding' ? text : ''}>\n`
    for (const target of ['server', 'client'] as const) {
      expect(() => compile(source, { file: `${name}.tscl`, target, clientUrl: '/x.js' }), `${name}:\n${source}`).not.toThrow()
    }
  }
})

test('the .load.ts snippets are modules exporting load (and entries)', () => {
  const snippets = read('snippets/load.json')
  for (const [name, snippet] of Object.entries(snippets)) {
    const text = expand(snippet.body)
    expect(text, name).toMatch(/export async function load\(/)
    if (name.includes('entries')) expect(text).toMatch(/export function entries\(\)/)
    // Balanced and plain: no leftover placeholder syntax.
    expect(text, name).not.toMatch(/\$\{|\$\d/)
  }
})

test('review #233: a literal { in a placeholder default expands like VS Code does', () => {
  expect(expand(['@type ${1:Name} = ${0:{ \\}}'])).toBe('@type Name = { }')
  expect(expand(['${3:${1:item}.id}'])).toBe('item.id')
})
