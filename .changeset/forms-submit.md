---
'clarusjs': minor
---

`clarusjs/forms`: submit takes you to the errors. A connected `<form>`'s submit (or `f.submit()`) checks everything, waits for the schema, and with errors goes to the step of the first one, focuses its field and shows them all (`f.errors` lists them with their message ids, for a summary). Otherwise it calls `submit(values)`; server errors it returns (`{ errors: { path: message } }`) land the same way. One submit at a time (`f.submitting`); `show: 'submit'` keeps errors hidden until the first one.
