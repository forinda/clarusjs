# @clarusjs/ui

Thin, accessible styles for the parts in [`@clarusjs/ui-primitives`](https://clarusjs.com/guide/ui-primitives#parts):
one stylesheet over their `data-part` names and state attributes, light and dark.

For components you copy and own (cards, tables, charts, date pickers, blocks…), in plain CSS or Tailwind, see
[ui.clarusjs.com](https://ui.clarusjs.com).

```sh
pnpm add @clarusjs/ui @clarusjs/ui-primitives
```

```css
@import '@clarusjs/ui/ui.css';
```

- **Change the look with tokens:** `--ui-bg`, `--ui-fg`, `--ui-muted`, `--ui-border`, `--ui-accent`, `--ui-accent-fg`,
  `--ui-accent-soft`, `--ui-danger`, `--ui-shadow`, `--ui-radius`, `--ui-font`, on `:root` or any element around the
  parts. Dark values follow `prefers-color-scheme`, or `data-theme="dark"` / `"light"` on the root element.
- **One spacing scale:** every padding, margin and gap is a step of `--ui-space` (4px): `--ui-space-1` to
  `--ui-space-12`, declared beside it. Set `--ui-space: 3px` for a compact look or `5px` for a roomy one; where you set
  it below `:root`, declare the steps there too (`--ui-space-4: calc(var(--ui-space) * 4)`…), as they're computed
  where they're declared.
- **Your CSS always wins:** every selector is in `:where()`, so it weighs nothing.
- **Accessible defaults:** a visible focus ring on every part, an invalid field marked by its border (not colour
  alone), and no transitions with reduced motion.

Every component, live: https://clarusjs.com/components/dialog
