# @clarusjs/language-server

## 0.3.0

### Minor Changes

- [#337](https://github.com/forinda/clarusjs/pull/337) [`aa69dae`](https://github.com/forinda/clarusjs/commit/aa69dae9a04403747a334a3c4b8f87985842a4f7) Thanks [@forinda](https://github.com/forinda)! - Template lint in `clarusjs check`: `unused-input`, `unused-import`, `img-alt`, `label-field` and `accessible-name`, reported as warnings at `file:line:col` (the exit code changes only with `--strict`, or a rule set to `'error'`). Set levels with the plugin's `lint` option, skip one place with `{{-- clarusjs-ignore rule --}}`, and add your own rules with `lintRules` (`lint()`, `lintRules` and `LintRuleDef` are exported from `clarusjs/compiler`). Every diagnostic now has a `severity`, also in `--json`. The language server shows the built-in rules' findings as warnings.

## 0.2.0

### Minor Changes

- [#306](https://github.com/forinda/clarusjs/pull/306) [`13dc4d5`](https://github.com/forinda/clarusjs/commit/13dc4d5678e1153c0cd397d13ffa58b9e7ae9db0) Thanks [@forinda](https://github.com/forinda)! - Format Document formats `.tscl` files with the project's Prettier and `@clarusjs/prettier-plugin` (trusted workspaces, both installed). Also fixes the server exiting at startup when an editor opens workspace folders without supporting folder-change notifications.

## 0.1.0

### Minor Changes

- [#273](https://github.com/forinda/clarusjs/pull/273) [`6c86ee9`](https://github.com/forinda/clarusjs/commit/6c86ee9b9a77f16cc8516031349f632151a79e94) Thanks [@forinda](https://github.com/forinda)! - Components in templates: completion of the file's imported components as tags, and of their inputs (`[title]`), models (`[(open)]`) and events (`(rate)`) as bindings; hover on a component tag (where it comes from, its inputs with whole types, multi-line ones too, its models and events); go to definition from a tag or its `@import` specifier. Also directives (`@if`, `@import`…), `@import` paths, and the binding forms of HTML attributes (`[disabled]`, `(click)`, `[(value)]` on fields, `[value]` on `textarea` and `select`) through the HTML service.

- [#275](https://github.com/forinda/clarusjs/pull/275) [`2904110`](https://github.com/forinda/clarusjs/commit/29041104d87e5a755b76d94377b2cfce0e7f6214) Thanks [@forinda](https://github.com/forinda)! - References and renames for components: Find All References lists a component's tags in every file that imports it (whatever name each gives it); renaming a tag or its import name renames it in that file; renaming or moving a `.tscl` file rewrites every `@import` that points to it (relative specifiers recomputed, `~/` kept as `~/`, Markdown pages included) and the moved file's own relative imports.

- [#274](https://github.com/forinda/clarusjs/pull/274) [`0a4810b`](https://github.com/forinda/clarusjs/commit/0a4810b731a1959f02c96b2c5a3bdcd21c7dba36) Thanks [@forinda](https://github.com/forinda)! - Semantic tokens for the template syntax: directives and block keywords, `{{-- comments --}}`, `{{ }}` delimiters, binding punctuation and names (`[title]`, `(click)`, `[(open)]`), and component tags, so editors without the TextMate grammar (Neovim, Helix, Zed) colour templates.

- [#272](https://github.com/forinda/clarusjs/pull/272) [`b1c6702`](https://github.com/forinda/clarusjs/commit/b1c67022be463fad81202e9cd7bd1b302197ed24) Thanks [@forinda](https://github.com/forinda)! - The clarusjs language server, `clarusjs-ls` (`--stdio`, or `--node-ipc`): `.tscl` templates in any editor. This first version reports the compiler's template errors as you type (syntax errors are left to the TypeScript 7.1 content mapper when a project runs it), and gives HTML, CSS and Emmet in templates through Volar's services. In a trusted workspace (`initializationOptions: { trusted: true }`) it uses the project's own `clarusjs` when that has `compile` and `parse`; otherwise the compiler bundled with it. The package has no dependencies: everything is bundled.

### Patch Changes

- [#271](https://github.com/forinda/clarusjs/pull/271) [`b608db7`](https://github.com/forinda/clarusjs/commit/b608db72c6314c0f97a491b3545efc5bedb5ae75) Thanks [@forinda](https://github.com/forinda)! - Fixes from review:
  - Completion no longer hangs on a lone `<`.
  - Tags are found as the compiler reads them: never inside script/style bodies, comments, attribute values or Markdown code samples. Renames and references touch only real tags.
  - A `<` inside a quoted value isn't a tag, and single-quoted values count as values.
  - `@import` lines in `{{-- --}}` comments are ignored.
  - Import aliases resolve with the build's own rules: the most specific alias first, `baseUrl`, and `jsconfig.json`. A changed config re-resolves imports already indexed, and an unreadable file no longer stops indexing.
  - Tokens follow quotes and jump over script and style bodies. Holes with nested braces and multi-line generic `@input` types are read whole.
  - Completing in the middle of a tag name replaces the whole name, and import path completions use `/` on Windows.
  - Moving files updates importers in every workspace folder, and the batch handler is the only one. A changed file that is open in the editor keeps its unsaved text in the index.

- [#278](https://github.com/forinda/clarusjs/pull/278) [`fe998c7`](https://github.com/forinda/clarusjs/commit/fe998c7499bd7cb570248c13bc9ed9de6bb2bf85) Thanks [@forinda](https://github.com/forinda)! - Fixes from review:
  - Moving several `.tscl` files at once updates their imports in one edit set, from their final places (no overlapping edits; two moved files that import each other stay linked).
  - A file closed without saving goes back to its text on disk, so later renames and references aren't built from discarded edits.
  - The deepest workspace folder holding a file is its project; folders added later are indexed; indexing no longer holds up the editor's start.
  - No template completions or colours inside `<script>` and `<style>`; `@import` lines in Markdown code fences are examples, not imports.
  - Block keywords are read as the compiler reads them (an email's `@if.com` isn't a block; `@else`/`@empty` only follow a block), and a `}` inside an element is text.
  - A `>` inside a binding value no longer stops attribute completion; `/`-rooted specifiers stay `/`-rooted on a move, and a `~/` one leaving `src` becomes relative.
  - Faster: unchanged text isn't parsed again, tsconfig lookups are cached, positions are computed once per text.
  - The package no longer declares an `exports` entry: it's the `clarusjs-ls` command.

- [#280](https://github.com/forinda/clarusjs/pull/280) [`bcbda7d`](https://github.com/forinda/clarusjs/commit/bcbda7da92db7c10d823949d5f4fc8c2d2049cad) Thanks [@forinda](https://github.com/forinda)! - The language server shows compiler warnings (such as a plain `<style>`, now global) as warnings at their place. The theme's callout uses `<style scoped>`.
