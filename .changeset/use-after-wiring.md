---
'clarusjs': patch
---

`[use]` behaviours run once the island, branch or row around them is wired, so one can set state while an island attaches (a saved choice, the URL): a `@for` after it no longer fails to attach on a changed list (#550), and nested islands show the new value, also those whose script is still loading (#524).
