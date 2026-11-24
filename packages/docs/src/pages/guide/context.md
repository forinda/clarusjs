---
title: "Context"
group: "Templates"
order: 8
description: "A component provides values with provide(); components inside it read them with @context, without props on every one."
---

# Context

<p class="lead">A component can hand values to every component rendered inside it, at any depth, without the page passing props to each one. Tabs, menus and radio groups use it so their parts know the selection.</p>

```tscl
{{-- components/tabs.tscl --}}
@input value: string
<script>
  provide('tabs', { value })
</script>
<div class="tabs"><slot /></div>

{{-- components/tab-panel.tscl --}}
@context tabs: { value: string }
@input value: string
<section [hidden]="value !== tabs.value"><slot /></section>

{{-- a page --}}
<tabs value="npm">
  <tab-panel value="npm">npm i clarusjs</tab-panel>
  <tab-panel value="pnpm">pnpm add clarusjs</tab-panel>
</tabs>
```

The server renders the panels with `hidden` already right: context is there while the page renders, not only once JavaScript runs.

## Providing

- **`provide('key', value)`** in a component's `<script>`. The key is a string; a later `provide` with the same key replaces the earlier one.
- **Nearest wins.** Inside a nested provider with the same key, its value is used; after it, the outer one is back.
- **The value is read when a child renders.** In an island, children it renders again in the browser see the current value, as with props.

## Reading

- **`@context name: Type`** declares `name` for the template, typed for `clarusjs check`.
- **`@context name: Type = fallback`** uses the fallback outside any provider. Without one, rendering outside a provider is an error that names the component and the key.
- **Content passed through other components** still sees the context where it lands: a wrapper that places your content inside `<tabs>` hands it the tabs' context.

## In islands

- An island can provide (Tabs does).
- An island can't read context yet: `@context` in a component with a `<script>` or a `@model` is a build error. Read it in a component without a script, or pass the value in as a prop.
- A component without a script that the island re-renders in the browser (inside its `@if` or `@for`) only sees what the island itself provides, not what was provided above the island.

Context is passed with each render, never stored globally, so it works the same for pages that wait on data and on any server runtime.
