---
'clarusjs': patch
---

Type checking (`clarusjs check` and the content mapper): `[attr]="…"` on an element is checked against what it sets. A boolean attribute (by the DOM's own types: `disabled`, `readonly`, `hidden`, …) takes a boolean, since any string, even `'false'`, switches it on; any other attribute takes a string, number, boolean or null, since an object would render as `[object Object]`.
