---
"clarusjs": minor
---

`readManifest()` from `clarusjs/manifest`: a page can read the route manifest while the site is built. Pages that call it are rendered again once the manifest is written, so they show the final build; outside a build it returns `null`.
