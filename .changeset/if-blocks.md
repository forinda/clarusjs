---
"clarusjs": minor
---

`@if` / `@else if` / `@else` blocks. Outside islands the branch is chosen on the server and costs nothing in the browser. Inside an island the block switches when the state it reads changes: the server-rendered branch is wired in place, and a new branch is rendered in the browser and wired, with the old branch's effects and event handlers disposed. Signals gain `scope()`, `onDispose()` and `untrack()`.
