---
'clarusjs': patch
---

`clarusjs/forms`: a multi-step form moves between steps inside a sandboxed frame too (a `srcdoc` iframe, an embedded preview). There `history.pushState` throws, and `next()` rejected with the step half-changed; now the step moves, without the URL hash.
