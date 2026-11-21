---
'clarusjs': patch
---

Two-way binding into lists: `[(value)]="rows[$index].name"` writes back copy-on-write (`rows = rows.map(…)`), so a field in a `@for` row updates the list. Binding to the row variable itself (`[(value)]="row.name"`), which only changed the row's copy, is now a located error pointing to the index form.
