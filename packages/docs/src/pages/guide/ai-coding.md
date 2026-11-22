---
title: "AI coding"
group: "Tooling"
order: 5
description: "Build clarusjs apps with AI agents: an MCP server that checks their work, compiles components and searches these docs."
---

# AI coding

Agents write better clarusjs when they know its conventions and can check what they wrote. `@clarusjs/ai` gives them both: the conventions as an `AGENTS.md` section and a skill, and an MCP server with the same checks you run, so an agent fixes its own type errors and lint findings before it says it's done.

## Set up a project

```sh
npx @clarusjs/ai agents   # the clarusjs section of AGENTS.md
npx @clarusjs/ai skill    # the clarusjs skill, for Claude Code
claude mcp add clarusjs -- npx -y @clarusjs/ai mcp   # the MCP server (Cursor, VS Code: below)
```

| | What the agent gets | When it reads it |
|---|---|---|
| [AGENTS.md](#agentsmd) | where things go, the syntax, islands and state, the check loop | at the start of every session |
| [The skill](#the-skill) | the same, plus the common mistakes and how to fix them | when it works on `.tscl` files |
| [The MCP server](#the-mcp-server) | `check`, `compile`, `explain` and `docs_search` | whenever it wants to check its work |
| [llms.txt](#llmstxt) | these docs, as text | when you point it there |

## The loop

The tools add up to one habit: write, check, fix, until `check` is clean.

1. The agent writes or edits `.tscl` files, following `AGENTS.md` and the skill.
2. It runs `check` (the MCP tool, or `npx clarusjs check`): type errors in templates and scripts, and the [lint rules](/guide/lint), each at `file.tscl:line:col`.
3. It fixes what's reported, using `compile` to see what a component turns into and `docs_search` for syntax it isn't sure of, and checks again.

Make it part of "done" in your own instructions too: CI that runs `clarusjs check --strict` catches what an agent missed.

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

## The skill

A skill is a set of instructions an agent loads when its task calls for it. The clarusjs skill carries the same conventions as the `AGENTS.md` section, plus the common mistakes: what fails to compile and why, and what compiles but is still wrong, such as changing an array in place.

Install it as a Claude Code project skill:

```sh
npx @clarusjs/ai skill
```

That writes `.claude/skills/clarusjs/SKILL.md`. Other agents that read the [Agent Skills](https://agentskills.io) format take the same file, published at [/skills/clarusjs/SKILL.md](/skills/clarusjs/SKILL.md). Every example in it is compiled by a test: the wrong ones must fail, the right ones must pass.

## llms.txt

These docs are also plain text for tools: [llms.txt](/guide/docs-theme#llmstxt) lists every page, and `llms-full.txt` has all of them in one file. Point an agent without the MCP server at `https://clarusjs.com/llms-full.txt`, or add it to a tool's docs sources (Cursor's `@Docs`, for example).
