---
'@clarusjs/eslint-plugin': minor
---

Type-aware rules on `.tscl` scripts: with `parserOptions: { parser: tseslint.parser, typeAware: true }`, typescript-eslint's rules that read types (`no-floating-promises`, `no-unsafe-*`…) work, with types from the component's inputs, imported data and signals, at the right line and column. typescript-eslint runs on TypeScript 6 for now: without it, each file reports an error that says what to install.
