# Contributing to clarusjs

Thanks for helping. clarusjs is a young project, so the most useful contributions right now are bug reports with a
small reproduction, fixes with tests, and feedback on the design in [docs/architecture.md](docs/architecture.md).

## Before you start

- **Bugs:** open an issue with the `.tscl` file (or page) that shows the problem, what you expected, and what happened.
- **Features and design changes:** open an issue first. Some things are fixed on purpose (the HTML markers, the rule
  that server code never reaches the client), and it's better to talk before you write code.
- **Security problems:** don't open an issue; follow [SECURITY.md](SECURITY.md).

## Setup

You need Node `^22.18.0`, `^24` or `>=26` (versions that run TypeScript files directly, as `pnpm format:tscl` does), and [pnpm](https://pnpm.io). The repo is a pnpm workspace; don't use npm or
yarn.

```sh
pnpm install
pnpm test        # unit tests and an end-to-end test against a real Vite dev server
pnpm typecheck
pnpm dev         # serves examples/counter at http://localhost:5173
```

| Path | What |
|---|---|
| `packages/clarusjs/src/compiler` | parser, checks, IR, server and client emitters |
| `packages/clarusjs/src/runtime` | signals, attach helpers, island loader, server escaping |
| `packages/clarusjs/src/vite` | the Vite plugin |
| `packages/clarusjs/test` | tests, mirroring `src` |
| `examples/counter` | the example app |

[AGENTS.md](AGENTS.md) has the full layout and the rules the code follows. They apply to people as much as to AI tools.

## Making a change

1. Branch from `main`.
2. **Write the test first.** Add a failing test that shows the bug or the new behavior, watch it fail, then make it
   pass. Bug fixes always start with a test that reproduces the bug.
3. Keep the compiler pure (strings in, strings out), escape everything dynamic, and keep compiled output readable.
   If you change what the compiler emits, update the fixtures on purpose: `test/compiler/fixtures/<case>/` holds
   `input.tscl` and the expected `server.js`, `client.js` and `check.txt`.
   `UPDATE=1 pnpm --filter clarusjs exec vitest run test/compiler/fixtures.test.ts` rewrites them; review the diff.
4. Run `pnpm test` and `pnpm typecheck`. Both must pass.
   For the docs site, `pnpm docs:test` builds it and runs its browser tests. A failing browser test keeps a trace in
   `packages/docs/test-results/` (CI uploads that folder as the `playwright-report` artifact); replay it with
   `pnpm --filter @clarusjs/docs exec playwright show-trace <path to trace.zip>`.
5. **Add a changeset** if the change affects the published `clarusjs` package:
   ```sh
   pnpm changeset
   ```
   Pick the bump (patch for fixes, minor for features while we're on `0.x`) and write one or two sentences for the
   changelog. Commit the generated file in `.changeset/`. Dependabot PRs that bump a runtime dependency of
   `clarusjs` (like `acorn`) need one too; dev-dependency bumps don't. Releases are automated from `main`; see
   [RELEASE.md](RELEASE.md).
6. Commit with [Conventional Commits](https://www.conventionalcommits.org): `feat:`, `fix:`, `docs:`, `test:`,
   `build:`, `chore:`.
7. Open a pull request that says what changed, why, and how you tested it.

## Pull request checklist

- [ ] Tests added or updated, and `pnpm test` passes
- [ ] `pnpm typecheck` passes
- [ ] Changeset added (if the published package changed)
- [ ] Docs updated if behavior or the HTML contract changed (`docs/architecture.md`, README)

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
