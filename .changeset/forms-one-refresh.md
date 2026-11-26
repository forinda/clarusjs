---
'clarusjs': patch
---

forms: a keystroke rechecks the form once, not twice. The input listener queues the same refresh the value write does, so a field's mark and `f.error()` follow on the next microtask.
