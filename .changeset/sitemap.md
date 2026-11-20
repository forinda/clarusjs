---
"clarusjs": minor
---

Sitemap: with `site` set, `vite build` writes `sitemap.xml` listing every prerendered static page. Client and server routes, data files, fragments and `noindex` pages are left out. Each page's `lastmod` is its source file's last commit, read with one batched `git log`. Files git doesn't know use `SOURCE_DATE_EPOCH`, or get no date. `sitemap: false` turns it off.
