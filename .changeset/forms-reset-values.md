---
'clarusjs': minor
---

`clarusjs/forms`: `f.reset(values)` sets new values and makes them the starting point (a record loaded after the form was made, or saved and reloaded), so `f.changed()` and `f.reset()` compare against it. Also: `[engine]` connects its own element inside `@for` rows and next to nested islands (the same lookup reactive attributes use, now shared as `marked()` in the runtime); a form's pending schema check stops when its last island goes; a form made over a store's signal is inert on the server.
