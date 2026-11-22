// #346: the AI coding guide's commands are the ones @clarusjs/ai has.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'

test('every `npx @clarusjs/ai <command>` in the guide is a command of the CLI', () => {
  const guide = readFileSync(resolve(import.meta.dirname, '../src/pages/guide/ai-coding.md'), 'utf8')
  const commands = new Set([...guide.matchAll(/@clarusjs\/ai (\w+)/g)].map((m) => m[1]!))
  expect([...commands].sort()).toEqual(['agents', 'mcp', 'skill'])
  const usage = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', resolve(import.meta.dirname, '../../ai/src/cli.ts')], { encoding: 'utf8' }).stderr
  for (const c of commands) expect(usage, c).toContain(`clarusjs-ai ${c}`)
})
