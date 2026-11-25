---
"clarusjs": minor
"@clarusjs/eslint-plugin": minor
"@clarusjs/language-server": minor
---

Lint fixes. A finding may carry a `fix` (`{ start, end, text }`); `one-root`'s wraps the component's top level in `<fragment>`, which renders the same HTML (a root `<fragment>` now drops whitespace between its children, as the top level does). `clarusjs check --fix` writes fixes to the `.tscl` files before checking, `applyFixes(source, messages)` from `clarusjs/compiler` applies them in code, ESLint's `--fix` applies them through `clarusjs/template`, and the language server offers each as a quick fix. A project's own rules can pass a fix as `report(start, message, fix)`.
