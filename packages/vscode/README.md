# clarusjs for VS Code

Support for [clarusjs](https://clarusjs.com) `.tscl` templates.

- **The clarusjs language server**, bundled: template errors as you type, HTML/CSS/Emmet, components (completion, hover, go to definition), references and renames (moving a `.tscl` file updates its `@import`s), semantic colouring.
- **Syntax highlighting:** HTML, with TypeScript in `{{ }}` holes, bindings, blocks and `<script>`; CSS in `<style>`; `{{-- comments --}}`.
- **Snippets:** new pages, components, template pieces and `.load.ts` files.
- **Editing:** comment toggling (`{{-- --}}`), bracket matching and auto-closing, Emmet. A file icon for `.tscl`.

Type errors, hover and completion inside expressions come from TypeScript 7.1 with clarusjs's content mapper (one `contentMappers` line in `tsconfig.json`).

Setup and details: [Editor setup](https://clarusjs.com/guide/editor).
