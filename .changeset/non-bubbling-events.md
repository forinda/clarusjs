---
'clarusjs': patch
---

Event bindings for events that don't bubble work: `(mouseenter)`, `(mouseleave)`, `(pointerenter)`, `(pointerleave)`, `(load)`, `(error)`, `(scroll)`, `(toggle)`, `(invalid)`, `(close)`, `(cancel)` and media events are caught in the capture phase, like `(focus)` and `(blur)` already were.
