---
'clarusjs': minor
---

`@for (section of sections; track section.id; let s = $index)`: name a row's `$index` (or `$count`, `$first`, `$last`, `$even`, `$odd`) so a nested loop can use the outer row's: `{{ s + 1 }}.{{ $index + 1 }}`, `[(value)]="order.sections[s].items[$index].name"`. Indexing an outer loop's list with the inner `$index` (which reads or writes the wrong row) is now a compile error, also in `clarusjs check`, that points to `let`.
