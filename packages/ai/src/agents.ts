// `clarusjs-ai agents` (#344): the clarusjs section of a project's AGENTS.md, which coding agents read for the
// project's conventions. Written between markers, so the rest of the file is the project's and running it again
// updates only this part.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export const START = '<!-- clarusjs:start (written by `npx @clarusjs/ai agents`; run it again to update) -->'
export const END = '<!-- clarusjs:end -->'

/** The guidance itself: templates/AGENTS.md, shipped with the package. */
export function guidance(): string {
  return readFileSync(new URL('../templates/AGENTS.md', import.meta.url), 'utf8').trim()
}

/** The section, with its markers. */
export const section = () => `${START}\n${guidance()}\n${END}`

/**
 * Write or update the section in `root`/AGENTS.md, or in `file` (another name or place, such as CLAUDE.md; its folders
 * are created).
 */
export function writeAgents(root: string, file = resolve(root, 'AGENTS.md')): 'created' | 'added' | 'updated' | 'unchanged' {
  const section_ = section()
  if (!existsSync(file)) {
    if (file !== resolve(root, 'AGENTS.md')) mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, section_ + '\n')
    return 'created'
  }
  const text = readFileSync(file, 'utf8')
  const start = text.indexOf(START.slice(0, START.indexOf(' (')))
  const end = text.indexOf(END)
  if (start === -1 || end < start) {
    writeFileSync(file, `${text.trimEnd()}\n\n${section_}\n`)
    return 'added'
  }
  const next = text.slice(0, start) + section_ + text.slice(end + END.length)
  if (next === text) return 'unchanged'
  writeFileSync(file, next)
  return 'updated'
}
