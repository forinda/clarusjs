---
"clarusjs": minor
---

Client routes: `routes: { '/app/*': 'client' }`. A client route is answered with a shell (the island loader, a router under 1 KB gzip and a table of the client routes); the router loads the page's render module and its `<path>/__data.json` (params plus `load()`, written at build, served by the handler in dev and on a server), renders the page in the browser and attaches its islands. Navigations between client routes go through the Navigation API without reloads; browsers without it load pages normally, and a page that fails to render falls back to a normal load. The manifest and `clarusjs explain` show client routes. Also fixes nested components in browser render modules: a `?render` module now imports its child components as render modules too.
