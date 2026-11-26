// #344: `clarusjs-ai agents` writes the clarusjs section of a project's AGENTS.md, and keeps the rest of the file.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { compile, lint } from 'clarusjs/compiler'
import { expect, test } from 'vitest'
import { writeAgents, guidance, START, END } from '../src/agents.ts'

const dir = () => mkdtempSync(resolve(tmpdir(), 'clarus-agents-'))

test('a new AGENTS.md: the clarusjs section between markers', () => {
  const root = dir()
  expect(writeAgents(root)).toBe('created')
  const text = readFileSync(resolve(root, 'AGENTS.md'), 'utf8')
  expect(text.startsWith(`${START}\n## clarusjs\n`)).toBe(true)
  expect(text.trimEnd().endsWith(END)).toBe(true)
})

test("an existing AGENTS.md keeps its own content: the section is added once, then updated in place", () => {
  const root = dir()
  writeFileSync(resolve(root, 'AGENTS.md'), '# My app\n\nOur rules.\n')
  expect(writeAgents(root)).toBe('added')
  const once = readFileSync(resolve(root, 'AGENTS.md'), 'utf8')
  expect(once.startsWith('# My app\n\nOur rules.\n\n' + START)).toBe(true)
  writeFileSync(resolve(root, 'AGENTS.md'), once.replace('## clarusjs', '## clarusjs (old)') + '\nMore of ours.\n')
  expect(writeAgents(root)).toBe('updated')
  const twice = readFileSync(resolve(root, 'AGENTS.md'), 'utf8')
  expect(twice).toBe(once + '\nMore of ours.\n')
  expect(writeAgents(root)).toBe('unchanged')
})

test('every tscl example in the guidance compiles and passes lint (it can not drift from the compiler)', () => {
  const blocks = [...guidance().matchAll(/```tscl\n([\s\S]*?)```/g)].map((m) => m[1]!)
  expect(blocks.length).toBeGreaterThan(0)
  for (const source of blocks) {
    const file = 'src/components/example.tscl'
    expect(() => compile(source, { file, target: 'client' })).not.toThrow()
    expect(lint(source, file)).toEqual([])
  }
})

test('the guidance names the features agents miss without it: enter animations, view transitions, URL state, kebab-case tags', () => {
  const text = guidance()
  for (const s of ['@starting-style', 'viewTransitions()', 'setSearch(', 'searchParams', "{ scroll: false }", 'navigationState()', '`<user-card>`'])
    expect(text, s).toContain(s)
})
