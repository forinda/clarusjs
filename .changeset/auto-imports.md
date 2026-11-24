---
'clarusjs': minor
---

Automatic component imports (#458). Kebab-case components in `src/components/` and `src/layouts/` are used by name without `@import`: the full name is the folders and file joined (`forms/text-field.tscl` → `<forms-text-field>`), the short name the file alone (`<text-field>`) when no other component has it (two is a located error). Only names with a hyphen, only the components a template uses, and an explicit `@import` still works. Other hyphenated tags stay HTML (web components). `clarusjs check`, the content mapper and the language server (completion, hover, go to definition) know the same names. `clarusjs({ components: { dirs, auto } })` changes the folders or turns it off; non-kebab files get a warning. `clarusjs/compiler` exports `componentIndex()`.
