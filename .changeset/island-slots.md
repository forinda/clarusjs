---
"clarusjs": minor
---

Islands take content at `<slot />` (#465). The server renders it in the parent's scope and the browser never re-renders it, so in an island a slot sits outside `@if`, `@for` and `@await` blocks and component content, passes no data and has no fallback. Content from inside another island is a render error for now.
