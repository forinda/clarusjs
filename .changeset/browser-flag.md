---
'clarusjs': minor
---

`browser` from `clarusjs/runtime`: true in the browser, false on the server, for the parts of a component's script that only make sense where it attaches (timers, listeners on `window`, the DOM). Replaces `typeof window !== 'undefined'`; a window without a document (some server runtimes define one) counts as the server.
