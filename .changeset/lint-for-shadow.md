---
'clarusjs': minor
---

Lint rule `for-shadow`: an `@for` row named like something the component declares (a script or server-script name, an `@input` or `@model`, an import) hides it inside the loop, so `[class]="item"` there reads the row. A warning, at the row's name.
