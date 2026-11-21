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
