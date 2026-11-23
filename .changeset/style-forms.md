---
'clarusjs': minor
---

Style forms: `[style.color]="c"` (and custom properties, `[style.--accent]`, or camelCase, `[style.fontSize]`) sets one property, removed when the value is `null`, `undefined` or `false`; a bound `[style]` takes an object (camelCase keys to kebab-case, no units added). They merge with a written `style="…"`, on the server and in islands; `clarusjs check` types them. `styleValue()` is exported from the runtime. They used to compile to `style.color="…"` and `[object Object]`.
