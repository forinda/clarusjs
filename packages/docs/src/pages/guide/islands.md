---
title: "Islands"
group: "Interactivity"
order: 1
description: "Interactive components that attach to server HTML, and what ships to the browser."
---

# Islands

<p class="lead">A component with a <code>&lt;script&gt;</code> is interactive: an island. It is rendered to HTML on the server like everything else, then <em>attached</em> in the browser: its event handlers and updates are wired to the HTML that is already there. Nothing re-renders.</p>

```tscl
<script>
  let count = state(0)
</script>

<button (click)="count++">Clicked {{ count }} times</button>
```

## What ships to the browser

- A small loader, only on pages that have islands.
- One chunk per interactive component, with just its `attach` function.
- Nothing for components without a script, and nothing for the page itself.

This page's text and layout ship no JavaScript. It loads two kinds of island: the theme toggle in the header, and the copy buttons on code samples, which use `attach="interaction"` so their code only loads when you click one.

::: info
In the HTML, an island is a `<cl-island>` element that names its chunk and props, and its reactive text sits between `<!--[0-->` markers. View the source of the home page to see it.
:::

## Editing an island

In `vite dev`, saving an island's file swaps it in place: the dev server renders the page again, the island gets its new HTML and code, and its state carries over by name. A counter at 5 is still at 5 with its new template, and islands inside it keep theirs too. A state renamed or added in the edit starts from its initial value.

A change that only the server sees, such as a page, a layout, a component without a `<script>`, a `.load.ts` file or a Markdown page, reloads the page. So does an edit the swap can't follow, such as one that adds or removes copies of the island on the page, and any edit on a [client route](/guide/client-routes). None of this is in a build.
