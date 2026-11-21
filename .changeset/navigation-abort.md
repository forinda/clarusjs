---
'clarusjs': patch
---

Aborting a navigation. `abort()` in `clarusjs/navigation` stops the navigation in progress, like the browser's stop button. Push and replace navigations now hold the URL while the next page loads where the browser supports it (precommit handlers): the address bar changes once the page is ready to swap in, so an abort leaves page and URL as they were (elsewhere the URL changes at once, as before). Fragment and `__data.json` requests get the navigation's abort signal, so a stopped or superseded navigation stops downloading. A page's own `replaceState` while a held navigation loads no longer loses the clicked page.
