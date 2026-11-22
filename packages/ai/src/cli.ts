#!/usr/bin/env node
// clarusjs-ai: AI coding tools for clarusjs. `mcp` serves the MCP server over stdio; `agents` and `skill` write the
// conventions for agents, where the project wants them (--out).
import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { Command } from 'commander'
import { section, writeAgents } from './agents.ts'
import { serveStdio } from './mcp.ts'
import { installSkill, skill } from './skill.ts'

const program = new Command('clarusjs-ai').description('AI coding tools for clarusjs')

/** The project folder: it must exist (a typo is an error, not a stray file). */
function folder(dir: string): string {
  const root = resolve(dir)
  if (!existsSync(root) || !statSync(root).isDirectory()) program.error(`${dir} isn't a folder`)
  return root
}

program
  .command('mcp')
  .description('serve the MCP server for agents (check, explain, compile, docs_search) over stdio, from this folder')
  .action(() => serveStdio({ cwd: process.cwd() }))

program
  .command('agents')
  .description("write or update the clarusjs section of the project's AGENTS.md")
  .argument('[dir]', 'project folder', '.')
  .option('--out <file>', 'write into this file instead (CLAUDE.md, docs/agents.md…); - prints the section')
  .action((dir: string, options: { out?: string }) => {
    const root = folder(dir)
    if (options.out === '-') return void process.stdout.write(section() + '\n')
    const file = options.out === undefined ? undefined : resolve(options.out)
    console.log(`${file ?? 'AGENTS.md'}: clarusjs section ${writeAgents(root, file)}.`)
    // Claude Code reads CLAUDE.md: one line there brings AGENTS.md in.
    if (!file) console.log('Claude Code reads CLAUDE.md: add a line with @AGENTS.md to it if it does not import AGENTS.md yet.')
  })

program
  .command('skill')
  .description('install the clarusjs skill (default: dir/.claude/skills/clarusjs/SKILL.md)')
  .argument('[dir]', 'project folder', '.')
  .option('--out <path>', 'a folder for SKILL.md, or a .md/.mdc file (a Cursor rule); - prints the skill')
  .action((dir: string, options: { out?: string }) => {
    const root = folder(dir)
    if (options.out === '-') return void process.stdout.write(skill())
    console.log(`Installed the clarusjs skill: ${installSkill(root, options.out)}`)
  })

program.parse()
