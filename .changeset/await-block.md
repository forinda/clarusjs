---
'clarusjs': minor
---

`@await (promise) { pending } @then (value) { … } @catch (error) { … }` (#430). In an island the server renders the pending branch and the browser swaps in `@then` or `@catch` when the promise settles; when the expression's signals change a new promise starts, and only the newest one's answer shows. Outside islands the server awaits it and renders `@then` or `@catch` into the HTML (without `@catch`, a rejection fails the render). It reuses the `@if` block markers (`<!--[bN:0-->`). `clarusjs check` types `@then`'s name as the promise's value.
