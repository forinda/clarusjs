---
'clarusjs': patch
---

`clarusjs/forms`: a field's message element is found in the nearest container around it that has one, so it can sit beside the label (`<div data-cl-field><label>…</label> <input …> <small data-cl-message></small></div>`) instead of inside it, where it would be read as part of the field's name. `f.errors` paths are typed, so a summary can pass them to `f.focus()`.
