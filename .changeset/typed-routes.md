---
'clarusjs': patch
---

Typed routes: `href(route, params)` from `clarusjs/navigation` builds a page's URL from its route (`'/releases/[version]'`), with params encoded and the site's base. `clarusjs check` writes `.clarusjs/routes.d.ts` (every page under `src/pages`, Markdown pages too), so a route that doesn't exist or a missing param is a type error.
