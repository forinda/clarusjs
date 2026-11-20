---
"clarusjs": minor
---

Canonical URLs and social cards: with `site: { url, name?, image? }`, every page gets `<link rel="canonical">` and Open Graph/Twitter tags (title without the template, description, url, type, site name, image as an absolute URL, card type). They fill in like site tags, so a page's own tags win. Without `site`, a relative `og:image` or `og:url` fails the build instead of shipping a broken card. Link checking also checks absolute links to the site itself. The published JavaScript no longer carries source comments (the declarations and the browser runtime keep theirs), which keeps the package small.
