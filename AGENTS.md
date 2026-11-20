# AGENTS.md

Guidance for AI agents (and humans) working in this repo.

## What this is

clarusjs compiles `.clarus` components (Vue/Angular-style templates + an optional `<script>` with signals) into:

- a **server module**: `render(props) → string`, HTML with markers around reactive holes only;
- a **client module**, only for stateful components: `attach(root, props)`, which wires signals to the server's HTML without re-rendering it.

A Vite plugin picks the output per Vite environment and serves pages through a `fetch(Request) → Response` handler.
Design: [docs/architecture.md](docs/architecture.md). Current status: proof of concept (see §16–17 there).

## Commands

pnpm workspace (pnpm only; never npm or yarn).

```sh
pnpm install
pnpm test           # every package: unit tests + e2e against a real Vite dev server
pnpm typecheck      # tsc --noEmit in every package
pnpm dev            # serves examples/counter
pnpm changeset      # describe a change to a published package (commit the generated file)
```

Run both `pnpm test` and `pnpm typecheck` before calling work done. Any change to a published package needs a changeset.
Releases are automated from `main` (see RELEASE.md): never run `npm publish` or `changeset publish` yourself.
`pnpm build` compiles each package to `dist/`; the published `exports` come from `publishConfig.exports`.

## Layout

| Path | What |
|---|---|
| `packages/clarusjs/` | the published `clarusjs` package; paths below are inside it |
| `src/compiler/` | `parse.ts` (source → syntax tree) → `ir.ts` (checks + IR) → `emit-server.ts` / `emit-client.ts`. `script.ts` does signal analysis and rewrites. `index.ts` exports `compile()` |
| `src/runtime/` | `server.ts` (escape, island), `signals.ts`, `dom.ts` (holes/text/on), `loader.ts` (finds islands, calls attach) |
| `src/server/handler.ts` | `createHandler(pages)` → `{ fetch }` |
| `src/vite/` | `plugin.ts`, `node.ts` (Node http ⇄ fetch) |
| `examples/counter/` | the POC app (private workspace package, depends on `clarusjs: workspace:*`) |
| `.changeset/` | pending changesets and config |
| `test/` | mirrors `src/`; `test/fixtures/*.clarus`; `test/helpers.ts` (`importCode`) |
| `docs/` | architecture (committed); `docs/superpowers/` holds local specs and plans (gitignored, never commit) |
| `.scratch/` | local notes and research (gitignored, never commit) |

## Rules

- **Compiler is pure.** `src/compiler/` takes strings and returns strings: no `fs`, no Vite imports.
- **ESTree only.** Treat acorn output as plain ESTree so the parser can be swapped (e.g. `oxc-parser`).
- **Server code never reaches the client.** Client modules must not import `render`, `clarusjs/runtime/server` or loaders.
- **Stateless components ship nothing.** No `<script>` → client compile is `export {}`.
- **HTML contract is fixed** (changing it is a design change; update `docs/architecture.md` §5 first):
  `<cl-island c="NAME" src="URL" p="JSON">`, `<!--[N-->…<!--]-->`, `data-cl-e="N"`. Static parts carry no markers.
- **Escape everything dynamic.** Server holes go through `escape()`; island props through `island()`; the client writes text nodes only.
- **Generated names start with `__cl_`** so they never collide with author code.
- **Errors are located.** Compile errors are `ClarusError` with `file:line:col message`. Never let a raw acorn error escape.
- **Compiled output stays readable.** Exact-output tests in `test/compiler/emit-*.test.ts` pin it; update them deliberately.
- **Tests first.** Write the failing test, watch it fail, then implement. Bug fixes start with a reproducing test.
- **Keep it small.** No new runtime dependencies (only `acorn`, compiler-side). Deliberate shortcuts get a `ponytail:` comment naming the limit and the upgrade path.

## Commits and PRs

Conventional commits (`feat:`, `fix:`, `docs:`, `test:`…). No AI attribution footers or "generated with" lines in commits or PR descriptions.
