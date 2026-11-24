---
"clarusjs": patch
"@clarusjs/ui-primitives": patch
---

Context fixes (#465): `@context` reads only what was provided (a name like `toString` no longer reads the object's own); a `provide` key must be a name `@context` can read; `clarusjs check` reports a script's own `provide` as the build does. The Tabs docs no longer suggest `[(value)]` and `(change)`, which need a parent island that can pass content to the tabs.
