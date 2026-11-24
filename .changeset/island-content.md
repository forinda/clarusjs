---
"clarusjs": minor
"@clarusjs/ui-primitives": patch
---

Islands pass content to islands (#465): content written inside an island can go to another island's `<slot />`, with its holes, handlers, blocks and `[use]`; each island wires only its own. An island's slot content now sits between `<!--[s-->` and `<!--]s-->` (a new marker in the HTML contract), and the runtime decides which island owns a node across those ranges. The "can't take content from inside another island yet" error is gone. Forms paths of fields in slot content come from the island that wrote them. Tabs' `[(value)]` and `(change)` work inside islands.
