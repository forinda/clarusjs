---
title: "Lint"
group: "Tooling"
order: 4
description: "Template rules clarusjs check reports as warnings: unused inputs and imports, images without alt, labels and buttons without names. Turn rules off, ignore one place, write your own, or run them in ESLint with your script rules."
---

# Lint

`clarusjs check` also lints templates, with rules only clarusjs understands. Findings are warnings at their place, next to [type errors](/guide/type-checking), and editors show them as you type.

```
src/components/card.tscl:4:3 warning img-alt: <img> without alt: describe the image, or use alt="" when it is decoration

1 warning
```

## Rules

| Rule | Reports |
|---|---|
| `unused-input` | an `@input` or `@model` the template and script never read |
| `unused-import` | a component never used as a tag, or imported data never read |
| `img-alt` | an `<img>` without `alt` (use `alt=""` for decoration) |
| `label-field` | a `<label>` with no field inside it and no `for="…"` |
| `accessible-name` | a `<button>` or link with no text, `aria-label`, `aria-labelledby` or `title` |
| `one-root` {since=0.16.0} | a component without one root element (files under a `pages` or `layouts` folder, and whole documents, are exempt; a layout kept elsewhere is warned about): wrap its top level in an element, or in [`<fragment>`](/guide/components#several-elements-without-a-wrapper-fragment) |
| `multi-word-name` {since=0.17.0} | a component imported under a one-word name (`card`): two words or more (`userCard`, `UserCard`) give it a [kebab-case tag](/guide/components#automatic-imports) (`<user-card>`) and can't be mistaken for an HTML element, today's or a future one |
| `for-shadow` {since=0.17.0} | an `@for` row named like something the component declares (a script name, an `@input` or `@model`, an import): inside the loop the row hides it, so `[class]="item"` reads the row |
| `server-env-in-browser` {since=0.17.0} | `process.env`, or an `import.meta.env` variable without the `VITE_` prefix, read in a `<script>` or `<script inline>`, which run in the browser: there `process.env` doesn't exist and Vite sends only `VITE_` variables (or those with your `envPrefix`). Comments and strings that mention them don't count. **An error by default.** See [Environment variables](/guide/environment-variables) |

A component or `<slot>` inside a label, button or link counts as content: lint can't see what it renders, so it gives it the benefit of the doubt. A `@for` without `track` and a two-way binding on an element it doesn't fit are reported by the compiler itself.

## Warnings and errors

Warnings don't change the exit code, so adding clarusjs to a project's CI doesn't fail it. `--strict` fails on warnings too:

```sh
clarusjs check --strict
```

Set each rule's level in the plugin's options: `'warn'` (the default), `'error'`, or `'off'`.

```ts [vite.config.ts]
clarusjs({
  lint: { 'img-alt': 'error', 'unused-input': 'off' },
})
```

## Ignoring one place

A `{{-- clarusjs-ignore --}}` comment skips its own line and the next one: for the rules it names, or for all of them.

```tscl
{{-- clarusjs-ignore img-alt --}}
<img src="/spacer.gif" />
```

## Fixes {since=0.16.0}

Some findings come with a fix. `clarusjs check --fix` writes them to your `.tscl` files, then checks as usual; ESLint's `--fix` applies the same ones, and editors offer each as a quick fix.

```sh
npx clarusjs check --fix
```

| Rule | Fix |
|---|---|
| `one-root` | wraps the component's top level in `<fragment>`: the same HTML, and the warning goes. Replace it with an element when you want what a parent passes to land on one. A `<script>`, `<style>` or declaration (`@input`, `@import`…) between the roots moves above them first, in order |

A fix doesn't re-indent (that would change the text of a `<pre>` inside); run the [formatter](/guide/formatting) afterwards. From code, `applyFixes(source, lint(source, file))` from `clarusjs/compiler` returns the fixed source.

## Writing a rule

A rule is an object with a `name` and a `check` function. `check` gets the file's syntax tree and calls `report(offset, message)` for each finding. Levels, `--strict` and ignore comments work for it as they do for the built-in rules. This site has one: it keeps styles in each component's `<style>` block, where they are scoped and minified.

```ts [src/lint/no-inline-style.ts]
import type { LintRuleDef } from 'clarusjs/compiler'

export const noInlineStyle: LintRuleDef = {
  name: 'no-inline-style',
  check({ elements, report }) {
    for (const el of elements) {
      const style = el.attrs.find((a) => a.name === 'style' && (a.kind === 'static' || a.kind === 'interp'))
      if (style) report(style.start, `style="…" on <${el.tag}>: put it in the component's <style> block`)
    }
  },
}
```

```ts [vite.config.ts]
import { noInlineStyle } from './src/lint/no-inline-style.ts'

