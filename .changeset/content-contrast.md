---
"@clarusjs/content": minor
---

Highlighted code meets WCAG AA contrast. The default themes are GitHub's `github-light-default` and `github-dark-default`, whose colours were made for contrast. The light theme's comments use `#59636e` (5.9:1 on white) instead of `#6e7781` (4.55:1). Code block classes now name the new themes, so update any CSS that targets `shiki-themes github-light github-dark`.
