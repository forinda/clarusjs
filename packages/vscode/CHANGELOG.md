# clarusjs for VS Code

## Unreleased

- `@await`, `@then` and `@catch` are highlighted as control keywords, with TypeScript in their parentheses.
- The extension bundles minimatch 11 (GHSA-g3hv-75wg-m249, a pattern amplification in minimatch before 11.0.1).

## 0.2.0

The extension now runs the clarusjs language server (`@clarusjs/language-server`, bundled), the same one other editors use.

- **Template errors as you type**, from the clarusjs compiler, at their place. With TypeScript 7.1's content mapper set up, syntax errors come from it instead, so a mistake shows once.
- **Components:** completion of the file's imported components and of their inputs, models and events; hover shows where a component comes from and what it takes, with multi-line types whole; go to definition from a tag or its `@import`.
- **References and renames:** Find All References for a component; rename a component in a file; renaming or moving a `.tscl` file updates the `@import`s that point to it (Markdown pages too).
- **HTML, CSS and Emmet** in templates and `<style>`, with the binding forms of attributes (`[disabled]`, `(click)`, `[(value)]`).
- **Semantic colouring** of the template syntax.
- In a trusted workspace the server uses your project's own `clarusjs` compiler (when it's recent enough), so the editor agrees with your build.
- Needs VS Code 1.91 or later.

## 0.1.0

The first release.

- `.tscl` templates are highlighted: HTML, with TypeScript in `{{ }}` holes, `[prop]`, `(event)` and `[(model)]` bindings, `@if`/`@for` blocks, `@input`/`@model`/`@type`/`@interface` and `<script>`; CSS in `<style>`; `{{-- comments --}}`. Component tags are tags, not unknown HTML.
- Hover and completion for the HTML: tags and attributes with their docs, and their binding forms (`[disabled]`, `(click)`, `[(value)]` on fields). The components a file imports complete as tags, and hover shows where each comes from, its inputs and the events it sends.
- Snippets for new pages (`page`, `page-layout`, `page-data`), components (`component`, `island`, `field`), template pieces (`@if`, `@for`, `@slot`, `{{`, `[()]`…) and `.load.ts` files.
- Toggle Block Comment writes `{{-- --}}`; brackets and quotes close themselves; Emmet works as in HTML. A file icon for `.tscl`.
- Type errors, hover and completion inside expressions come from TypeScript 7.1 with clarusjs's content mapper (a `contentMappers` line in `tsconfig.json`): see https://clarusjs.com/guide/editor.
