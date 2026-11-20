---
"clarusjs": minor
---

Every page's `<head>`:

- `head: { titleTemplate, tags, jsonLd }` in the plugin. `titleTemplate` (`%s · Site`) wraps each title, client routes included. `tags` (`[tag, attrs, content?]`) go on every page, for example icons, theme colour or analytics scripts such as gtag. `jsonLd` is site-wide schema.org data.
- `<cl-head>…</cl-head>` anywhere in a page adds tags to its `<head>`. They win over site tags with the same key (title, meta name/property, canonical…), and a `<title>` there is used as written.
- `transformHead(head, page)` exported from `src/head.ts` runs last on every page.
- JSON-LD in templates: `<script type="application/ld+json">{{ { "@type": "Article", headline: title } }}</script>` writes the value as JSON that is safe inside the script.
