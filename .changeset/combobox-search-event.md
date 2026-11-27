---
'@clarusjs/ui-primitives': minor
---

Combobox `(search)`: answer each search yourself (an API client, IndexedDB, a worker). The event brings the term and an `AbortSignal` (a newer search aborts it); `$event.respond()` takes the options or a promise of them, cached by search like `[src]`'s.
