---
'clarusjs': minor
---

`h()` in `clarusjs/views` (#259) builds HTML in server code from elements and views: for components picked at runtime, wrappers, generated layouts and tests (`h('components/card', { title }, [h('p', {}, ['Body'])])`).

- Text is escaped and attributes are URL-checked, as in templates, and `h()` results nest.
- A template's `{{ }}` inserts `h()` output as HTML; every other value is escaped as before.
- Only `h()` can make that output (data such as JSON can't). It's for server-rendered pages: sending it in an island's props or a client route's data is an error naming it.
- `on*` attributes, `srcdoc`, tags that load or run things, and clarusjs's own `cl-*` tags are refused from code. Take view and tag names from your own list, never from request data.
