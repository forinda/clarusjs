---
'clarusjs': minor
---

`<script server>`: code that runs on the server while a page or component renders, and can `await` (#430). Its names are there for the template, its imports never reach the browser (`node:` modules too), and it doesn't make the component an island. A component that awaits there renders asynchronously; its parents join what it returns, and stay synchronous when nothing they contain awaits. It isn't allowed in an island, inside one, or in a client route (located errors). The request handler, `render()` and `h()` from `clarusjs/views` await async renders, and component loaders' data now stays with its own render across `await`s (`AsyncLocalStorage`). An island's `<script>` still can't `await` at the top level; its error now names `<script server>` and `resource()`.
