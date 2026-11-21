---
title: "Editor setup"
group: "Tooling"
order: 2
description: "The clarusjs VS Code extension (highlighting, snippets, file icon) and the TypeScript 7.1 content mapper for type errors as you type."
---

# Editor setup

<p class="lead">The clarusjs extension for VS Code highlights <code>.tscl</code> templates, gives them a file icon, and adds snippets for pages, components and template pieces.</p>

## VS Code

Install **clarusjs** from the Extensions view. The extension is in this repository as `packages/vscode`; until its first Marketplace release, `pnpm --filter clarusjs-vscode package` builds a `.vsix`, which **Extensions: Install from VSIX…** installs.

What it gives `.tscl` files (hover and completion inside expressions and scripts come from TypeScript: see below):

- **Highlighting.** HTML, with TypeScript wherever a template holds code: `{{ }}` holes, `[prop]`, `(event)` and `[(model)]` bindings, `@if`/`@for` conditions, `@input`/`@model` types, `@type`/`@interface` and `<script>`. CSS in `<style>`, and `{{-- comments --}}`.
- **Hover and completion for HTML.** Tags and attributes, as in `.html` files, with their binding forms: `[disabled]`, `(click)`, and `[(value)]`/`[(checked)]` on fields. And the components the file imports: hover `<card>` for where it comes from, its inputs and its events; inside `<card ` the completions offer `[title]`, `[(value)]` for a `@model`, and `(rate)` for each event its script sends (`new CustomEvent('rate', …)`).
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

## Type errors as you type

clarusjs ships a content mapper for TypeScript 7.1: TypeScript hands it each `.tscl` file and gets back TypeScript it can check, with a map back to the template. Errors, hover and completion then work inside templates, in VS Code's own TypeScript support and in any editor that uses TypeScript's language server.

Add it to `tsconfig.json`, next to `compilerOptions`:

```json
{
  "compilerOptions": { "strict": true },
  "contentMappers": [{ "package": "clarusjs", "extensions": [".tscl"] }],
  "include": ["src", ".clarusjs/views.d.ts", ".clarusjs/routes.d.ts"]
}
```

- **TypeScript 7.1 or later.** On 7.0 the entry is ignored; `clarusjs check` (below) works on both.
- **Trust.** A mapper is code that runs while TypeScript checks: VS Code runs it in a trusted workspace, and `tsc` only with `--runExternalCode` (`tsc --noEmit --runExternalCode`).
- **Template syntax errors** (an unclosed `@if`) are reported as `clarus` errors. As with any syntax error, TypeScript reports type errors again once it's fixed.
- **Scripts are JavaScript.** Parameters of a script's own functions are typed `any`, so a strict project doesn't flag them; callbacks keep the type their context gives them.

`clarusjs check` type-checks the same way in one command, also on TypeScript 7.0, and covers Markdown pages, which the mapper doesn't. Use it in CI (see [Type checking](./type-checking.md)).

## Other editors

The grammar is a standard TextMate grammar (`packages/vscode/syntaxes`), which editors such as Sublime Text and Zed can load. Editors that use TypeScript's language server, Neovim among them, get the same type errors in templates from the content mapper.
