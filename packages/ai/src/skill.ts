// The clarusjs skill (#345): SKILL.md in the Agent Skills format, which agents load when they work on .tscl files.
// The same guidance as the AGENTS.md section, plus the common mistakes (templates/mistakes.md), each checked by a test.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { guidance } from './agents.ts'

const DESCRIPTION =
  'Write and check clarusjs components (.tscl files): template syntax, islands and state, pages and data loading, ' +
  'and the clarusjs check loop. Use when creating or editing .tscl files or a clarusjs app.'

/** SKILL.md's text. */
export function skill(): string {
  const mistakes = readFileSync(new URL('../templates/mistakes.md', import.meta.url), 'utf8').trim()
  return `---\nname: clarusjs\ndescription: ${DESCRIPTION}\n---\n\n${guidance()}\n\n${mistakes}\n`
}

/**
 * Install it as a Claude Code project skill in `root` (.claude/skills/clarusjs/SKILL.md), or at `out`: a path ending
 * in .md or .mdc is the file itself (a Cursor rule), anything else a folder for SKILL.md (.agents/skills/clarusjs).
 * Returns the file written.
 */
export function installSkill(root: string, out?: string): string {
  const file = out === undefined ? resolve(root, '.claude/skills/clarusjs/SKILL.md') : /\.mdc?$/.test(out) ? resolve(out) : resolve(out, 'SKILL.md')
  mkdirSync(resolve(file, '..'), { recursive: true })
  writeFileSync(file, skill())
  return file
}
