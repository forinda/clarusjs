---
title: "Components inside islands"
group: "Interactivity"
order: 4
description: "Use other components inside an island."
---

# Components inside islands

<p class="lead">An island can use other components, including inside <code>@if</code> branches and <code>@for</code> rows.</p>

- A component **without** a script is re-rendered in the browser when the props or content it gets from the island change.
- A component **with** a script becomes its own island and keeps its own state, starting from the props it was first given.

The to-do list on the [home page](/) shows its count with a small component whose text comes from the island's state.
