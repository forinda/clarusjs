---
'clarusjs': patch
---

`.clarusjs/views.d.ts` writes a type import from the built-in `~/` alias as a path from `.clarusjs/` (`../src/…`), so it resolves without a `paths` entry in tsconfig.
