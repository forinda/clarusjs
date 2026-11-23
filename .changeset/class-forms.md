---
'clarusjs': minor
---

Class forms: `[class.active]="on"` toggles one class, and a bound `[class]` takes a string, an object (its truthy keys) or an array (falsy entries dropped, nested allowed), like clsx. All of an element's class sources merge, each class once, with the scope class, on the server and in islands; `clarusjs check` types them. `classValue()` is exported from the runtime. They used to compile to `class.active` and `[object Object]`.
