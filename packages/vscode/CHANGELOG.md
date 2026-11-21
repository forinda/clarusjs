# clarusjs for VS Code

## 0.1.0

The first release.

- `.tscl` templates are highlighted: HTML, with TypeScript in `{{ }}` holes, `[prop]`, `(event)` and `[(model)]` bindings, `@if`/`@for` blocks, `@input`/`@model`/`@type`/`@interface` and `<script>`; CSS in `<style>`; `{{-- comments --}}`. Component tags are tags, not unknown HTML.
- Hover and completion for the HTML: tags and attributes with their docs, and their binding forms (`[disabled]`, `(click)`, `[(value)]` on fields). The components a file imports complete as tags, and hover shows where each comes from, its inputs and the events it sends.
- Snippets for new pages (`page`, `page-layout`, `page-data`), components (`component`, `island`, `field`), template pieces (`@if`, `@for`, `@slot`, `{{`, `[()]`…) and `.load.ts` files.
- Toggle Block Comment writes `{{-- --}}`; brackets and quotes close themselves; Emmet works as in HTML. A file icon for `.tscl`.
- Type errors, hover and completion inside expressions come from TypeScript 7.1 with clarusjs's content mapper (a `contentMappers` line in `tsconfig.json`): see https://clarusjs.com/guide/editor.
