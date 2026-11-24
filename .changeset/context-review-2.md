---
"clarusjs": patch
"@clarusjs/ui-primitives": patch
---

Review fixes for context and island content (#465): `provide` may only be called (a bare reference is a located error in the build and in `check`), an import may rename it (`import { provide as register }`), `@context` names like `Object` work, a provided `__proto__` key reaches re-rendered content, an island's markers never include those of an island in its slot content, a `@model` field in a component inside another island's slot takes the right path, and an island whose content reads a nested provider that failed to load is retried with it instead of failing for good. Menu items name their menu (`data-menu`), so arrow keys and typeahead skip a nested menu's items; a radio group follows its value after a form reset; a focused tooltip trigger keeps its tooltip open when the pointer leaves.
