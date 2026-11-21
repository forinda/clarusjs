---
'@clarusjs/theme-docs': patch
'clarusjs': patch
---

The theme's templates type-check under strict TypeScript with the content mapper: its config types take readonly lists (a template's inputs are readonly, and mutable configs still fit), and its scripts narrow DOM lookups instead of assuming elements exist. Template type checking also types callbacks passed to a script's own functions (`record((p) => …)`) as `any`, like those functions' own parameters.
