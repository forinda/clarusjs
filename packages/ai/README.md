# @clarusjs/ai

AI coding tools for [clarusjs](https://github.com/forinda/clarusjs). An MCP server agents use to check their own work:

```sh
npx @clarusjs/ai mcp
```

Tools: `check` (type errors and lint, with the project's clarusjs), `explain` (where a built route's parts run), `compile` (one component, without a project) and `docs_search` (clarusjs.com). No dependencies besides clarusjs (a peer).

```sh
claude mcp add clarusjs -- npx -y @clarusjs/ai mcp
```

`npx @clarusjs/ai agents` writes the clarusjs section of your `AGENTS.md` (between markers; run it again to update), and `npx @clarusjs/ai skill` installs the clarusjs skill for Claude Code (`.claude/skills/clarusjs/SKILL.md`).

See the [AI coding guide](https://clarusjs.com/guide/ai-coding). MIT licensed.
