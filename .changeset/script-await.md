---
'clarusjs': patch
---

An `await` (or `for await`) at the top level of a component's `<script>` is now a compile error with its place. Before, it compiled into JavaScript that doesn't run, because `render()` and `attach()` are synchronous. Await inside a function instead, such as a resource's fetcher or an event handler.
