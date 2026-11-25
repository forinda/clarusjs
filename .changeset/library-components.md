---
"clarusjs": minor
"@clarusjs/ui-primitives": minor
"@clarusjs/language-server": minor
---

Components from libraries. List installed component libraries, `clarusjs({ components: { libraries: ['@clarusjs/ui-primitives'] } })` (or `{ from, prefix }` for your own prefix), and their components work by name without `@import`: `<ui-tabs>`, `<ui-tab-list>`. A library describes itself in its package.json, `"clarusjs": { "components": "./src", "prefix": "ui" }`, and each component is imported as `<package>/<file>`. An `@import` wins, then your own components, then libraries; a name two libraries share is an error naming both. The dev server, builds and `clarusjs check` write the names to `.clarusjs/components.json`, which the language server and the TypeScript content mapper read. `@clarusjs/ui-primitives` describes itself with the `ui` prefix.
