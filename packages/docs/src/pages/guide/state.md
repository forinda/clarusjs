---
title: "State"
group: "Interactivity"
order: 2
description: "Reactive state and derived values in islands, starting from the server's values."
---

# State

<p class="lead"><code>state()</code> makes a value reactive and <code>derived()</code> computes from it. You read and write them as plain variables; the compiler rewrites <code>count++</code> into a signal update.</p>

```tscl
<script>
  let count = state(0)
  const double = derived(() => count * 2)
</script>

<button (click)="count++">{{ count }} × 2 = {{ double }}</button>
```

## Starting from the server's values

An island's state is rendered on the server first. Its values travel with the HTML, so the browser picks up exactly where the server left off: an initial value like `Date.now()` isn't computed a second time. Values can be plain JSON, `Date`, `Map`, `Set`, `BigInt` and `undefined`; functions and class instances can't be sent.

::: warning Island props and state are public
They are written into the page so the browser can continue from them. Never put secrets in them. Reading server-only globals such as `process` in an island&#39;s script is a build error for this reason.
:::
