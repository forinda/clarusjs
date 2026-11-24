---
'clarusjs': minor
---

Component events (#442). A component declares what it sends its parent with `@event change: number` (`@event close` for none) and sends it from its script with `emit('change', value, { reason, event })`. The parent island handles it on the tag, `<stepper (change)="total = $event" />`: `$event` is the value, `$info` has `reason`, `event` and `cancel()`, and cancelling makes the child's `emit()` return false, so a parent can veto a change without taking the value over. Events stop at the parent. `clarusjs check` types both sides (the value `emit()` gets, `$event` in the handler, and a misspelled event name). No HTML contract change: a `cl:event` DOM event travels like `@model` writes.
