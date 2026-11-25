---
"clarusjs": minor
"@clarusjs/eslint-plugin": minor
"@clarusjs/language-server": minor
---

Lint fixes. A finding may carry a `fix` (`{ start, end, text }`); `one-root`'s wraps the component's top level in `<fragment>`, which renders the same HTML (a root `<fragment>` now renders like its children written at the top level: whitespace-only text between them is dropped, and so is the line break after `<fragment>`). A `<script>` or `<style>` between the roots means no fix: wrapped, it would no longer be the component's. `clarusjs check --fix` writes fixes to the `.tscl` files before checking (with `--json`, the files it rewrote are listed on stderr), `applyFixes(source, messages)` from `clarusjs/compiler` applies them in code, ESLint's `--fix` applies them through `clarusjs/template`, and the language server offers each as a quick fix. A project's own rules can pass a fix as `report(start, message, fix)`.
