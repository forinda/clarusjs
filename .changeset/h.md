---
'clarusjs': minor
---

`h()` in `clarusjs/views` (#259) builds HTML in server code from elements and views: for components picked at runtime, wrappers, generated layouts and tests (`h('components/card', { title }, [h('p', {}, ['Body'])])`).

- Text is escaped and attributes are URL-checked, as in templates, and `h()` results nest.
- A template's `{{ }}` inserts `h()` output as HTML; every other value is escaped as before.
- Only `h()` can make that output (data such as JSON can't), so an island prop holding it arrives as text.
- `on*` attributes, `srcdoc` and tags that load or run things are refused from code.
