---
'clarusjs': minor
---

A TypeScript 7.1 content mapper for `.tscl` files: add `"contentMappers": [{ "package": "clarusjs", "extensions": [".tscl"] }]` to `tsconfig.json`, and TypeScript (in VS Code, or `tsc --runExternalCode`) checks templates as you type, with errors, hover and completion in the template. It runs as `clarusjs mapper`. Template type checking (here and in `clarusjs check`) also types the untyped parameters of a script's own functions as `any`, so strict projects don't flag them.
