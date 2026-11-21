---
title: "Editor setup"
group: "Tooling"
order: 2
description: "The clarusjs VS Code extension: highlighting, snippets and the .tscl file icon; type errors from clarusjs check."
---

# Editor setup

<p class="lead">The clarusjs extension for VS Code highlights <code>.tscl</code> templates, gives them a file icon, and adds snippets for pages, components and template pieces.</p>

## VS Code

Install **clarusjs** from the Extensions view. The extension is in this repository as `packages/vscode`; until its first Marketplace release, `pnpm --filter clarusjs-vscode package` builds a `.vsix`, which **Extensions: Install from VSIX…** installs.

What it gives `.tscl` files:

- **Highlighting.** HTML, with TypeScript wherever a template holds code: `{{ }}` holes, `[prop]`, `(event)` and `[(model)]` bindings, `@if`/`@for` conditions, `@input`/`@model` types, `@type`/`@interface` and `<script>`. CSS in `<style>`, and `{{-- comments --}}`.
- **Snippets.** Type the prefix and press Tab:

| Prefix | Inserts |
|---|---|
| `page`, `page-layout`, `page-data` | a new page: a whole document, one in a layout, one with inputs from its `.load.ts` |
| `component`, `island`, `field` | a new component: static, with a script and state, a form field with `@model` |
| `@if`, `@ife`, `@for`, `@fore`, `@slot` | a block (with `@else`, with `@empty`), a slot fill |
| `@input`, `@model`, `@type`, `@interface`, `@import` | a declaration |
| `{{`, `[]`, `()`, `[()]`, `{{--` | a hole, a binding, an event, a two-way binding, a comment |
| `clarus-load`, `clarus-entries` | a `.load.ts`: `load()`, or `entries()` and `load()` for a dynamic route |

- **Editing.** **Toggle Block Comment** writes `{{-- --}}`, brackets and quotes close themselves, and Emmet abbreviations work as in HTML.

## Type errors

`clarusjs check` type-checks templates and reports errors at `file.tscl:line:col` (see [Type checking](./type-checking.md)). Run it in a terminal or as a task, and the problems show up in the editor.

Errors, hover and completion inside templates, as you type, come with TypeScript 7.1's content mappers: one line in `tsconfig.json` will point TypeScript at clarusjs's mapper, so VS Code's own TypeScript support covers `.tscl` files. That is in progress.

## Other editors

The grammar is a standard TextMate grammar (`packages/vscode/syntaxes`), which editors such as Sublime Text and Zed can load. Editors that use TypeScript's language server, Neovim among them, will get the same type errors in templates from the content mapper.
