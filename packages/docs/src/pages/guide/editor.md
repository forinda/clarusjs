---
title: "Editor setup"
group: "Tooling"
order: 2
description: "Editor support for .tscl templates: the clarusjs language server in VS Code, Neovim, Helix, JetBrains and more, and the TypeScript 7.1 content mapper for types."
---

# Editor setup

<p class="lead">The clarusjs language server gives <code>.tscl</code> templates their errors, HTML and component support, references and renames in any editor; TypeScript inside templates comes from TypeScript itself. The VS Code extension bundles the server, with highlighting and snippets.</p>

## VS Code

Install **clarusjs** (`forinda.clarusjs-vscode`) from the Extensions view, and keep it up to date: it bundles the language server, so new template features reach the editor with the extension's releases. A version older than the project's clarusjs can report what it doesn't know yet as errors (before 0.3.0, every `<icon>` showed *icons are resolved at build time*), though the site builds fine. It runs [the language server](#the-language-server) for you, so it gives everything listed there, plus (hover and completion inside expressions and scripts come from TypeScript: see below):

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

## The language server

`@clarusjs/language-server` is the same server in every editor. It runs `clarusjs-ls --stdio` and gives `.tscl` files:

- **Template errors as you type,** from the clarusjs compiler, at their place.
- **HTML, CSS and Emmet** in templates and `<style>`, with the binding forms of attributes: `[disabled]`, `(click)`, and `[(value)]`/`[(checked)]` on fields.
- **Components:** the components a file imports complete as tags; inside `<card ` the completions offer its inputs (`[title]`), its models (`[(value)]`) and the events its script sends (`(rate)`). Hover `<card>` for where it comes from and what it takes, or one of its attributes (`[title]`, `[(open)]`, `(rate)`) for that input's type and default, or the event; go to definition from the tag or its `@import`.
- **Icons:** `<icon name="…">` completes set and icon names from the sets the project installed, with a preview, and hovering the name shows the icon. An unknown name or a missing set is an error at its place.
- **References and renames:** Find All References on a component; rename a component in a file; renaming or moving a `.tscl` file updates every `@import` that points to it, Markdown pages included.
- **Semantic colouring** of the template syntax, for editors without the TextMate grammar.

Install it globally to get the `clarusjs-ls` command on your `PATH`, where editors look for it:

```sh
npm install -g @clarusjs/language-server
```

Installed in a project instead (`npm install -D @clarusjs/language-server`), the command is `node_modules/.bin/clarusjs-ls`: give editors that path in place of `clarusjs-ls`.

**Trust.** Started with `initializationOptions: { trusted: true }`, the server uses the project's own `clarusjs` compiler (when it's recent enough), so the editor agrees with the build; otherwise the one bundled with it. That runs code from the project's `node_modules/clarusjs`, so set it only for projects you trust (the examples below set it; drop it for others). VS Code passes your workspace trust.

### What hovers without TypeScript, and what needs it

The language server reads templates; it doesn't know your types. TypeScript does, through the content mapper below:

| You hover | Without the content mapper | With it (TypeScript 7.1) |
|---|---|---|
| a component tag, `<card>` | where it comes from, its inputs, models and events | the same |
| a component's attribute, `[title]` | the input's declared type and default | the same, and the bound value's type |
| an `<icon>` name | the icon | the same |
| a variable or function in `<script>` | nothing | its type, its signature, go to definition |
| an expression in `{{ }}` or a binding | nothing | its type, and type errors as you type |

So hovering `stamp` in a script, or `notes.value` in a hole, shows nothing until the content mapper is set up.

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

- **TypeScript 7.1 or later.** On 7.0 the entry is ignored; `clarusjs check` (below) works on both. While 7.1 is in beta, install it with `npm install -D typescript@beta`.
- **VS Code must use the project's TypeScript.** Open a `.tscl` or `.ts` file, run **TypeScript: Select TypeScript Version** from the Command Palette and pick **Use Workspace Version**. The TypeScript VS Code bundles may be older than 7.1, and then the mapper doesn't run.
- **`paths` start with `./`.** TypeScript 7 has no `baseUrl`, so a `paths` target is relative to the `tsconfig.json` and must say so: `"~/*": ["./src/*"]`. Without the `./`, TypeScript stops with `TS5090: Non-relative paths are not allowed`, and nothing is checked.
- **Trust.** A mapper is code that runs while TypeScript checks: VS Code runs it in a trusted workspace, and `tsc` only with `--runExternalCode` (`tsc --noEmit --runExternalCode`).
- **Template syntax errors** (an unclosed `@if` or `<div>`, while you type) are reported as `clarus` errors, and the rest of the file keeps its hover, completion and errors in the editor. `tsc` on the command line, as for any syntax error, reports type errors again once it's fixed.
- **Scripts are JavaScript.** Parameters of a script's own functions are typed `any`, so a strict project doesn't flag them; callbacks keep the type their context gives them.

`clarusjs check` type-checks the same way in one command, also on TypeScript 7.0, and covers Markdown pages, which the mapper doesn't. Use it in CI (see [Type checking](./type-checking.md)).

## Formatting

**Format Document** formats `.tscl` files with your project's Prettier and `@clarusjs/prettier-plugin`: see [Formatting](/guide/formatting).

## Other editors

Each editor starts `clarusjs-ls --stdio` for files ending in `.tscl`. For TypeScript inside templates, add the content mapper line above to `tsconfig.json`: editors that use TypeScript 7.1's language server pick it up.

### Neovim

With Neovim 0.11 or later:

```lua
vim.filetype.add({ extension = { tscl = 'tscl' } })
vim.treesitter.language.register('html', 'tscl') -- HTML highlighting; the server adds colours for the template syntax
vim.lsp.config('clarusjs', {
  cmd = { 'clarusjs-ls', '--stdio' },
  filetypes = { 'tscl' },
  root_markers = { 'package.json' },
  init_options = { trusted = true },
})
vim.lsp.enable('clarusjs')
```

### Helix

In `languages.toml`:

```toml
[language-server.clarusjs]
command = "clarusjs-ls"
args = ["--stdio"]
config = { trusted = true }

[[language]]
name = "tscl"
scope = "text.html.tscl"
file-types = ["tscl"]
roots = ["package.json"]
grammar = "html"
language-servers = ["clarusjs"]
```

Helix finds highlight queries by language name, so give `tscl` the HTML ones: create `queries/tscl/highlights.scm` in your Helix runtime folder (`~/.config/helix/runtime/`) with one line:

```scheme
; inherits: html
```

### JetBrains IDEs

Install the **LSP4IJ** plugin, then add a language server (**Languages & Frameworks → Language Servers → +**): command `clarusjs-ls --stdio`, and under **Mappings → File name patterns** add `*.tscl`. Its initialization options: `{ "trusted": true }`.

### Zed

Zed runs language servers through extensions; a clarusjs extension for Zed (registering `.tscl` and `clarusjs-ls`) is planned.

### Sublime Text

Load the TextMate grammar from the VS Code extension (`packages/vscode/syntaxes`) for highlighting, and add `clarusjs-ls --stdio` with the **LSP** package for the rest.

## File icons and GitHub

The VS Code extension gives `.tscl` files their own icon in VS Code's default icon theme. Support in popular icon themes (Material Icon Theme, vscode-icons, Seti, nvim-web-devicons) is on its way upstream.

On GitHub, a repository's `.gitattributes` can highlight `.tscl` files as HTML until GitHub knows the language:

```text
*.tscl linguist-language=HTML
```
