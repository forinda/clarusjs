---
'@clarusjs/language-server': minor
---

References and renames for components: Find All References lists a component's tags in every file that imports it (whatever name each gives it); renaming a tag or its import name renames it in that file; renaming or moving a `.tscl` file rewrites every `@import` that points to it (relative specifiers recomputed, `~/` kept as `~/`, Markdown pages included) and the moved file's own relative imports.
