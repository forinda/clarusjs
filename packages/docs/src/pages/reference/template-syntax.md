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
| `@model name: Type = default` | an input the parent binds two ways (`[(name)]`) | [Forms](/guide/forms) |
| `@event name: Type`, `emit('name', value)` | an event the component sends its parent, and sending it | [Events](/guide/events#from-a-child-island-to-its-parent) |
| `@extends input` {since=0.16.0} | the component stands for that element: its attributes, typed, land on its root (a declared input takes its name instead; the root's own attribute wins) | [Components](/guide/components#a-component-that-stands-for-an-element-extends) |
| `@layout none` | a page without its folder and config layouts | [Layouts](/guide/layouts#folder-layouts) |
| `@import name from './x.tscl'` | use a component | [Components](/guide/components) |
| `@import { a } from './x.ts'` | import data | [Components](/guide/components) |
| `@import type { T } from './x'` | import types for inputs | [Inputs](/guide/inputs) |
| `{{ expr }}` | print a value, escaped | [Holes](/guide/holes) |
| `[name]="expr"`, `name="a {{ b }}"` | bind an attribute or a component input | [Attributes](/guide/attributes) |
| `(event)="handler"` | handle an event (islands); on a component, its `@event` (`$event`, `$info`) | [Events](/guide/events) |
| `@if (a) { } @else if (b) { } @else { }` | conditional branches | [Conditionals](/guide/conditionals) |
| `@for (x of xs; track x.id) { } @empty { }` | repeat content | [Lists](/guide/lists) |
| `@await (p) { } @then (v) { } @catch (e) { }` | show a promise's states: pending, its value, its error | [Fetching data](/guide/fetching#in-an-island-await) |
| `<fragment> … </fragment>` {since=0.16.0} | group elements without rendering one; takes no attributes | [Components](/guide/components#several-elements-without-a-wrapper-fragment) |
| `<slot />, <slot name="x">fallback</slot>` | where wrapped content goes | [Slots](/guide/slots) |
| `<icon name="set:name" />` | an icon, inlined as SVG at build time (built in, no import) | [Icons](/guide/icons) |
| `@slot('x') { }`, `@slot('x', { item }) { }` | fill a named slot; receive what the slot passes (`<slot [item]="…">`) | [Slots](/guide/slots) |
| `verbatim` attribute | show content as text | [Verbatim](/guide/verbatim) |
| `<script> … </script>` | make a component interactive | [State](/guide/state) |
| `<script server> … </script>` | run code on the server at render, with `await`; nothing ships | [Fetching data](/guide/fetching#on-the-server) |
| `<script inline> … </script>` | a script written out as is, run where it stands | [Styles](/guide/styles) |
| `<style scoped> … </style>`, `<style>`, `<style global>` | the component's CSS, scoped to it (`scoped`) or global | [Styles](/guide/styles) |
| `{{-- comment --}}` | a template comment, removed from the output |  |
