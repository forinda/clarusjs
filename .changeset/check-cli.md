---
"clarusjs": minor
---

`clarusjs check [--json] [dir]`: type-checks every `.tscl` file under `src/` (and the TypeScript they use) with the project's TypeScript and reports each error at `file.tscl:line:col`, including template syntax errors. Extends the project's `tsconfig.json`; exits with 1 when there are errors. The command line is built on `commander` (zero dependencies, Node only, never in browser bundles).
