---
'clarusjs': minor
---

A compile warning when state is changed in place, in a script or an event handler: `items.push(x)`, `items.sort()`, `form.a = 1`, `form.b.c++`, `delete form.a`, a Map's or Set's `set`/`add`/`delete`/`clear`. Nothing notifies, so the page doesn't update; the warning says what to assign instead (`items = [...items, …]`, `form = { ...form, a: … }`). Two-way bindings (`[(value)]`) already write a copy and aren't flagged.
