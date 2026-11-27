# @clarusjs/language-server

## 0.7.1

### Patch Changes

- [#615](https://github.com/forinda/clarusjs/pull/615) [`80d54da`](https://github.com/forinda/clarusjs/commit/80d54da684eea571c110e103da712b0813b0b38f) Thanks [@forinda](https://github.com/forinda)! - An @imported component answers to its name in kebab case: `@import uiButton` or `@import UiButton` is `<ui-button>` too (before, `<ui-button>` silently rendered as a plain element). Only hyphenated forms: a one-word import such as `Button` never takes `<button>`. The language server's hover, go to definition, references and rename follow, keeping each tag in the case it was written.

## 0.7.0

### Minor Changes

- [#513](https://github.com/forinda/clarusjs/pull/513) [`2cb2c58`](https://github.com/forinda/clarusjs/commit/2cb2c5812318916cd72a5da13668f684418f83fa) Thanks [@forinda](https://github.com/forinda)! - Components from libraries. List installed component libraries, `clarusjs({ components: { libraries: ['@clarusjs/ui-primitives'] } })` (or `{ from, prefix }` for your own prefix), and their components work by name without `@import`: `<ui-tabs>`, `<ui-tab-list>`. A library describes itself in its package.json, `"clarusjs": { "components": "./src", "prefix": "ui" }`, and each component is imported as `<package>/<file>`. An `@import` wins, then your own components, then libraries; a name two libraries share is an error naming both. The dev server, builds and `clarusjs check` write the names and the configured `components.dirs` to `.clarusjs/components.json`, which the language server and the TypeScript content mapper read. `@clarusjs/ui-primitives` describes itself with the `ui` prefix.

- [#512](https://github.com/forinda/clarusjs/pull/512) [`3b770b3`](https://github.com/forinda/clarusjs/commit/3b770b3a142b5067ab8aa04d028aff6e750ce894) Thanks [@forinda](https://github.com/forinda)! - Lint fixes. A finding may carry a `fix` (`{ start, end, text }`); `one-root`'s wraps the component's top level in `<fragment>`, which renders the same HTML (a root `<fragment>` now renders like its children written at the top level: whitespace-only text between them is dropped, and so is the line break right after `<fragment>`). A `<script>`, `<style>` or declaration (`@input`, any `@import`, `@event`…) between the roots moves above them first, in order: wrapped, it would no longer be the component's, and at the top level its place doesn't matter. `clarusjs check --fix` writes fixes to the `.tscl` files before checking (with `--json`, the files it rewrote are listed on stderr), `applyFixes(source, messages)` from `clarusjs/compiler` applies them in code, ESLint's `--fix` applies them through `clarusjs/template`, and the language server offers each as a quick fix. A project's own rules can pass a fix as `report(start, message, fix)`.

## 0.6.0

### Minor Changes

- [#470](https://github.com/forinda/clarusjs/pull/470) [`7e8c056`](https://github.com/forinda/clarusjs/commit/7e8c05654d6474e125b71b29ce4a6a19b9eb0f2a) Thanks [@forinda](https://github.com/forinda)! - Components used by name ([#458](https://github.com/forinda/clarusjs/issues/458)): completed as tags, with their inputs, hover and go to definition, without an `@import`.

- [#474](https://github.com/forinda/clarusjs/pull/474) [`c0d028f`](https://github.com/forinda/clarusjs/commit/c0d028fc70e8c11c4d98ce9f6b32c6ff2699d755) Thanks [@forinda](https://github.com/forinda)! - `@event` ([#442](https://github.com/forinda/clarusjs/issues/442)): the language server completes and hovers a component's events with their value types; Prettier keeps `@event` and `@layout none` lines as directives (an object type on them no longer breaks formatting).

- [#450](https://github.com/forinda/clarusjs/pull/450) [`12588c2`](https://github.com/forinda/clarusjs/commit/12588c21b2c4bc9f0a4d10a2d54ac2f74f8407cd) Thanks [@forinda](https://github.com/forinda)! - Hover on a component's attribute (`[title]`, `title="…"`, `[(open)]`, `(rate)`) shows the input or model as the component declares it, whole type and default, or the event it sends, without needing TypeScript.

## 0.5.0

### Minor Changes

- [#438](https://github.com/forinda/clarusjs/pull/438) [`e78455e`](https://github.com/forinda/clarusjs/commit/e78455e2518ff3a9cfacb7b02aeb814764c00ef0) Thanks [@forinda](https://github.com/forinda)! - `@await`, `@then` and `@catch` blocks ([#430](https://github.com/forinda/clarusjs/issues/430)): the Prettier plugin lays them out like `@if` / `@else` (headers kept as written), the language server hides them from the HTML service and completes the keywords, and the ESLint plugin reads their expressions.

## 0.4.0

### Minor Changes

- [#387](https://github.com/forinda/clarusjs/pull/387) [`77853de`](https://github.com/forinda/clarusjs/commit/77853decd380c972d094bdb871f90f4479029548) Thanks [@forinda](https://github.com/forinda)! - Built-in icons: `<icon name="lucide:rocket" />` renders an inline SVG at build time from any Iconify set the project installs (`pnpm add -D @iconify-json/lucide`), with no JavaScript. It's 1em high with its width in proportion, takes the text colour, and is `aria-hidden` unless labelled. The name must be static; a missing set or icon is an error at `file:line:col` with the closest names, in the build, `clarusjs check` and the editor. The editor completes sets and icon names and previews an icon on hover; the MCP `compile` tool resolves icons too. New `clarusjs/icons` (Node only) reads the sets; `CompileOptions.icon` passes them to the compiler.

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
