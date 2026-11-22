---
title: "clarusjs/compiler"
group: "APIs"
order: 7
description: "compile(), parse() and ClarusError: the compiler's API for tools, with its types, caveats and usage."
---

# clarusjs/compiler

<p class="lead">The compiler, for tools: an editor, a linter, a docs generator, a different bundler. Apps don't need it; the Vite plugin calls it.</p>

```ts
import { compile, parse, ClarusError } from 'clarusjs/compiler'
```

## compile()

```ts
compile(source: string, options: CompileOptions): CompileResult
```

Compiles a `.tscl` component. For the server target, the result is a module whose `render(props)` returns the component's HTML. For the client target, it's an island's `attach(root, props)`, or `export {}` when the component has no script.

### Parameters

- **`source`**: the `.tscl` text.
- **`options`**:
  - **`file`**: the file's path, used in error messages and to derive the style scope.
  - **`target`**: `'server'` or `'client'`.
  - **`clientUrl`**: for the server target of an island, the URL its client module is served at.
  - **`renderImports`**: import child components' render functions with `?render`, for a render module that runs in the browser.
  - **`scope`**: the id that scopes the component's `<style scoped>` (default: derived from `file`).
  - **`collapseWhitespace`**: each run of whitespace in template text becomes one character (a newline if it had one), except in `<pre>`, `<textarea>`, `<script>` and `<style>`. The Vite plugin turns it on for `vite build`.
  - **`icon`**: `(name) => IconLookup`, finds the icons of [`<icon name="set:name" />`](/guide/icons). Pass `(name) => resolveIcon(name, file)` from `clarusjs/icons`; without it, `<icon>` is an error. The Vite plugin, `clarusjs check` and the editor pass it.

### Returns

A `CompileResult`:

- **`code`**: the module.
- **`stateful`**: the component is an island (it has a script, or a `@model`).
- **`css`**: its stylesheet. `<style scoped>` blocks are wrapped in `@scope`; the others are kept as written.
- **`warnings`**: things that compile but likely aren't meant, each a located `ClarusError` (not thrown).

### Caveats

- **Pure:** strings in, strings out. It reads no files and imports nothing.
- **A template it can't compile** throws a [`ClarusError`](#claruserror) with its place.

### Usage

```ts
const { code, css, stateful, warnings } = compile(source, { file: 'src/components/card.tscl', target: 'server', clientUrl: '/card.js' })
for (const w of warnings) console.warn(w.message)
```

## parse()

```ts
parse(source: string, file: string): ParsedFile
```

Parses a `.tscl` file into its syntax tree, without compiling it.

### Returns

A `ParsedFile`:

- **`inputs`**: each `@input` and `@model`, as an `InputDecl` with its name, type text, default and offsets;
- **`imports`**: each component `@import` (`ImportDecl`);
- **the script, styles and template nodes**: `TemplateNode`s, whose elements carry `Attr`s.

Every node has a `start` offset into the source.

### Caveats

- **Expressions stay raw strings:** `parse()` doesn't parse JavaScript. `compile()` checks them.
- **A syntax error** (an unclosed `@if (`, a stray `}`) throws a `ClarusError`.

### Usage

```ts
const { inputs, imports } = parse(source, 'src/components/card.tscl')
console.log(inputs.map((i) => `${i.name}: ${i.type}`))
```

## lint()

```ts
lint(source: string, file: string, levels?: LintConfig, rules?: LintRuleDef[]): LintMessage[]
```

Runs the [lint rules](/guide/lint) on one `.tscl` file: the built-in ones and `rules`, at their `levels` (`'warn'` by default, `'error'` or `'off'`). Each finding has its `rule`, `severity` (`'warning'` or `'error'`), `message`, `file`, `line`, `column` and `start` offset. A `{{-- clarusjs-ignore --}}` comment skips its line and the next. Like `parse`, it throws a located `ClarusError` for a syntax error.

```ts
import { lint } from 'clarusjs/compiler'

for (const m of lint(source, 'src/components/card.tscl')) console.log(`${m.line}:${m.column} ${m.rule}: ${m.message}`)
```

`lintRules` is the list of built-in rules, and `LintRuleDef` the type of one. See [Writing a rule](/guide/lint#writing-a-rule).

## ClarusError

```ts
class ClarusError extends Error { file: string; line: number; column: number }
```

A compile error pointing at a place in a `.tscl` file. Its message reads `file:line:column text` (1-based), and the place is also in `file`, `line` and `column`. `compile()` and `parse()` throw it, and `compile()`'s warnings are `ClarusError`s too.

```ts
try {
  compile(source, { file, target: 'server' })
} catch (err) {
  if (err instanceof ClarusError) report(err.file, err.line, err.column, err.message)
  else throw err
}
```

## clarusjs/icons

Node only: it reads the [Iconify](https://icon-sets.iconify.design/) sets a project installs (`@iconify-json/<set>`), from the nearest `package.json` above a file. Sets found are cached; a missing one isn't, so installing it is enough.

```ts
import { resolveIcon, iconSets, iconNames, iconSvg } from 'clarusjs/icons'
```

- **`resolveIcon(name, fromFile)`**: `{ data }` for `set:name` (`{ body, width, height, left, top }`), or `{ missing: 'set', set }`, or `{ missing: 'icon', set, suggestions }` with the closest names. Throws for an alias that flips or rotates its icon (not supported yet).
- **`iconSets(fromFile)`**: the installed sets, `{ prefix, name, total }`.
- **`iconNames(set, fromFile)`**: the names in a set, sorted (none when it isn't installed).
- **`iconSvg(data, attrs?)`**: a standalone `<svg>` for an icon.

`checkIcons(parsed, file, source, icon)` from `clarusjs/compiler` returns every `<icon>` error in a file (compiling stops at the first).

