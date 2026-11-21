---
'clarusjs': patch
---

`clarusjs/forms` fixes from review:
- Errors on paths no field shows (a whole-object schema rule, a server error like `{ '': 'Server down.' }`) stop submit and are listed in `f.errors` (with no id or step), instead of being dropped.
- `f.next()` and `f.submit()` wait for the newest schema check (a pending pause is cut short), so a slow async rule can't be skipped; a schema that throws no longer leaves `f.pending` stuck.
- A field without its own `[data-cl-message]` no longer takes another field's.
- Touched state follows the row, not its index: removing a touched row doesn't show the next row's error.
- Back to the page as it loaded (no hash) shows the first step.
