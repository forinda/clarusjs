---
'clarusjs': minor
---

URLs that load a page, plugin, stylesheet or base URL into the page can't come from data (#248). It is a located build error, like `srcdoc`:

- `src` on `<iframe>`, `<frame>` and `<embed>`;
- `data` and `codebase` on `<object>`;
- `href` on `<base>`;
- `href` on a `<link>`, unless its static `rel` loads nothing (`canonical`, `alternate`, `prev`, `next`…);
- `sandbox`, `allow` and `referrerpolicy` on `<iframe>`.

Write these as static attributes. Links and images from data are unchanged: they keep the URL check.
