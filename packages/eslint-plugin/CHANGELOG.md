# @clarusjs/eslint-plugin

## 0.2.0

### Minor Changes

- [#512](https://github.com/forinda/clarusjs/pull/512) [`3b770b3`](https://github.com/forinda/clarusjs/commit/3b770b3a142b5067ab8aa04d028aff6e750ce894) Thanks [@forinda](https://github.com/forinda)! - Lint fixes. A finding may carry a `fix` (`{ start, end, text }`); `one-root`'s wraps the component's top level in `<fragment>`, which renders the same HTML (a root `<fragment>` now renders like its children written at the top level: whitespace-only text between them is dropped, and so is the line break right after `<fragment>`). A `<script>`, `<style>` or declaration (`@input`, any `@import`, `@event`…) between the roots moves above them first, in order: wrapped, it would no longer be the component's, and at the top level its place doesn't matter. `clarusjs check --fix` writes fixes to the `.tscl` files before checking (with `--json`, the files it rewrote are listed on stderr), `applyFixes(source, messages)` from `clarusjs/compiler` applies them in code, ESLint's `--fix` applies them through `clarusjs/template`, and the language server offers each as a quick fix. A project's own rules can pass a fix as `report(start, message, fix)`.

### Patch Changes

- Updated dependencies [[`0086d3b`](https://github.com/forinda/clarusjs/commit/0086d3bdfa34c966d143f4f008226f8547ad6023), [`e32325f`](https://github.com/forinda/clarusjs/commit/e32325fcc70f6fad75e184e60abc7aa2ad105b16), [`98d3f38`](https://github.com/forinda/clarusjs/commit/98d3f38b2e1e098b1b98ba8ae6681610a599a1b3), [`2cb2c58`](https://github.com/forinda/clarusjs/commit/2cb2c5812318916cd72a5da13668f684418f83fa), [`3b770b3`](https://github.com/forinda/clarusjs/commit/3b770b3a142b5067ab8aa04d028aff6e750ce894), [`2181938`](https://github.com/forinda/clarusjs/commit/21819387c6ea835e43e9c97258228c0aa92c773a), [`6641e73`](https://github.com/forinda/clarusjs/commit/6641e7352eff45c97d419cc8c8a676669f95506c)]:
  - clarusjs@0.16.0

## 0.1.1

### Patch Changes

- [#438](https://github.com/forinda/clarusjs/pull/438) [`e78455e`](https://github.com/forinda/clarusjs/commit/e78455e2518ff3a9cfacb7b02aeb814764c00ef0) Thanks [@forinda](https://github.com/forinda)! - `@await`, `@then` and `@catch` blocks ([#430](https://github.com/forinda/clarusjs/issues/430)): the Prettier plugin lays them out like `@if` / `@else` (headers kept as written), the language server hides them from the HTML service and completes the keywords, and the ESLint plugin reads their expressions.
- Updated dependencies [[`e78455e`](https://github.com/forinda/clarusjs/commit/e78455e2518ff3a9cfacb7b02aeb814764c00ef0), [`a0ee549`](https://github.com/forinda/clarusjs/commit/a0ee549af5a36b7b4ace50ab42627acd102d7259), [`39e91e8`](https://github.com/forinda/clarusjs/commit/39e91e85b3c7a20be06f8575083f1e000ac22318), [`e22f57a`](https://github.com/forinda/clarusjs/commit/e22f57a12aa241c1d5f8033d35a437cc64d4e3e0), [`8215ea7`](https://github.com/forinda/clarusjs/commit/8215ea7cdbe851e8dbaf845601fbad5becdee2d0), [`f194846`](https://github.com/forinda/clarusjs/commit/f1948466a96d486f3067171c51290bb0297be839)]:
  - clarusjs@0.14.0

## 0.1.0

### Minor Changes

- [#340](https://github.com/forinda/clarusjs/pull/340) [`7d940ee`](https://github.com/forinda/clarusjs/commit/7d940ee5a4306d55ce859b627f5a2a1700f04ead) Thanks [@forinda](https://github.com/forinda)! - First release: ESLint for `.tscl` components. A parser that keeps every offset (errors at the right line and column, fixes applied to the file), with the component's inputs, imported data and `state`/`derived`/`shared` as globals; `clarusjs/uses-vars` (names the template reads are used); `clarusjs/template` (the template rules of `clarusjs check`, with a project's own from `settings.clarusjs.lintRules`); and `configs.recommended`. `parserOptions.parser` takes another parser, such as typescript-eslint's.

- [#343](https://github.com/forinda/clarusjs/pull/343) [`6df5d54`](https://github.com/forinda/clarusjs/commit/6df5d54b802649fb49928ada483bc80afb6f6527) Thanks [@forinda](https://github.com/forinda)! - Type-aware rules on `.tscl` scripts: with `parserOptions: { parser: tseslint.parser, typeAware: true }`, typescript-eslint's rules that read types (`no-floating-promises`, `no-unsafe-*`…) work, with types from the component's inputs, imported data and signals, at the right line and column. typescript-eslint runs on TypeScript 6 for now: without it, each file reports an error that says what to install.

### Patch Changes

- Updated dependencies [[`d1aa9d1`](https://github.com/forinda/clarusjs/commit/d1aa9d1b8314d9c8541bcc2f4139e2e5f81077f1), [`ece99b7`](https://github.com/forinda/clarusjs/commit/ece99b712d31942c13001003779bd337081bd094), [`3ed3004`](https://github.com/forinda/clarusjs/commit/3ed3004422470311b0f88bd1dbf3d2f477e990bd), [`061d0f7`](https://github.com/forinda/clarusjs/commit/061d0f79a60a7349ae1eb3785fcbf02fd93191e0), [`5d4d1ce`](https://github.com/forinda/clarusjs/commit/5d4d1ce3987f5a6742bae3c92e88f73397c5de0c), [`d4af927`](https://github.com/forinda/clarusjs/commit/d4af927b6a27a69339941aa480a471b55c273038), [`16c619f`](https://github.com/forinda/clarusjs/commit/16c619fa42a7336c7a247fb125edbbb031445268), [`79315ea`](https://github.com/forinda/clarusjs/commit/79315ead6668ca60da0a280ae15abdd8f2e4082d), [`aa69dae`](https://github.com/forinda/clarusjs/commit/aa69dae9a04403747a334a3c4b8f87985842a4f7), [`29b7974`](https://github.com/forinda/clarusjs/commit/29b79748a27b0aa14aa26469481bc27ee0e993e7)]:
  - clarusjs@0.11.0
