---
'clarusjs': patch
---

Image attributes (`src`, `srcset`, `poster`) accept object URLs (`blob:`), so a bound `<img [src]>` can preview a picked file. `href` still refuses them, and attributes that load a page or a script stay static only.
