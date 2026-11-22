---
'clarusjs': minor
---

The sitemap lists each page's images with Google's image extension: every `<img>` resolved to an absolute URL, except decorative ones (`alt=""`) and `data:` URLs. `sitemap: { images: false }` leaves them out.
