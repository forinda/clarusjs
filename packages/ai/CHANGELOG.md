# @clarusjs/ai

## 0.1.3

### Patch Changes

- [#510](https://github.com/forinda/clarusjs/pull/510) [`2181938`](https://github.com/forinda/clarusjs/commit/21819387c6ea835e43e9c97258228c0aa92c773a) Thanks [@forinda](https://github.com/forinda)! - One root per component, `<fragment>`, and `@extends`.

  - `<fragment>` groups elements without rendering one, anywhere in a template (a component's root, an `@if` branch, a `@for` row, slot content). It takes no attributes, and a component whose root is one takes none from its parent: `clarusjs check` reports any `class`, attribute or `(event)` written on its tag.
  - The `one-root` lint rule warns about a component without one root element (files under a `pages` or `layouts` folder, and whole documents, are exempt; a layout kept elsewhere is warned about), so what a parent passes always has one place to land. It becomes an error in a later minor.
  - `@extends button` (or `input`, `textarea`, `select`, `option`, `a`, `img`, `form`, `label`, `details`, `dialog`): the component takes every attribute of that element, typed by `clarusjs check`, onto its root, which must be that element.
  - A stateful `@extends` island kept in place when its parent re-renders takes the new passed attributes (a parent's `[disabled]` changing reaches its root).
  - theme-docs: the page head and the contents part render a `<fragment>` (same HTML). The agent guidance teaches one root.

- Updated dependencies [[`0086d3b`](https://github.com/forinda/clarusjs/commit/0086d3bdfa34c966d143f4f008226f8547ad6023), [`e32325f`](https://github.com/forinda/clarusjs/commit/e32325fcc70f6fad75e184e60abc7aa2ad105b16), [`98d3f38`](https://github.com/forinda/clarusjs/commit/98d3f38b2e1e098b1b98ba8ae6681610a599a1b3), [`2cb2c58`](https://github.com/forinda/clarusjs/commit/2cb2c5812318916cd72a5da13668f684418f83fa), [`3b770b3`](https://github.com/forinda/clarusjs/commit/3b770b3a142b5067ab8aa04d028aff6e750ce894), [`2181938`](https://github.com/forinda/clarusjs/commit/21819387c6ea835e43e9c97258228c0aa92c773a), [`6641e73`](https://github.com/forinda/clarusjs/commit/6641e7352eff45c97d419cc8c8a676669f95506c)]:
  - clarusjs@0.16.0

## 0.1.2

### Patch Changes

- [#387](https://github.com/forinda/clarusjs/pull/387) [`77853de`](https://github.com/forinda/clarusjs/commit/77853decd380c972d094bdb871f90f4479029548) Thanks [@forinda](https://github.com/forinda)! - Built-in icons: `<icon name="lucide:rocket" />` renders an inline SVG at build time from any Iconify set the project installs (`pnpm add -D @iconify-json/lucide`), with no JavaScript. It's 1em high with its width in proportion, takes the text colour, and is `aria-hidden` unless labelled. The name must be static; a missing set or icon is an error at `file:line:col` with the closest names, in the build, `clarusjs check` and the editor. The editor completes sets and icon names and previews an icon on hover; the MCP `compile` tool resolves icons too. New `clarusjs/icons` (Node only) reads the sets; `CompileOptions.icon` passes them to the compiler.
- Updated dependencies [[`01f21e4`](https://github.com/forinda/clarusjs/commit/01f21e454db0bdf81d405c8ff580a6847e6b51b0), [`77853de`](https://github.com/forinda/clarusjs/commit/77853decd380c972d094bdb871f90f4479029548), [`6cc6ec9`](https://github.com/forinda/clarusjs/commit/6cc6ec95031e6f963ceba74af85f5cb90aad6ba2), [`e5650c7`](https://github.com/forinda/clarusjs/commit/e5650c787206ce8a13cf26613f02a47659c94c19), [`3a302a4`](https://github.com/forinda/clarusjs/commit/3a302a419ef8b341866c661e9b04dad94f7b541f), [`e87ad85`](https://github.com/forinda/clarusjs/commit/e87ad8538c44ec5327097fb33cfd4702066fad30), [`b1d211f`](https://github.com/forinda/clarusjs/commit/b1d211f2192d3e379d834bf442ca932fcba16547), [`4d93a7b`](https://github.com/forinda/clarusjs/commit/4d93a7bfb58663d8f01f9c3b0c9767740827fb5d), [`96d7ea1`](https://github.com/forinda/clarusjs/commit/96d7ea13dbe40ec8ee395374cb84d6beba68d396), [`e8734bf`](https://github.com/forinda/clarusjs/commit/e8734bf2f3e2b512b45949522500ace2ccdc7bfb), [`dff8f40`](https://github.com/forinda/clarusjs/commit/dff8f40dcd4f0b2cbf8cafd6dbe990462eb77212), [`c5dd711`](https://github.com/forinda/clarusjs/commit/c5dd711258cab06354c990cda5b7c87d728ca1c7), [`6fd8398`](https://github.com/forinda/clarusjs/commit/6fd839848dbbeb34db573f2f8ae25c1d5f29757c), [`2bc1db9`](https://github.com/forinda/clarusjs/commit/2bc1db9f298d9e07e77d8a44d8dd32f3c90f4d85)]:
  - clarusjs@0.13.0

## 0.1.1

### Patch Changes

- [#358](https://github.com/forinda/clarusjs/pull/358) [`7daaabe`](https://github.com/forinda/clarusjs/commit/7daaabe2d7eac69e57fe2744b94bd2c36a7945cd) Thanks [@forinda](https://github.com/forinda)! - The skill's "changing state in place" mistake covers event handlers too, and says the compiler now warns about it.
- Updated dependencies [[`dd107bb`](https://github.com/forinda/clarusjs/commit/dd107bbdedc950fbcf9b120a9bb5569bf9f348cf), [`7daaabe`](https://github.com/forinda/clarusjs/commit/7daaabe2d7eac69e57fe2744b94bd2c36a7945cd), [`5d58103`](https://github.com/forinda/clarusjs/commit/5d5810381b0455a534d434a4a67b72e96bbc70b4)]:
  - clarusjs@0.12.0

## 0.1.0

### Minor Changes

- [#348](https://github.com/forinda/clarusjs/pull/348) [`e66e897`](https://github.com/forinda/clarusjs/commit/e66e89742be81eb2f8431a278f85ad20c612f42e) Thanks [@forinda](https://github.com/forinda)! - `npx @clarusjs/ai agents` writes the clarusjs section of a project's `AGENTS.md`: where things go, component syntax, islands and state, and the `clarusjs check` loop. It goes between markers, so the rest of the file stays the project's and running it again updates only that part.

- [#347](https://github.com/forinda/clarusjs/pull/347) [`fbf310d`](https://github.com/forinda/clarusjs/commit/fbf310d0e857e91c719314cd6f59daec7eabe868) Thanks [@forinda](https://github.com/forinda)! - First release: `npx @clarusjs/ai mcp`, an MCP server for agents writing clarusjs. Tools: `check` (type errors and lint from the project's own `clarusjs check`), `explain` (where a built route's parts run), `compile` (one component: island or not, its output, warnings and lint) and `docs_search` (the clarusjs.com docs, cached for a day).

- [#354](https://github.com/forinda/clarusjs/pull/354) [`6d03ab0`](https://github.com/forinda/clarusjs/commit/6d03ab0f1261aae82329b02cbbedceabb6b757ea) Thanks [@forinda](https://github.com/forinda)! - `--out` for `agents` and `skill`: write the AGENTS.md section into another file (`--out CLAUDE.md`), and the skill to another folder or file (`--out .agents/skills/clarusjs`, `--out .cursor/rules/clarusjs.mdc`). `--out -` prints instead of writing. The command line now runs on commander: `--help` for each command, and clear errors for unknown options and a missing folder.

- [#351](https://github.com/forinda/clarusjs/pull/351) [`6460cda`](https://github.com/forinda/clarusjs/commit/6460cdac87779f854d48ad8fbc83a5f9c51a2d6b) Thanks [@forinda](https://github.com/forinda)! - The clarusjs skill (Agent Skills format): the conventions an agent needs plus the common mistakes, each example checked by a test. `npx @clarusjs/ai skill` installs it for Claude Code at `.claude/skills/clarusjs/SKILL.md`; it is also published at https://clarusjs.com/skills/clarusjs/SKILL.md.

### Patch Changes

- Updated dependencies [[`d1aa9d1`](https://github.com/forinda/clarusjs/commit/d1aa9d1b8314d9c8541bcc2f4139e2e5f81077f1), [`ece99b7`](https://github.com/forinda/clarusjs/commit/ece99b712d31942c13001003779bd337081bd094), [`3ed3004`](https://github.com/forinda/clarusjs/commit/3ed3004422470311b0f88bd1dbf3d2f477e990bd), [`061d0f7`](https://github.com/forinda/clarusjs/commit/061d0f79a60a7349ae1eb3785fcbf02fd93191e0), [`5d4d1ce`](https://github.com/forinda/clarusjs/commit/5d4d1ce3987f5a6742bae3c92e88f73397c5de0c), [`d4af927`](https://github.com/forinda/clarusjs/commit/d4af927b6a27a69339941aa480a471b55c273038), [`16c619f`](https://github.com/forinda/clarusjs/commit/16c619fa42a7336c7a247fb125edbbb031445268), [`79315ea`](https://github.com/forinda/clarusjs/commit/79315ead6668ca60da0a280ae15abdd8f2e4082d), [`aa69dae`](https://github.com/forinda/clarusjs/commit/aa69dae9a04403747a334a3c4b8f87985842a4f7), [`29b7974`](https://github.com/forinda/clarusjs/commit/29b79748a27b0aa14aa26469481bc27ee0e993e7)]:
  - clarusjs@0.11.0
