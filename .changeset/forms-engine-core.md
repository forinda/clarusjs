---
'clarusjs': minor
---

`clarusjs/forms`: a headless forms engine. `const f = form(values, { schema, show, messages })` over a component's state or a store; `<form [engine]="f">` connects it. Every field's error (native constraints, a Standard Schema, server errors via `f.setErrors`) shows in its `[data-cl-message]` element, with `aria-invalid` and `aria-describedby`, without naming the path in the template. `f.error(path)`, `f.errors`, `f.touched`, `f.changed`, `f.valid`, `f.pending`, `f.focus`, `f.reset`; paths are type-checked. The compiler marks every `[(value)]`/`[(checked)]` with `data-cl-path`.
