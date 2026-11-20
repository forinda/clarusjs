---
"clarusjs": minor
---

Fragment responses: with `fragments: true`, every static and server page also answers at `<path>/index.frag.html` with its `<title>` and its swap region (the element marked `data-cl-swap`, or the `<body>`). `vite build` writes the files next to each static page; server routes serve them from the handler and, with `adapter: 'netlify'`, from the function. The URL selects the fragment (not a header), so it works on static hosts.
