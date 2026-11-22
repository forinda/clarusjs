# @clarusjs/ai

## 0.1.0

### Minor Changes

- [#348](https://github.com/forinda/clarusjs/pull/348) [`e66e897`](https://github.com/forinda/clarusjs/commit/e66e89742be81eb2f8431a278f85ad20c612f42e) Thanks [@forinda](https://github.com/forinda)! - `npx @clarusjs/ai agents` writes the clarusjs section of a project's `AGENTS.md`: where things go, component syntax, islands and state, and the `clarusjs check` loop. It goes between markers, so the rest of the file stays the project's and running it again updates only that part.

- [#347](https://github.com/forinda/clarusjs/pull/347) [`fbf310d`](https://github.com/forinda/clarusjs/commit/fbf310d0e857e91c719314cd6f59daec7eabe868) Thanks [@forinda](https://github.com/forinda)! - First release: `npx @clarusjs/ai mcp`, an MCP server for agents writing clarusjs. Tools: `check` (type errors and lint from the project's own `clarusjs check`), `explain` (where a built route's parts run), `compile` (one component: island or not, its output, warnings and lint) and `docs_search` (the clarusjs.com docs, cached for a day).

- [#354](https://github.com/forinda/clarusjs/pull/354) [`6d03ab0`](https://github.com/forinda/clarusjs/commit/6d03ab0f1261aae82329b02cbbedceabb6b757ea) Thanks [@forinda](https://github.com/forinda)! - `--out` for `agents` and `skill`: write the AGENTS.md section into another file (`--out CLAUDE.md`), and the skill to another folder or file (`--out .agents/skills/clarusjs`, `--out .cursor/rules/clarusjs.mdc`). `--out -` prints instead of writing. The command line now runs on commander: `--help` for each command, and clear errors for unknown options and a missing folder.

- [#351](https://github.com/forinda/clarusjs/pull/351) [`6460cda`](https://github.com/forinda/clarusjs/commit/6460cdac87779f854d48ad8fbc83a5f9c51a2d6b) Thanks [@forinda](https://github.com/forinda)! - The clarusjs skill (Agent Skills format): the conventions an agent needs plus the common mistakes, each example checked by a test. `npx @clarusjs/ai skill` installs it for Claude Code at `.claude/skills/clarusjs/SKILL.md`; it is also published at https://clarusjs.com/skills/clarusjs/SKILL.md.

### Patch Changes

- Updated dependencies [[`d1aa9d1`](https://github.com/forinda/clarusjs/commit/d1aa9d1b8314d9c8541bcc2f4139e2e5f81077f1), [`ece99b7`](https://github.com/forinda/clarusjs/commit/ece99b712d31942c13001003779bd337081bd094), [`3ed3004`](https://github.com/forinda/clarusjs/commit/3ed3004422470311b0f88bd1dbf3d2f477e990bd), [`061d0f7`](https://github.com/forinda/clarusjs/commit/061d0f79a60a7349ae1eb3785fcbf02fd93191e0), [`5d4d1ce`](https://github.com/forinda/clarusjs/commit/5d4d1ce3987f5a6742bae3c92e88f73397c5de0c), [`d4af927`](https://github.com/forinda/clarusjs/commit/d4af927b6a27a69339941aa480a471b55c273038), [`16c619f`](https://github.com/forinda/clarusjs/commit/16c619fa42a7336c7a247fb125edbbb031445268), [`79315ea`](https://github.com/forinda/clarusjs/commit/79315ead6668ca60da0a280ae15abdd8f2e4082d), [`aa69dae`](https://github.com/forinda/clarusjs/commit/aa69dae9a04403747a334a3c4b8f87985842a4f7), [`29b7974`](https://github.com/forinda/clarusjs/commit/29b79748a27b0aa14aa26469481bc27ee0e993e7)]:
  - clarusjs@0.11.0
