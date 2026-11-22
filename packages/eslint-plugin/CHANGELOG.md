# @clarusjs/eslint-plugin

## 0.1.0

### Minor Changes

- [#340](https://github.com/forinda/clarusjs/pull/340) [`7d940ee`](https://github.com/forinda/clarusjs/commit/7d940ee5a4306d55ce859b627f5a2a1700f04ead) Thanks [@forinda](https://github.com/forinda)! - First release: ESLint for `.tscl` components. A parser that keeps every offset (errors at the right line and column, fixes applied to the file), with the component's inputs, imported data and `state`/`derived`/`shared` as globals; `clarusjs/uses-vars` (names the template reads are used); `clarusjs/template` (the template rules of `clarusjs check`, with a project's own from `settings.clarusjs.lintRules`); and `configs.recommended`. `parserOptions.parser` takes another parser, such as typescript-eslint's.

- [#343](https://github.com/forinda/clarusjs/pull/343) [`6df5d54`](https://github.com/forinda/clarusjs/commit/6df5d54b802649fb49928ada483bc80afb6f6527) Thanks [@forinda](https://github.com/forinda)! - Type-aware rules on `.tscl` scripts: with `parserOptions: { parser: tseslint.parser, typeAware: true }`, typescript-eslint's rules that read types (`no-floating-promises`, `no-unsafe-*`…) work, with types from the component's inputs, imported data and signals, at the right line and column. typescript-eslint runs on TypeScript 6 for now: without it, each file reports an error that says what to install.

### Patch Changes

- Updated dependencies [[`d1aa9d1`](https://github.com/forinda/clarusjs/commit/d1aa9d1b8314d9c8541bcc2f4139e2e5f81077f1), [`ece99b7`](https://github.com/forinda/clarusjs/commit/ece99b712d31942c13001003779bd337081bd094), [`3ed3004`](https://github.com/forinda/clarusjs/commit/3ed3004422470311b0f88bd1dbf3d2f477e990bd), [`061d0f7`](https://github.com/forinda/clarusjs/commit/061d0f79a60a7349ae1eb3785fcbf02fd93191e0), [`5d4d1ce`](https://github.com/forinda/clarusjs/commit/5d4d1ce3987f5a6742bae3c92e88f73397c5de0c), [`d4af927`](https://github.com/forinda/clarusjs/commit/d4af927b6a27a69339941aa480a471b55c273038), [`16c619f`](https://github.com/forinda/clarusjs/commit/16c619fa42a7336c7a247fb125edbbb031445268), [`79315ea`](https://github.com/forinda/clarusjs/commit/79315ead6668ca60da0a280ae15abdd8f2e4082d), [`aa69dae`](https://github.com/forinda/clarusjs/commit/aa69dae9a04403747a334a3c4b8f87985842a4f7), [`29b7974`](https://github.com/forinda/clarusjs/commit/29b79748a27b0aa14aa26469481bc27ee0e993e7)]:
  - clarusjs@0.11.0
