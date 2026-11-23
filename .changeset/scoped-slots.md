---
'clarusjs': minor
---

Scoped slots (#455): a component passes data to the content filling a slot, `<slot name="row" [item]="item" [index]="$index">fallback</slot>`, and the fill names it like a function parameter, `@slot('row', { item, index }) { … }` (renames, defaults and `@slot('default', …)` work too). Rendered on the server; `clarusjs check` checks the values where they're passed (the names a fill receives are typed `any` for now). A fill that receives data inside an island is a located error, for now.
