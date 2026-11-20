---
"clarusjs": minor
---

Focus and announcements on navigation. After a fragment swap or a client route render, focus moves to the new content: the `#hash` target, else the page's `<h1>`, else `<main>`. The new title is announced in a polite live region. The router and the navigation script stay within their 1 KB budgets: the work is in the loader.
