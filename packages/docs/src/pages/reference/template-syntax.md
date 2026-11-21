---
title: "Template syntax"
group: "Templates"
order: 1
description: "Every directive and binding in .tscl templates, on one page."
---

# Template syntax

<p class="lead">Everything you can write in a <code>.tscl</code> file, with links to the guide.</p>

| Syntax | What it does | Guide |
|---|---|---|
| `@input name: Type = default` | a typed input | [Inputs](/guide/inputs) |
| `@import name from './x.tscl'` | use a component | [Components](/guide/components) |
| `@import { a } from './x.ts'` | import data | [Components](/guide/components) |
| `@import type { T } from './x'` | import types for inputs | [Inputs](/guide/inputs) |
| `{{ expr }}` | print a value, escaped | [Holes](/guide/holes) |
| `[name]="expr"`, `name="a {{ b }}"` | bind an attribute or a component input | [Attributes](/guide/attributes) |
| `(event)="handler"` | handle an event (islands) | [Islands](/guide/islands) |
| `@if (a) { } @else if (b) { } @else { }` | conditional branches | [Conditionals](/guide/conditionals) |
| `@for (x of xs; track x.id) { } @empty { }` | repeat content | [Lists](/guide/lists) |
| `<slot />, <slot name="x">fallback</slot>` | where wrapped content goes | [Slots](/guide/slots) |
| `@slot('x') { }` | fill a named slot | [Slots](/guide/slots) |
| `verbatim` attribute | show content as text | [Verbatim](/guide/verbatim) |
| `<script> … </script>` | make a component interactive | [State](/guide/state) |
| `<script inline> … </script>` | a script written out as is, run where it stands | [Styles](/guide/styles) |
| `<style scoped> … </style>`, `<style>`, `<style global>` | the component's CSS, scoped to it (`scoped`) or global | [Styles](/guide/styles) |
| `{{-- comment --}}` | a template comment, removed from the output |  |
