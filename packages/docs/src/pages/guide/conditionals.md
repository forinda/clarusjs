---
title: "Conditionals"
description: "Show one of several branches with @if, @else if and @else."
---

# Conditionals

<p class="lead">Show one of several branches with <code>@if</code>, <code>@else if</code> and <code>@else</code>.</p>

```tscl
@if (user.isAdmin) {
  <a href="/admin">Admin</a>
} @else if (user.isEditor) {
  <a href="/edit">Edit</a>
} @else {
  <span>Read only</span>
}
```

Outside an interactive component the choice is made on the server and costs nothing in the browser. Inside one, the branch switches when the state it reads changes: the old branch's handlers are removed and the new branch is inserted and wired.

::: tip
Inside a block, a bare `}` closes it; write `&#125;` for a literal one.
:::
