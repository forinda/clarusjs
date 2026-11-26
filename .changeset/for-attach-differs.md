---
'clarusjs': patch
---

An island's `@for` whose list in the browser differs from the one the server rendered (it reads the URL, storage, or anything else the server can't see) now attaches and shows the browser's list. Before, attaching adopted the server's rows by position and failed when there were more of them.
