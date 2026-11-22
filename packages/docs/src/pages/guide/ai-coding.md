---
title: "AI coding"
group: "Tooling"
order: 5
description: "Build clarusjs apps with AI agents: an MCP server that checks their work, compiles components and searches these docs."
---

# AI coding

Agents write better clarusjs when they can check what they wrote. `@clarusjs/ai` gives them an MCP server with the same checks you run, so an agent fixes its own type errors and lint findings before it says it's done.

## The MCP server

```sh
npx @clarusjs/ai mcp
```

It speaks the [Model Context Protocol](https://modelcontextprotocol.io) over stdio, from your project's folder, with these tools:

| Tool | What it does |
|---|---|
| `check` | [Type-checks](/guide/type-checking) and [lints](/guide/lint) the project, with your installed clarusjs: errors and warnings at `file:line:col` |
| `explain` | Where each part of a built route runs: rendering, data, islands and their JavaScript (after `vite build`) |
| `compile` | One component, without a project: whether it's an island, its server and client output, warnings and lint findings |
| `docs_search` | The sections of these docs that match a query, with their URLs |

The server tells the agent to run `check` after editing `.tscl` files. `docs_search` reads this site's `llms-full.txt` ([what it is](/guide/docs-theme#llmstxt)), fetched once a day and cached in `~/.cache/clarusjs`.

### Claude Code

```sh
claude mcp add clarusjs -- npx -y @clarusjs/ai mcp
```

Or commit it for everyone working on the project:

```json [.mcp.json]
{ "mcpServers": { "clarusjs": { "command": "npx", "args": ["-y", "@clarusjs/ai", "mcp"] } } }
```

### Cursor and VS Code

Cursor reads `.cursor/mcp.json`, with the same `mcpServers` entry. VS Code reads `.vscode/mcp.json`:

```json [.vscode/mcp.json]
{ "servers": { "clarusjs": { "type": "stdio", "command": "npx", "args": ["-y", "@clarusjs/ai", "mcp"] } } }
```

This repository has a `.mcp.json` too: agents working on clarusjs itself check the docs site with it.

## AGENTS.md

Coding agents (Codex, Cursor, Copilot, Claude Code and others) read a project's `AGENTS.md` for its conventions. Write clarusjs's into yours:

```sh
npx @clarusjs/ai agents
```

It covers where things go, a component's syntax, islands and state, and checking the work with `clarusjs check`. It goes between `<!-- clarusjs:start -->` and `<!-- clarusjs:end -->` markers, so the rest of the file stays yours, and running the command again after an upgrade updates only that part. Claude Code reads `CLAUDE.md`: add a line `@AGENTS.md` to it to bring the file in.

This site's own `AGENTS.md` is written this way, and a test fails when it falls behind.
