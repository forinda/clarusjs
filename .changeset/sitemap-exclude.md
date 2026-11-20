---
"clarusjs": minor
---

Sitemap exclusions: `sitemap: { exclude: ["/drafts/**", "/tags/*", "/legal"] }` leaves pages out by path (`*` is one segment, `**` any depth). A page leaves itself out with `<cl-head><meta name="sitemap" content="false"></cl-head>`, and the marker is removed from the built page.
