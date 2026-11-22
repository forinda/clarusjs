---
'clarusjs': minor
'@clarusjs/content': minor
---

A page sets its own sitemap date: `<cl-head><meta name="sitemap:lastmod" content="2026-11-01"></cl-head>` (or `lastmod:` in Markdown frontmatter) wins over the git date and is removed from the built page; a value that isn't a date fails the build, naming the page.
