---
title: "Lint"
group: "Tooling"
order: 4
description: "Template rules clarusjs check reports as warnings: unused inputs and imports, images without alt, labels and buttons without names. Turn rules off, ignore one place, or write your own."
---

# Lint

`clarusjs check` also lints templates, with rules only clarusjs understands. Findings are warnings at their place, next to [type errors](/guide/type-checking), and editors show them as you type.

```
src/components/card.tscl:4:3 warning img-alt: <img> without alt: describe the image, or use alt="" when it is decoration

1 warning
```

## Rules

| Rule | Reports |
|---|---|
| `unused-input` | an `@input` or `@model` the template and script never read |
| `unused-import` | a component never used as a tag, or imported data never read |
| `img-alt` | an `<img>` without `alt` (use `alt=""` for decoration) |
| `label-field` | a `<label>` with no field inside it and no `for="…"` |
| `accessible-name` | a `<button>` or link with no text, `aria-label`, `aria-labelledby` or `title` |

A component or `<slot>` inside a label, button or link counts as content: lint can't see what it renders, so it gives it the benefit of the doubt. A `@for` without `track` and a two-way binding on an element it doesn't fit are reported by the compiler itself.

## Warnings and errors

Warnings don't change the exit code, so adding clarusjs to a project's CI doesn't fail it. `--strict` fails on warnings too:

```sh
clarusjs check --strict
```

Set each rule's level in the plugin's options: `'warn'` (the default), `'error'`, or `'off'`.

```ts [vite.config.ts]
clarusjs({
  lint: { 'img-alt': 'error', 'unused-input': 'off' },
})
```

## Ignoring one place

A `{{-- clarusjs-ignore --}}` comment skips its own line and the next one: for the rules it names, or for all of them.

```tscl
{{-- clarusjs-ignore img-alt --}}
<img src="/spacer.gif" />
```

## Writing a rule

A rule is an object with a `name` and a `check` function. `check` gets the file's syntax tree and calls `report(offset, message)` for each finding. Levels, `--strict` and ignore comments work for it as they do for the built-in rules. This site has one: it keeps styles in each component's `<style>` block, where they are scoped and minified.

```ts [src/lint/no-inline-style.ts]
import type { LintRuleDef } from 'clarusjs/compiler'

export const noInlineStyle: LintRuleDef = {
  name: 'no-inline-style',
  check({ elements, report }) {
    for (const el of elements) {
      const style = el.attrs.find((a) => a.name === 'style' && (a.kind === 'static' || a.kind === 'interp'))
      if (style) report(style.start, `style="…" on <${el.tag}>: put it in the component's <style> block`)
    }
  },
}
```

```ts [vite.config.ts]
import { noInlineStyle } from './src/lint/no-inline-style.ts'

clarusjs({ lintRules: [noInlineStyle] })
```

What `check` gets:

| Field | What |
|---|---|
| `elements` | every element, in `@if` branches, `@for` rows and slot fills too, in source order; each has `tag`, `attrs` (with `name`, `kind` and `start`), `children` and `start` |
| `parsed` | the whole file as [`parse`](/reference/compiler#parse) returns it: inputs, imports, script, styles, template |
| `components` | the names of the components the file imports, which are also their tags |
| `reads(name)` | whether the template, the script or an input's type or default reads `name` |
| `report(start, message)` | a finding at `start`, an offset in the file: an element's, an attribute's or an `@input`'s `start` |
| `file`, `source` | the file's path and text |

Test a rule with `lint(source, file, levels, rules)` from `clarusjs/compiler`, which returns the findings with their line and column. A rule that throws is reported as an error at the top of the file, so a bug in it doesn't stop the other rules.

## In editors

The [editor extension](/guide/editor) shows the built-in rules' findings as warnings. It doesn't read the Vite config yet, so a project's own rules and levels apply in `clarusjs check` only.
