// Output paths: agents and skill write where the project wants them, not only the defaults.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { guidance } from '../src/agents.ts'
import { skill } from '../src/skill.ts'

const cli = resolve(import.meta.dirname, '../src/cli.ts')
const run = (args: string[], cwd: string) => spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', cli, ...args], { cwd, encoding: 'utf8' })
const dir = () => mkdtempSync(resolve(tmpdir(), 'clarus-out-'))

test('agents --out: the section goes into another file (CLAUDE.md, a nested path), created with its folders', () => {
  const root = dir()
  expect(run(['agents', '--out', 'CLAUDE.md'], root).status).toBe(0)
  expect(readFileSync(resolve(root, 'CLAUDE.md'), 'utf8')).toContain(guidance())
  expect(existsSync(resolve(root, 'AGENTS.md'))).toBe(false)
  expect(run(['agents', '--out', 'docs/ai/agents.md'], root).status).toBe(0)
  expect(readFileSync(resolve(root, 'docs/ai/agents.md'), 'utf8')).toContain(guidance())
})

test('agents [dir] still writes dir/AGENTS.md; --out is relative to where the command runs', () => {
  const root = dir()
  expect(run(['agents', 'app'], root).status).toBe(1) // no such folder: an error, not a stray file
  const r = run(['agents', '.'], root)
  expect(r.status).toBe(0)
  expect(readFileSync(resolve(root, 'AGENTS.md'), 'utf8')).toContain(guidance())
})

test('skill --out: a folder gets SKILL.md, a path ending in .md or .mdc is the file itself', () => {
  const root = dir()
  expect(run(['skill', '--out', '.agents/skills/clarusjs'], root).status).toBe(0)
  expect(readFileSync(resolve(root, '.agents/skills/clarusjs/SKILL.md'), 'utf8')).toBe(skill())
  expect(run(['skill', '--out', '.cursor/rules/clarusjs.mdc'], root).status).toBe(0)
  expect(readFileSync(resolve(root, '.cursor/rules/clarusjs.mdc'), 'utf8')).toBe(skill())
  expect(existsSync(resolve(root, '.claude'))).toBe(false)
})

test('--out - prints instead of writing', () => {
  const root = dir()
  const agents = run(['agents', '--out', '-'], root)
  expect(agents.stdout).toContain(guidance())
  const s = run(['skill', '--out', '-'], root)
  expect(s.stdout).toBe(skill())
  expect(existsSync(resolve(root, 'AGENTS.md'))).toBe(false)
})

test('--out without a value, or an unknown option, is an error that says so', () => {
  const missing = run(['agents', '--out'], dir())
  expect(missing.status).toBe(1)
  expect(missing.stderr).toContain("option '--out <file>' argument missing")
  const unknown = run(['skill', '--nope'], dir())
  expect(unknown.status).toBe(1)
  expect(unknown.stderr).toContain("unknown option '--nope'")
})

test('--help lists the commands and their options', () => {
  const help = run(['--help'], dir()).stdout
  for (const c of ['mcp', 'agents', 'skill']) expect(help).toContain(c)
  expect(run(['skill', '--help'], dir()).stdout).toContain('--out <path>')
})
