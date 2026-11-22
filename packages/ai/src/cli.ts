#!/usr/bin/env node
// clarusjs-ai: AI coding tools for clarusjs. `clarusjs-ai mcp` serves the MCP server over stdio.
import { resolve } from 'node:path'
import { writeAgents } from './agents.ts'
import { serveStdio } from './mcp.ts'

const [command, dir = '.'] = process.argv.slice(2)
if (command === 'mcp') serveStdio({ cwd: process.cwd() })
else if (command === 'agents') {
  const done = writeAgents(resolve(dir))
  console.log(`AGENTS.md: clarusjs section ${done}.`)
  // Claude Code reads CLAUDE.md: one line there brings AGENTS.md in.
  console.log('Claude Code reads CLAUDE.md: add a line with @AGENTS.md to it if it does not import AGENTS.md yet.')
} else {
  console.error([
    'Usage:',
    '  clarusjs-ai mcp            an MCP server for agents (check, explain, compile, docs_search), over stdio',
    "  clarusjs-ai agents [dir]   write or update the clarusjs section of the project's AGENTS.md",
  ].join('\n'))
  process.exitCode = command ? 1 : 0
}
