---
'@clarusjs/eslint-plugin': minor
---

First release: ESLint for `.tscl` components. A parser that keeps every offset (errors at the right line and column, fixes applied to the file), with the component's inputs, imported data and `state`/`derived`/`shared` as globals; `clarusjs/uses-vars` (names the template reads are used); `clarusjs/template` (the template rules of `clarusjs check`, with a project's own from `settings.clarusjs.lintRules`); and `configs.recommended`. `parserOptions.parser` takes another parser, such as typescript-eslint's.
