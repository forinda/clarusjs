---
'clarusjs': patch
---

Fixes from review:
- Forms: a component bound two ways more than once carries a path per binding (`data-cl-path-<model>` on its island; its own fields write `@<model>`), so each binding's errors reach its field. A literal key (`order['email']`) is decoded in the path. `form` imported under another name keeps its state, and a local named `form` is left alone. A schema that throws blocks submit. Values changed during a check are checked again before submit; `next()` checks the step's fields as they are after waiting; server errors for values changed while the server answered are dropped.
- Type checking: enumerated attributes (`draggable`, `spellcheck`, `translate`) take their strings; a condition about an outer name isn't repeated inside a `@for` whose item has that name.
