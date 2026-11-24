---
"@clarusjs/ui": minor
---

23 more `--ui-` tokens, matching shadcn's roles (34 in all): `--ui-card`/`-fg`, `--ui-popover`/`-fg`, `--ui-secondary`/`-fg`, `--ui-muted-bg`, `--ui-accent-soft-fg`, `--ui-danger-fg`, `--ui-input`, `--ui-ring`, `--ui-sidebar` (with `-fg`, `-accent`, `-accent-fg`, `-border`), `--ui-success`/`-fg`, `--ui-warning`/`-fg`, `--ui-font-heading`, `--ui-font-mono` and `--ui-font-size`, each with light and dark values. Their defaults equal what the parts look like today, so nothing changes until you set them.

`ui.css`'s rules now sit in `@layer components` (the tokens stay unlayered), so Tailwind's utilities and any CSS you write outside a layer override them; they were already zero-specificity (`:where()`). It starts with `@layer theme, base, components, utilities;` (Tailwind's order), so its components rank above a Tailwind preflight whichever stylesheet loads first; without Tailwind the statement changes nothing.
