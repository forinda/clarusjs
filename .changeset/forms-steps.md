---
'clarusjs': minor
---

`clarusjs/forms`: multi-step forms on one page. Sections marked `data-cl-step` with an `id` are shown one at a time, with the current one in the URL hash (Back/Forward and reload land on it; other hashes, like heading anchors, leave the form alone). `f.next()` checks the current step and stays with the first error focused, `f.back()` never checks, `f.go(id)`, `f.step`, and `f.steps` (current, done, errors per step) for a step list. `f.focus(path)` opens the step holding the field.
