---
'clarusjs': patch
---

Path aliases. `~/` is `src/`, built in. Aliases from `tsconfig.json`/`jsconfig.json` `paths` and Vite's `resolve.alias` work in `@import` (components, data, stylesheets), island scripts and `.load.ts` files, resolved the same way in dev, build, prerender and `clarusjs check` (which no longer drops the project's `paths`). An import that no file, package or alias matches is an error at its `@import` (`file.tscl:line:col`).
