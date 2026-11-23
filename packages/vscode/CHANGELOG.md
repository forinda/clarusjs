# clarusjs for VS Code

## 0.3.1

- Fix: the language server stopped right after starting ("n.makeRe is not a function"), so 0.3.0 had no errors, hovers or completion in `.tscl` files.

## 0.3.0

- **Icons.** `<icon name="set:name" />` works in the editor: names complete from the Iconify sets the project installed, with a preview of each icon; hover shows the icon; an unknown name or a missing set is an error at its place. Before, every `<icon>` was reported as "icons are resolved at build time".
- **Hover on a component's props** (`[title]`, `[(open)]`, `(rate)`) shows the input or model as the component declares it, with its type and default, or the event it sends. With TypeScript 7.1's content mapper set up, script variables and bindings get TypeScript's own hover too.
- **Template lint**, as you type: an `<img>` without `alt`, a `<label>` naming no field, an unused input or import.
- **Format Document** formats `.tscl` files with your project's Prettier and `@clarusjs/prettier-plugin`, as the Prettier CLI does.
- **`@await`, `@then` and `@catch`** are highlighted as control keywords, with TypeScript in their parentheses, and completed as directives; **`<script server>`** is highlighted as TypeScript.
- Renames, references and folders: fixes for renames across several files, closed files, folders added later, and `<script>` / `<style>` bodies.
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
