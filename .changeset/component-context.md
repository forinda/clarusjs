---
"clarusjs": minor
---

Context (#465): a component's script calls `provide('key', value)`, and components rendered inside it, in its template or in content passed to it at any depth, read it with `@context key: Type` (with an optional default). It's passed with each render as the `cx` render option, so it works in async renders and in an island's browser re-renders. Content for a slot is now compiled as a function of the context where it's placed. `clarusjs check`, Prettier, the language server and the VS Code grammar know `@context`.
