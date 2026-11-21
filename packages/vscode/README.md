# clarusjs for VS Code

Support for [clarusjs](https://clarusjs.com) `.tscl` templates.

- **Syntax highlighting:** HTML, with TypeScript in `{{ }}` holes, `[prop]`, `(event)` and `[(model)]` bindings, `@if`/`@for` blocks, `@input`/`@model`/`@type`/`@interface` lines and `<script>`; CSS in `<style>`; `{{-- comments --}}`.
- **Snippets:** new pages (`page`, `page-layout`, `page-data`), components (`component`, `island`, `field`), template pieces (`@if`, `@for`, `@slot`, `{{`, `[()]`, …), and `.load.ts` files (`clarus-load`, `clarus-entries`).
- **Editing:** comment toggling (`{{-- --}}`), bracket matching and auto-closing, Emmet.
- **File icon** for `.tscl`.

Type errors in templates come from `clarusjs check` today, and in the editor through a TypeScript 7.1 content mapper (coming).

Setup and details: [Editor setup](https://clarusjs.com/guide/editor).