clarusjs({ lintRules: [noInlineStyle] })
```

What `check` gets:

| Field | What |
|---|---|
| `elements` | every element, in `@if` branches, `@for` rows and slot fills too, in source order; each has `tag`, `attrs` (with `name`, `kind` and `start`), `children` and `start` |
| `parsed` | the whole file as [`parse`](/reference/compiler#parse) returns it: inputs, imports, script, styles, template |
| `components` | the names of the components the file imports, which are also their tags |
| `reads(name)` | whether the template, the script or an input's type or default reads `name` |
| `report(start, message, fix?)` | a finding at `start`, an offset in the file: an element's, an attribute's or an `@input`'s `start`. `fix`, `{ start, end, text }`, replaces that part of the file with `text` under `--fix` |
| `file`, `source` | the file's path and text |

Test a rule with `lint(source, file, levels, rules)` from `clarusjs/compiler`, which returns the findings with their line and column. A rule that throws is reported as an error at the top of the file, so a bug in it doesn't stop the other rules.

## With ESLint

`@clarusjs/eslint-plugin` runs ESLint on `.tscl` files: your rules on each `<script>`, and the template rules above as `clarusjs/template`. Errors land on the line and column you wrote, and `--fix` edits the `.tscl` file.

<pm [commands]="['add -D eslint @clarusjs/eslint-plugin']" />

```js [eslint.config.js]
import clarusjs from '@clarusjs/eslint-plugin'

export default [
  ...clarusjs.configs.recommended,
  {
    files: ['**/*.tscl'],
    rules: { 'prefer-const': 'error', 'no-unused-vars': 'error' },
    // Optional: template rule levels, and your own rules.
    settings: { clarusjs: { lintRules: [noInlineStyle] } }, // see Writing a rule
  },
]
```

The plugin knows how clarusjs scripts work:

- **Names a script doesn't import**: the file's `@input`s, the data it `@import`s, and `state`, `derived` and `shared` are defined, so `no-undef` doesn't report them. Browser globals such as `window` are yours to add, as in any ESLint config (`languageOptions.globals`).
- **Names the template uses**: a function called only from `(click)`, or a value shown only in `{{ }}`, counts as used for `no-unused-vars`.
- **Signals the template writes**: `let open = state(false)` is written by the template (`(click)="open = !open"`, or a binding such as `[(value)]="form.name"`), so `prefer-const` doesn't ask for `const`. The same goes for `shared(store)`.

`clarusjs/template` takes the levels as its option: `'clarusjs/template': ['error', { 'img-alt': 'off' }]`. The rule's own severity applies to every finding, and each message ends with the clarusjs rule's name. The `{{-- clarusjs-ignore --}}` comment works as it does in `clarusjs check`. This site lints itself this way.

### TypeScript rules

A script's syntax is JavaScript; its types come from your inputs and from inference. To use another parser, such as typescript-eslint's, pass it as `parserOptions.parser`:

```js [eslint.config.js]
import tseslint from 'typescript-eslint'

export default [
  ...clarusjs.configs.recommended,
  { files: ['**/*.tscl'], languageOptions: { parserOptions: { parser: tseslint.parser } } },
]
```

typescript-eslint itself needs TypeScript 6 or older: see the setup below.

### Type-aware rules

Rules that need types, such as `no-floating-promises`, `no-unsafe-*` and `restrict-plus-operands`, work with `typeAware: true`. A script's types come from the component's inputs, the data it imports and its signals, as in `clarusjs check`:

```js [eslint.config.js]
export default [
  ...tseslint.configs.recommendedTypeCheckedOnly.map((c) => ({ ...c, files: ['**/*.tscl'] })),
  // After typescript-eslint's presets, which set their own parser: .tscl files keep this plugin's.
  ...clarusjs.configs.recommended,
  {
    files: ['**/*.tscl'],
    languageOptions: { parserOptions: { parser: tseslint.parser, typeAware: true } },
  },
]
```

typescript-eslint doesn't run on TypeScript 7 yet. Type-aware linting needs TypeScript 6 installed as `typescript`, with TypeScript 7 kept for `tsc` under another name:

<pm [commands]="['add -D typescript@npm:@typescript/typescript6 @typescript/native@npm:typescript@^7']" />

Without TypeScript 6, every `.tscl` file reports an error that says so; the other rules don't need it, so leave `typeAware` off until you install it. The compiler options come from the project's `tsconfig.json` (or `jsconfig.json`). Once typescript-eslint runs on TypeScript 7.1, the plugin will use 7.1's own support for `.tscl` files instead, and TypeScript 6 won't be needed.

## In editors

The [editor extension](/guide/editor) shows the built-in rules' findings as warnings. It doesn't read the Vite config yet, so a project's own rules and levels apply in `clarusjs check` (and in ESLint, with the plugin) only. ESLint's own editor extension shows the plugin's findings, with your levels and rules.
