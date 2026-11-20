---
"clarusjs": minor
---

Type-checking groundwork: `@import type { User } from '…'` brings types into a component for its `@input` declarations (erased from compiled output), and a generator turns each `.tscl` file into virtual TypeScript (`@if` → `if` with narrowing, `@for` → `for…of`, components → objects typed as the child's `Inputs`, typed `$event`) with mappings back to the template, so `tsc` errors can be reported at `file.tscl:line:col`.
