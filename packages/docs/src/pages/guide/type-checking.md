---
title: "Type checking"
group: "Tooling"
order: 1
description: "Type-check templates with clarusjs check: inputs, holes, events and imported data, reported at file.tscl:line:col."
---
@import pm from '../../components/pm.tscl'

# Type checking

<p class="lead"><code>clarusjs check</code> type-checks your templates with your project's own TypeScript, and reports errors where you wrote them: <code>file.tscl:line:col</code>.</p>

## Set up

Install TypeScript in your project (clarusjs uses whichever version you have), then add a script:

<pm [commands]="['add -D typescript']" />

```ts
// package.json
"scripts": { "check": "clarusjs check" }
```

Then run it:

<pm [commands]="['run check']" />

If your project has a `tsconfig.json` (or, in JavaScript, a `jsconfig.json`), its settings are used; otherwise strict defaults with browser types. [Getting started](./getting-started.md#typescript-or-javascript) shows both, with the generated `.clarusjs/views.d.ts` and `.clarusjs/routes.d.ts` included for your editor.

## What it checks

- **Inputs.** Using a component checks the values you pass against its `@input` types: a missing input, an unknown one, or a wrong type is an error on the tag.
- **Holes and attributes.** Every `{{ }}` and `[attr]` expression is type-checked against the inputs, script variables and imports it can see.
- **Control flow.** `@if` narrows types like `if`, and `@for` types the row variable from the list.
- **Events.** In `(click)="…"`, `$event` has the right event type, such as `MouseEvent`.
- **Rendering by name.** `render('components/pill', { text })` from `clarusjs/views` is checked against the view's inputs, through the generated `.clarusjs/views.d.ts`.
- **Scripts and data.** An island's script, and data brought in with `@import`, are ordinary TypeScript.

```tscl
{{-- src/pages/index.tscl --}}
@import { nav } from '../nav'
@for (item of nav) { <a [href]="item.hrfe">{{ item.title }}</a> }
```

```sh
$ pnpm check
src/pages/index.tscl:2:38 error TS2339: Property 'hrfe' does not exist on type '{ title: string; href: string; }'.

1 error
```

## In CI

The command exits with 1 when there are errors, so it fails a CI job on its own. Add `--json` to get the diagnostics (file, line, column, code, message) for other tools. This site checks itself in CI the same way.

```yaml
- run: pnpm check
```

## How it works

Each `.tscl` file is turned into a TypeScript file that means the same thing (`@if` becomes `if`, a component tag becomes an object typed as its inputs) and is never run. TypeScript checks those files, and each error is mapped back to the template. They are written to `.clarusjs/`: keep that folder out of version control.

::: info Editor support
Errors in the editor, as you type, are planned. Until then, run `clarusjs check`; build errors also point at the exact line and column.
:::
