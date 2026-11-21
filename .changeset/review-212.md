---
'clarusjs': patch
---

Fixes from review:
- `[(value)]="form['name']"` updates an object property (a bracket path used to assume an array).
- A destructuring write to an input (`({ value } = …)`) is a located read-only error.
- A multi-line generic type (`Array<` across lines) stays inside its `@type`.
- `(mouseenter)` and other events that don't bubble run only their target's handler, not an ancestor's.
- A `@model` write is taken only by the island that binds that child, not by an outer one.
- A nested island is kept in place only for the same component source.
- New props are applied together (a new `batch()` in `clarusjs/runtime`), so effects never see half an update.
- `clarusjs check`: works through a symlinked project root; resolves aliased component imports (outside the project, and exact aliases to a `.tscl` file); checks that a child's `@model` type can be written back into the parent's target.
