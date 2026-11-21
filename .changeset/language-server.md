---
'@clarusjs/language-server': minor
---

The clarusjs language server, `clarusjs-ls` (`--stdio`, or `--node-ipc`): `.tscl` templates in any editor. This first version reports the compiler's template errors as you type (syntax errors are left to the TypeScript 7.1 content mapper when a project runs it), and gives HTML, CSS and Emmet in templates through Volar's services. In a trusted workspace (`initializationOptions: { trusted: true }`) it uses the project's own `clarusjs` when that has `compile` and `parse`; otherwise the compiler bundled with it. The package has no dependencies: everything is bundled.
