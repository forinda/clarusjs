---
'clarusjs': patch
---

check: the names a `@slot` fill receives are typed by what the child's `<slot [x]>` passes, not `any`. A misspelled property, or a name the slot doesn't pass, is an error; a name with a default may be one it doesn't pass.
