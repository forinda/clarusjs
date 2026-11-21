---
'clarusjs': patch
---

A client route whose first render fails shows the site's 404 or 500 page (`src/pages/404.tscl`, `500.tscl`) at the same URL, with its islands and stylesheets (the shell links them). Without one, it shows "Could not load page." (also for a missing page, which said "Page not found." before).
