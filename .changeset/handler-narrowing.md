---
'clarusjs': patch
---

Type checking (`clarusjs check` and the content mapper):
- An event handler or two-way binding inside `@if (x)` keeps that narrowing (`x` was "possibly null" inside a `(click)` handler); `@else` branches know the earlier conditions were false.
- `$event.currentTarget` is the element the handler is on (`HTMLInputElement` for `<input (input)>`).
- No errors from generated code under `noUnusedLocals` (unread inputs, `$index`, helper types).
