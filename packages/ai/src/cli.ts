#!/usr/bin/env node
// clarusjs-ai: AI coding tools for clarusjs. `clarusjs-ai mcp` serves the MCP server over stdio.
import { serveStdio } from './mcp.ts'

const [command] = process.argv.slice(2)
if (command === 'mcp') serveStdio({ cwd: process.cwd() })
else {
  console.error('Usage: clarusjs-ai mcp    an MCP server for agents (check, explain, compile, docs_search), over stdio')
  process.exitCode = command ? 1 : 0
}
