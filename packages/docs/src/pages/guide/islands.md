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
