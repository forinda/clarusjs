# @clarusjs/eslint-plugin

Lint [clarusjs](https://github.com/forinda/clarusjs) `.tscl` components with ESLint: your rules on each `<script>`, at the line and column you wrote (and `--fix` edits the `.tscl` file), plus the template rules of `clarusjs check` as `clarusjs/template`.

```sh
pnpm add -D eslint @clarusjs/eslint-plugin
```

```js
// eslint.config.js
import clarusjs from '@clarusjs/eslint-plugin'

export default [
  ...clarusjs.configs.recommended,
  { files: ['**/*.tscl'], rules: { 'prefer-const': 'error', 'no-unused-vars': 'error' } },
]
```

A component's inputs, imported data and `state`/`derived`/`shared` are known to `no-undef`; names the template uses count as used; `let x = state(…)` written by the template isn't pushed to `const`. Another parser (typescript-eslint's) goes in `parserOptions.parser`; with `typeAware: true`, type-aware rules work too, with types from the component's inputs, imported data and signals. typescript-eslint needs TypeScript 6 for now: `pnpm add -D typescript@npm:@typescript/typescript6 @typescript/native@npm:typescript@^7`. See the [Lint guide](https://clarusjs.com/guide/lint#with-eslint).

MIT licensed.
