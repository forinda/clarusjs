// #345: the clarusjs skill (SKILL.md, the Agent Skills format) and `clarusjs-ai skill`, which installs it.
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { compile, lint } from 'clarusjs/compiler'
import { expect, test } from 'vitest'
import { guidance } from '../src/agents.ts'
import { installSkill, skill } from '../src/skill.ts'

test('SKILL.md: frontmatter with a name and a description that says when to use it, then the guidance and the mistakes', () => {
  const text = skill()
  const front = /^---\nname: (.+)\ndescription: (.+)\n---\n/.exec(text)
  expect(front?.[1]).toBe('clarusjs')
  expect(front?.[2]).toMatch(/\.tscl/)
  expect(front![2]!.length).toBeLessThanOrEqual(1024)
  expect(text).toContain(guidance())
  expect(text).toContain('### Common mistakes')
})

test("each mistake is what it says: the wrong example fails to compile, the right one compiles and passes lint", () => {
  const blocks = [...skill().matchAll(/```tscl (wrong|right)\n([\s\S]*?)```/g)].map((m) => ({ kind: m[1]!, source: m[2]! }))
  expect(blocks.filter((b) => b.kind === 'wrong').length).toBe(4)
  expect(blocks.filter((b) => b.kind === 'right').length).toBe(4)
  const file = 'src/components/example.tscl'
  for (const { kind, source } of blocks) {
    if (kind === 'wrong') expect(() => compile(source, { file, target: 'client' }), source).toThrow(/example\.tscl:\d+:\d+/)
    else {
      expect(() => compile(source, { file, target: 'client' }), source).not.toThrow()
      expect(lint(source, file), source).toEqual([])
    }
  }
})

test('clarusjs-ai skill installs it as a Claude Code project skill (.claude/skills/clarusjs/SKILL.md)', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'clarus-skill-'))
  expect(installSkill(root)).toBe(resolve(root, '.claude/skills/clarusjs/SKILL.md'))
  expect(readFileSync(resolve(root, '.claude/skills/clarusjs/SKILL.md'), 'utf8')).toBe(skill())
})
