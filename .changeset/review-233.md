---
'clarusjs': patch
---

Type checking: a callback is typed `any` only when passed to one of the script's own top-level functions (not a nested function that happens to share an imported name), and not when that parameter has a default, which gives the callback its type.
