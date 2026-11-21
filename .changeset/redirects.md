---
'clarusjs': patch
---

Redirects. A server page's `load()` can return a `Response`, such as `redirect('/login')` from `clarusjs/server` (302 by default; 301, 303, 307 or 308). Fragment navigation and the client router follow it by loading the page normally, so the address bar shows where it landed. The plugin's `redirects: { '/old': '/new' }` writes a forwarding page at each old path and `_redirects` lines (a real 301 on Netlify and Cloudflare Pages), and the dev server answers 301; old paths pass the link check, and a redirect from a path that is a page is a build error.
